/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { NullLogService } from '../../../../../platform/log/common/log.js';
import { IEditorGroupsService, IEditorWorkingSet } from '../../../../services/editor/common/editorGroupsService.js';
import { TestStorageService } from '../../../../test/common/workbenchTestServices.js';
import { ContextsService } from '../../browser/contextsService.js';

/** Minimal editor groups stand-in: "open editors" is a list of names, working sets are snapshots of it. */
class FakeEditorGroups {
	open: string[] = [];
	readonly sets = new Map<string, string[]>();
	failNextApply = false;
	private _nextId = 0;

	saveWorkingSet(name: string): IEditorWorkingSet {
		const id = `ws${this._nextId++}`;
		this.sets.set(id, [...this.open]);
		return { id, name };
	}

	getWorkingSets(): IEditorWorkingSet[] {
		return [...this.sets.keys()].map(id => ({ id, name: id }));
	}

	async applyWorkingSet(workingSet: IEditorWorkingSet | 'empty'): Promise<boolean> {
		if (this.failNextApply) {
			this.failNextApply = false;
			return false;
		}
		if (workingSet === 'empty') {
			this.open = [];
			return true;
		}
		const editors = this.sets.get(workingSet.id);
		if (!editors) {
			return false;
		}
		this.open = [...editors];
		return true;
	}

	deleteWorkingSet(workingSet: IEditorWorkingSet): void {
		this.sets.delete(workingSet.id);
	}
}

suite('ContextsService', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	let groups: FakeEditorGroups;
	let storage: TestStorageService;

	setup(() => {
		groups = new FakeEditorGroups();
		storage = store.add(new TestStorageService());
	});

	function createService(): ContextsService {
		return store.add(new ContextsService(groups as unknown as IEditorGroupsService, storage, new NullLogService()));
	}

	test('starts with a single active Default context', () => {
		const service = createService();
		assert.strictEqual(service.contexts.length, 1);
		assert.strictEqual(service.activeContext.name, 'Default');
	});

	test('new context starts empty and switching back restores editors', async () => {
		const service = createService();
		const defaultId = service.activeContext.id;
		groups.open = ['a.ts', 'b.ts'];

		const feature = await service.createContext('Feature');
		assert.ok(feature);
		assert.strictEqual(service.activeContext.id, feature.id);
		assert.deepStrictEqual(groups.open, []);

		groups.open = ['c.ts'];
		assert.strictEqual(await service.switchContext(defaultId), true);
		assert.deepStrictEqual(groups.open, ['a.ts', 'b.ts']);

		assert.strictEqual(await service.switchContext(feature.id), true);
		assert.deepStrictEqual(groups.open, ['c.ts']);
	});

	test('switching replaces the stale working set instead of accumulating them', async () => {
		const service = createService();
		const defaultId = service.activeContext.id;
		const other = (await service.createContext('Other'))!;

		for (let i = 0; i < 5; i++) {
			await service.switchContext(defaultId);
			await service.switchContext(other.id);
		}
		// One saved set per inactive context, plus the one being restored for the active context.
		assert.ok(groups.sets.size <= 2, `expected at most 2 working sets, got ${groups.sets.size}`);
	});

	test('failed switch keeps the current context active and its previous working set', async () => {
		const service = createService();
		const defaultId = service.activeContext.id;
		groups.open = ['a.ts'];
		const other = (await service.createContext('Other'))!;

		groups.failNextApply = true;
		assert.strictEqual(await service.switchContext(defaultId), false);
		assert.strictEqual(service.activeContext.id, other.id);

		assert.strictEqual(await service.switchContext(defaultId), true);
		assert.deepStrictEqual(groups.open, ['a.ts']);
	});

	test('missing working set opens the context empty', async () => {
		const service = createService();
		const defaultId = service.activeContext.id;
		groups.open = ['a.ts'];
		await service.createContext('Other');

		groups.sets.clear();
		groups.open = ['x.ts'];
		assert.strictEqual(await service.switchContext(defaultId), true);
		assert.deepStrictEqual(groups.open, []);
	});

	test('rename ignores blank names and trims', () => {
		const service = createService();
		const id = service.activeContext.id;
		service.renameContext(id, '   ');
		assert.strictEqual(service.activeContext.name, 'Default');
		service.renameContext(id, '  Incident 4521 ');
		assert.strictEqual(service.activeContext.name, 'Incident 4521');
	});

	test('cannot delete the last context; deleting the active one switches away', async () => {
		const service = createService();
		const defaultId = service.activeContext.id;
		assert.strictEqual(await service.deleteContext(defaultId), false);

		groups.open = ['a.ts'];
		const other = (await service.createContext('Other'))!;
		groups.open = ['b.ts'];

		assert.strictEqual(await service.deleteContext(other.id), true);
		assert.strictEqual(service.activeContext.id, defaultId);
		assert.deepStrictEqual(groups.open, ['a.ts']);
		assert.strictEqual(service.contexts.length, 1);
	});

	test('state survives a reload', async () => {
		const first = createService();
		groups.open = ['a.ts'];
		const other = (await first.createContext('Other'))!;
		first.renameContext(other.id, 'Renamed');

		const second = createService();
		assert.deepStrictEqual(second.contexts.map(c => c.name), ['Default', 'Renamed']);
		assert.strictEqual(second.activeContext.id, other.id);

		await second.switchContext(second.contexts[0].id);
		assert.deepStrictEqual(groups.open, ['a.ts']);
	});
});
