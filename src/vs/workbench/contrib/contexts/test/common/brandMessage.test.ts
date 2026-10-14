/*---------------------------------------------------------------------------------------------
 *  Copyright (c) eddy contributors. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { brandMessage } from '../../../../../nls.js';

suite('eddy product name in messages', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('replaces VS Code and Visual Studio Code with eddy', () => {
		assert.strictEqual(brandMessage('Welcome to VS Code'), 'Welcome to eddy');
		assert.strictEqual(brandMessage('Restart Visual Studio Code to apply'), 'Restart eddy to apply');
		assert.strictEqual(brandMessage('VS Code\'s settings'), 'eddy\'s settings');
	});

	test('leaves other text alone', () => {
		assert.strictEqual(brandMessage('Open in vscode.dev'), 'Open in vscode.dev');
		assert.strictEqual(brandMessage('VS Codex'), 'VS Codex');
		assert.strictEqual(brandMessage(''), '');
	});
});
