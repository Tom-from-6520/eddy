/*---------------------------------------------------------------------------------------------
 *  Copyright (c) eddy contributors. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { autorun, observableValue } from '../../../../base/common/observable.js';
import { joinPath } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IPathService } from '../../../../workbench/services/path/common/pathService.js';
import { ISessionGroupsService } from '../../../services/sessions/browser/sessionGroupsService.js';
import { ISessionsService } from '../../../services/sessions/browser/sessionsService.js';
import { ISessionsManagementService } from '../../../services/sessions/common/sessionsManagement.js';

/**
 * eddy Working Contexts.
 *
 * A Working Context is a custom group of the sessions list (its threads are the group's
 * sessions) plus what eddy adds on top:
 * - a folder on disk for the context's files (`~/eddy/contexts/<name>-<id>`);
 * - the threads that were open side by side, restored when you switch back to the context;
 * - new threads start in the context you're working in.
 */
export interface IWorkingContextsService {
	readonly _serviceBrand: undefined;

	/** The context of the active thread, if it belongs to one. */
	readonly activeContextId: string | undefined;

	/** Creates a Working Context (and its folder) and returns its id. */
	createContext(name: string): Promise<string>;

	/** The context's folder on disk, created if missing. */
	getContextFolder(contextId: string): Promise<URI | undefined>;
}

export const IWorkingContextsService = createDecorator<IWorkingContextsService>('eddyWorkingContextsService');

interface IStoredState {
	readonly version: 1;
	/** Context id -> folder URI. */
	readonly folders: Record<string, string>;
	/** Context id -> resources of the threads that were open side by side, in grid order. */
	readonly layouts: Record<string, string[]>;
}

const STORAGE_KEY = 'eddy.workingContexts';

/** Folder name for a context: readable, filesystem-safe, and unique by id. */
export function contextFolderName(name: string, id: string): string {
	const slug = name
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 40)
		.replace(/-+$/g, '');
	return `${slug || 'context'}-${id.replace(/-/g, '').slice(0, 8)}`;
}

/**
 * The threads to show when switching to a context: its saved layout (only threads that still
 * belong to it) plus the thread the user just opened, kept in place or added at the end.
 */
export function resolveContextLayout(saved: readonly string[] | undefined, openedResource: string, stillInContext: (resource: string) => boolean): string[] {
	const result = (saved ?? []).filter(resource => resource === openedResource || stillInContext(resource));
	if (!result.includes(openedResource)) {
		result.push(openedResource);
	}
	return result;
}

export class WorkingContextsService extends Disposable implements IWorkingContextsService {

	declare readonly _serviceBrand: undefined;

	private _state: IStoredState;
	private _activeContextId: string | undefined;
	private _contextForNewThread: string | undefined;
	private _initialized = false;
	private readonly _switching = observableValue<boolean>(this, false);

	constructor(
		@ISessionsService private readonly _sessionsService: ISessionsService,
		@ISessionGroupsService private readonly _sessionGroupsService: ISessionGroupsService,
		@ISessionsManagementService private readonly _sessionsManagementService: ISessionsManagementService,
		@IStorageService private readonly _storageService: IStorageService,
		@IFileService private readonly _fileService: IFileService,
		@IPathService private readonly _pathService: IPathService,
		@ILogService private readonly _logService: ILogService,
	) {
		super();
		this._state = this._load();

		this._register(this._sessionGroupsService.onDidChange(e => {
			if (e.groupsChanged) {
				this._onGroupsChanged();
			}
		}));
		this._onGroupsChanged();

		// New threads start in the context the user is working in. An explicit choice (e.g. a context's
		// "New Thread" button) is applied by the groups service first and wins; this only fills the gap.
		this._register(autorun(reader => {
			if (this._sessionsManagementService.newSession.read(reader)) {
				this._contextForNewThread = this._activeContextId;
			}
		}));
		this._register(this._sessionsManagementService.onDidStartSession(session => {
			const contextId = this._contextForNewThread;
			setTimeout(() => {
				if (contextId && this._sessionGroupsService.getGroup(contextId)
					&& this._sessionGroupsService.getGroupOfSession(session.sessionId) === undefined
					&& !this._sessionGroupsService.isExplicitlyUngrouped(session.sessionId)) {
					this._sessionGroupsService.addToGroup(session.sessionId, contextId);
				}
			}, 0);
		}));

		// Track the active context: remember its layout, and restore another context's layout on switch.
		this._register(autorun(reader => {
			const active = this._sessionsService.activeSession.read(reader);
			const visible = this._sessionsService.visibleSessions.read(reader);
			if (this._switching.read(reader) || !active || !active.isCreated.read(reader)) {
				return; // drafts of new threads don't change the context
			}
			const contextId = this._sessionGroupsService.getGroupOfSession(active.sessionId);
			const isFirst = !this._initialized;
			this._initialized = true;
			if (contextId === this._activeContextId || isFirst) {
				// Same context, or eddy just started: keep what's on screen and remember it.
				this._activeContextId = contextId;
				if (contextId) {
					const inContext = visible.filter(s => !!s && this._sessionGroupsService.getGroupOfSession(s.sessionId) === contextId);
					this._saveLayout(contextId, inContext.map(s => s!.resource.toString()));
				}
				return;
			}
			this._activeContextId = contextId;
			if (contextId) {
				void this._restoreLayout(contextId, active.resource.toString());
			}
		}));
	}

