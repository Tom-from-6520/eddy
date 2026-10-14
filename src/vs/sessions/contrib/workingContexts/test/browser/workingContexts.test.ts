/*---------------------------------------------------------------------------------------------
 *  Copyright (c) eddy contributors. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../../base/common/async.js';
import { Emitter } from '../../../../../base/common/event.js';
import { observableValue, transaction } from '../../../../../base/common/observable.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { NullLogService } from '../../../../../platform/log/common/log.js';
import { InMemoryStorageService } from '../../../../../platform/storage/common/storage.js';
import { IPathService } from '../../../../../workbench/services/path/common/pathService.js';
import { ISessionGroupsChangeEvent, ISessionGroupsService } from '../../../../services/sessions/browser/sessionGroupsService.js';
import { ISessionsService } from '../../../../services/sessions/browser/sessionsService.js';
import { ISession } from '../../../../services/sessions/common/session.js';
import { ISessionsManagementService } from '../../../../services/sessions/common/sessionsManagement.js';
import { contextFolderName, resolveContextLayout, WorkingContextsService } from '../../browser/workingContexts.js';

interface IFakeSession {
	readonly sessionId: string;
	readonly resource: URI;
	readonly isCreated: ReturnType<typeof observableValue<boolean>>;
	readonly isArchived: ReturnType<typeof observableValue<boolean>>;
}

function fakeSession(id: string): IFakeSession {
	return {
		sessionId: id,
		resource: URI.parse(`test-session:/${id}`),
		isCreated: observableValue(`created-${id}`, true),
		isArchived: observableValue(`archived-${id}`, false),
	};
}

suite('WorkingContexts', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	suite('contextFolderName', () => {
		test('slugifies the name and appends the start of the id', () => {
			assert.strictEqual(contextFolderName('Incident 4521 – upstream data gap', '0f3a9c2e-1111-2222-3333-444455556666'), 'incident-4521-upstream-data-gap-0f3a9c2e');
		});

		test('strips accents and falls back for names without letters or digits', () => {
			assert.strictEqual(contextFolderName('Café Ünïcode', 'abcdef12-0000'), 'cafe-unicode-abcdef12');
			assert.strictEqual(contextFolderName('🔥🔥', 'abcdef12-0000'), 'context-abcdef12');
		});

		test('limits the length without a trailing dash', () => {
			const name = contextFolderName('a'.repeat(39) + ' bcd', 'abcdef12');
			assert.strictEqual(name, 'a'.repeat(39) + '-abcdef12');
		});
	});

	suite('resolveContextLayout', () => {
		test('restores the saved threads and keeps the opened thread in place', () => {
			assert.deepStrictEqual(resolveContextLayout(['a', 'b', 'c'], 'b', () => true), ['a', 'b', 'c']);
		});

		test('adds the opened thread at the end when it was not saved', () => {
			assert.deepStrictEqual(resolveContextLayout(['a', 'b'], 'x', () => true), ['a', 'b', 'x']);
			assert.deepStrictEqual(resolveContextLayout(undefined, 'x', () => true), ['x']);
		});

		test('drops threads that left the context or no longer exist', () => {
			assert.deepStrictEqual(resolveContextLayout(['a', 'gone', 'b'], 'b', r => r !== 'gone'), ['a', 'b']);
		});
	});

	suite('WorkingContextsService', () => {

		const sessions = new Map<string, IFakeSession>();
		const membership = new Map<string, string>();
		const groups = new Set<string>();
		let active: ReturnType<typeof observableValue<IFakeSession | undefined>>;
		let visible: ReturnType<typeof observableValue<readonly (IFakeSession | undefined)[]>>;
		let newSession: ReturnType<typeof observableValue<IFakeSession | undefined>>;
		let onDidStartSession: Emitter<ISession>;
		let gridRequests: string[][];

		function addSession(id: string, contextId: string | undefined): IFakeSession {
			const session = fakeSession(id);
			sessions.set(session.resource.toString(), session);
			if (contextId) {
				membership.set(id, contextId);
			}
			return session;
		}

		/** Simulates clicking a thread in the list: it replaces the active slot of the grid. */
		function open(session: IFakeSession): void {
			transaction(tx => {
				const current = visible.get();
				const index = Math.max(0, current.findIndex(s => s?.sessionId === active.get()?.sessionId));
				const next = current.length ? current.map((s, i) => i === index ? session : s) : [session];
				visible.set(next, tx);
				active.set(session, tx);
			});
		}

		function names(list: readonly (IFakeSession | undefined)[]): string[] {
			return list.map(s => s?.sessionId ?? '<empty>');
		}

		function createService(): WorkingContextsService {
			const sessionsService = {
				activeSession: active,
				visibleSessions: visible,
				openSessionsInGrid: async (list: readonly IFakeSession[]) => {
					gridRequests.push(names(list));
					transaction(tx => visible.set([...list], tx));
				},
			} as unknown as ISessionsService;
			const groupsService = {
				onDidChange: new Emitter<ISessionGroupsChangeEvent>().event,
				getGroups: () => [...groups].map(id => ({ id, name: id, createdAt: 0 })),
				getGroup: (id: string) => groups.has(id) ? { id, name: id, createdAt: 0 } : undefined,
				getGroupOfSession: (id: string) => membership.get(id),
				isExplicitlyUngrouped: () => false,
				addToGroup: (id: string, groupId: string) => membership.set(id, groupId),
			} as unknown as ISessionGroupsService;
			const managementService = {
				newSession,
				onDidStartSession: onDidStartSession.event,
				getSession: (resource: URI) => sessions.get(resource.toString()),
			} as unknown as ISessionsManagementService;
			const fileService = { exists: async () => true, createFolder: async () => undefined } as unknown as IFileService;
			const pathService = { userHome: async () => URI.file('/home/test') } as unknown as IPathService;
			return store.add(new WorkingContextsService(sessionsService, groupsService, managementService, store.add(new InMemoryStorageService()), fileService, pathService, new NullLogService()));
		}

		setup(() => {
			sessions.clear();
			membership.clear();
			groups.clear();
			groups.add('A');
			groups.add('B');
			active = observableValue<IFakeSession | undefined>('active', undefined);
			visible = observableValue<readonly (IFakeSession | undefined)[]>('visible', []);
			newSession = observableValue<IFakeSession | undefined>('newSession', undefined);
			onDidStartSession = store.add(new Emitter<ISession>());
			gridRequests = [];
		});

		test('switching contexts shows each context\'s own threads side by side', async () => {
			const a1 = addSession('a1', 'A');
			const a2 = addSession('a2', 'A');
			const b1 = addSession('b1', 'B');
			const service = createService();

			// Work in A with two threads side by side.
			transaction(tx => { visible.set([a1, a2], tx); active.set(a1, tx); });
			assert.strictEqual(service.activeContextId, 'A');

			// Opening a thread of B shows only B's threads.
			open(b1);
			await timeout(0);
			assert.strictEqual(service.activeContextId, 'B');
			assert.deepStrictEqual(names(visible.get()), ['b1']);

			// Coming back to A restores both of its threads, with the opened one active.
			open(a2);
			await timeout(0);
			assert.strictEqual(service.activeContextId, 'A');
			assert.deepStrictEqual(names(visible.get()), ['a1', 'a2']);
			assert.deepStrictEqual(gridRequests, [['b1'], ['a1', 'a2']]);
		});

		test('drafts of new threads do not switch the context', () => {
			const a1 = addSession('a1', 'A');
			const draft = addSession('draft', undefined);
			transaction(tx => draft.isCreated.set(false, tx));
			const service = createService();

			transaction(tx => { visible.set([a1], tx); active.set(a1, tx); });
			open(draft);
			assert.strictEqual(service.activeContextId, 'A');
			assert.deepStrictEqual(gridRequests, []);
		});

		test('a new thread joins the context the user was working in, unless it was placed explicitly', async () => {
			const a1 = addSession('a1', 'A');
			createService();
			transaction(tx => { visible.set([a1], tx); active.set(a1, tx); });

			const draft = addSession('n1', undefined);
			transaction(tx => newSession.set(draft, tx));
			onDidStartSession.fire(draft as unknown as ISession);
			await timeout(1);
			assert.strictEqual(membership.get('n1'), 'A');

			const explicit = addSession('n2', 'B');
			transaction(tx => newSession.set(explicit, tx));
			onDidStartSession.fire(explicit as unknown as ISession);
			await timeout(1);
			assert.strictEqual(membership.get('n2'), 'B');
		});
	});
});
