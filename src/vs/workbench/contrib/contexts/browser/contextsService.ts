/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Sequencer } from '../../../../base/common/async.js';
import { Emitter } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { localize } from '../../../../nls.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IEditorGroupsService, IEditorWorkingSet } from '../../../services/editor/common/editorGroupsService.js';
import { IContextsService, IWorkContext } from '../common/contexts.js';

interface IStoredContext {
	readonly id: string;
	name: string;
	readonly createdAt: number;
	/** Editors saved when the user last left this Context. Unset for the active Context's live state or a fresh Context. */
	workingSet?: IEditorWorkingSet;
}

interface IStoredState {
	readonly version: 1;
	readonly contexts: IStoredContext[];
	readonly activeId: string;
}

export class ContextsService extends Disposable implements IContextsService {

	declare readonly _serviceBrand: undefined;

	static readonly STORAGE_KEY = 'contextIde.contexts';

	private readonly _onDidChange = this._register(new Emitter<void>());
	readonly onDidChange = this._onDidChange.event;

	private readonly _contexts: IStoredContext[];
	private _activeId: string;

	// Switches, creates and deletes all swap editors; never let two run at once.
	private readonly _sequencer = new Sequencer();

	constructor(
		@IEditorGroupsService private readonly _editorGroupsService: IEditorGroupsService,
		@IStorageService private readonly _storageService: IStorageService,
		@ILogService private readonly _logService: ILogService,
	) {
		super();

		const state = this._load();
		if (state) {
			this._contexts = state.contexts;
			this._activeId = state.activeId;
		} else {
			const initial: IStoredContext = { id: generateUuid(), name: localize('contexts.default', "Default"), createdAt: Date.now() };
			this._contexts = [initial];
			this._activeId = initial.id;
			this._persist();
		}
	}

	get contexts(): readonly IWorkContext[] {
		return this._contexts.map(toPublic);
	}

	get activeContext(): IWorkContext {
		return toPublic(this._getStored(this._activeId)!);
	}

	createContext(name: string): Promise<IWorkContext | undefined> {
		return this._sequencer.queue(async () => {
			const context: IStoredContext = { id: generateUuid(), name: name.trim() || localize('contexts.untitled', "Untitled"), createdAt: Date.now() };
			this._contexts.push(context);
			if (!await this._doSwitch(context)) {
				this._contexts.splice(this._contexts.indexOf(context), 1);
				this._persist();
				this._onDidChange.fire();
				return undefined;
			}
			return toPublic(context);
		});
	}

	switchContext(id: string): Promise<boolean> {
		return this._sequencer.queue(async () => {
			const target = this._getStored(id);
			if (!target) {
				return false;
			}
			if (target.id === this._activeId) {
				return true;
			}
			return this._doSwitch(target);
		});
	}

	renameContext(id: string, name: string): void {
		const context = this._getStored(id);
		const trimmed = name.trim();
		if (!context || !trimmed || context.name === trimmed) {
			return;
		}
		context.name = trimmed;
		this._persist();
		this._onDidChange.fire();
	}

	deleteContext(id: string): Promise<boolean> {
		return this._sequencer.queue(async () => {
			const context = this._getStored(id);
			if (!context || this._contexts.length <= 1) {
				return false;
			}

			if (context.id === this._activeId) {
				const fallback = this._contexts
					.filter(c => c.id !== id)
					.sort((a, b) => b.createdAt - a.createdAt)[0];
				if (!await this._doSwitch(fallback)) {
					return false;
				}
			}

			if (context.workingSet) {
				this._editorGroupsService.deleteWorkingSet(context.workingSet);
			}
			this._contexts.splice(this._contexts.indexOf(context), 1);
			this._persist();
			this._onDidChange.fire();
			return true;
		});
	}

	private async _doSwitch(target: IStoredContext): Promise<boolean> {
		const current = this._getStored(this._activeId)!;
		const previousWorkingSet = current.workingSet;
		current.workingSet = this._editorGroupsService.saveWorkingSet(`context:${current.id}`);

		if (target.workingSet && !this._editorGroupsService.getWorkingSets().some(ws => ws.id === target.workingSet!.id)) {
			// The saved working set can disappear (e.g. editor storage was reset); open the Context empty rather than failing.
			this._logService.warn(`[contexts] working set for context "${target.name}" is missing; opening it empty`);
			target.workingSet = undefined;
		}

		const applied = await this._editorGroupsService.applyWorkingSet(target.workingSet ?? 'empty', { preserveFocus: true });
		if (!applied) {
			this._editorGroupsService.deleteWorkingSet(current.workingSet);
			current.workingSet = previousWorkingSet;
			return false;
		}

		if (previousWorkingSet) {
			this._editorGroupsService.deleteWorkingSet(previousWorkingSet);
		}
		this._activeId = target.id;
		this._persist();
		this._onDidChange.fire();
		return true;
	}

	private _getStored(id: string): IStoredContext | undefined {
		return this._contexts.find(c => c.id === id);
	}

	private _load(): IStoredState | undefined {
		const raw = this._storageService.get(ContextsService.STORAGE_KEY, StorageScope.WORKSPACE);
		if (!raw) {
			return undefined;
		}
		try {
			const state = JSON.parse(raw) as IStoredState;
			if (state?.version !== 1 || !Array.isArray(state.contexts) || state.contexts.length === 0) {
				return undefined;
			}
			const activeId = state.contexts.some(c => c.id === state.activeId) ? state.activeId : state.contexts[0].id;
			return { version: 1, contexts: state.contexts, activeId };
		} catch (error) {
			this._logService.error('[contexts] failed to read stored contexts', error);
			return undefined;
		}
	}

	private _persist(): void {
		const state: IStoredState = { version: 1, contexts: this._contexts, activeId: this._activeId };
		this._storageService.store(ContextsService.STORAGE_KEY, JSON.stringify(state), StorageScope.WORKSPACE, StorageTarget.MACHINE);
	}
}

function toPublic(context: IStoredContext): IWorkContext {
	return { id: context.id, name: context.name, createdAt: context.createdAt };
}