	get activeContextId(): string | undefined {
		return this._activeContextId;
	}

	async createContext(name: string): Promise<string> {
		const group = this._sessionGroupsService.createGroup(name.trim() || 'Untitled context');
		await this.getContextFolder(group.id);
		return group.id;
	}

	async getContextFolder(contextId: string): Promise<URI | undefined> {
		const group = this._sessionGroupsService.getGroup(contextId);
		if (!group) {
			return undefined;
		}
		let folder = this._state.folders[contextId] ? URI.parse(this._state.folders[contextId]) : undefined;
		if (!folder) {
			const home = await this._pathService.userHome();
			folder = joinPath(home, 'eddy', 'contexts', contextFolderName(group.name, group.id));
			this._state = { ...this._state, folders: { ...this._state.folders, [contextId]: folder.toString() } };
			this._save();
		}
		try {
			if (!await this._fileService.exists(folder)) {
				await this._fileService.createFolder(folder);
			}
		} catch (error) {
			this._logService.error(`[eddy] could not create the folder for context "${group.name}"`, error);
		}
		return folder;
	}

	private _onGroupsChanged(): void {
		const ids = new Set(this._sessionGroupsService.getGroups().map(g => g.id));
		// Forget deleted contexts; their folders stay on disk.
		const folders = Object.fromEntries(Object.entries(this._state.folders).filter(([id]) => ids.has(id)));
		const layouts = Object.fromEntries(Object.entries(this._state.layouts).filter(([id]) => ids.has(id)));
		if (Object.keys(folders).length !== Object.keys(this._state.folders).length || Object.keys(layouts).length !== Object.keys(this._state.layouts).length) {
			this._state = { version: 1, folders, layouts };
			this._save();
		}
		for (const id of ids) {
			if (!this._state.folders[id]) {
				void this.getContextFolder(id);
			}
		}
	}

	private _saveLayout(contextId: string, resources: string[]): void {
		const previous = this._state.layouts[contextId];
		if (resources.length === 0 || (previous && previous.length === resources.length && previous.every((r, i) => r === resources[i]))) {
			return;
		}
		this._state = { ...this._state, layouts: { ...this._state.layouts, [contextId]: resources } };
		this._save();
	}

	private async _restoreLayout(contextId: string, openedResource: string): Promise<void> {
		await Promise.resolve(); // leave the autorun that triggered the switch before changing what it reads
		const resources = resolveContextLayout(this._state.layouts[contextId], openedResource, resource => {
			const session = this._sessionsManagementService.getSession(URI.parse(resource));
			return !!session && !session.isArchived.get() && this._sessionGroupsService.getGroupOfSession(session.sessionId) === contextId;
		});
		const sessions = resources.map(r => this._sessionsManagementService.getSession(URI.parse(r))).filter(s => !!s);
		const visible = this._sessionsService.visibleSessions.get().filter(s => !!s).map(s => s!.resource.toString());
		if (sessions.length === visible.length && sessions.every((s, i) => s.resource.toString() === visible[i])) {
			return;
		}
		this._switching.set(true, undefined);
		try {
			await this._sessionsService.openSessionsInGrid(sessions);
		} catch (error) {
			this._logService.error('[eddy] could not restore the context layout', error);
		} finally {
			this._switching.set(false, undefined);
		}
	}

	private _load(): IStoredState {
		try {
			const raw = this._storageService.get(STORAGE_KEY, StorageScope.PROFILE);
			const parsed = raw ? JSON.parse(raw) as IStoredState : undefined;
			if (parsed?.version === 1) {
				return { version: 1, folders: parsed.folders ?? {}, layouts: parsed.layouts ?? {} };
			}
		} catch (error) {
			this._logService.error('[eddy] could not read Working Contexts state', error);
		}
		return { version: 1, folders: {}, layouts: {} };
	}

	private _save(): void {
		this._storageService.store(STORAGE_KEY, JSON.stringify(this._state), StorageScope.PROFILE, StorageTarget.USER);
	}
}
