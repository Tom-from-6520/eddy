/*---------------------------------------------------------------------------------------------
 *  Copyright (c) eddy contributors. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { createUpdateURL, isNewerBuild } from '../../electron-main/abstractUpdateService.js';

suite('eddy update feed', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('points at a static manifest per quality and platform', () => {
		assert.strictEqual(
			createUpdateURL('https://github.com/owner/eddy/releases/download/updates', 'win32-x64-user', 'alpha', 'abc123', { background: true }),
			'https://github.com/owner/eddy/releases/download/updates/alpha-win32-x64-user.json?bg=true&u=none');
		assert.strictEqual(
			createUpdateURL('https://example.com/feed', 'linux-x64', 'alpha', 'abc123'),
			'https://example.com/feed/alpha-linux-x64.json?u=none');
	});

	test('an update is a manifest for another commit', () => {
		assert.strictEqual(isNewerBuild({ version: 'new', url: 'u', productVersion: '1' }, 'old'), true);
		assert.strictEqual(isNewerBuild({ version: 'same', url: 'u', productVersion: '1' }, 'same'), false);
		assert.strictEqual(isNewerBuild(null, 'old'), false);
		assert.strictEqual(isNewerBuild({ version: '' }, 'old'), false);
	});
});
