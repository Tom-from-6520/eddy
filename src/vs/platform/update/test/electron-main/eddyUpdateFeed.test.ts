/*---------------------------------------------------------------------------------------------
 *  Copyright (c) eddy contributors. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { bufferToStream, VSBuffer } from '../../../../base/common/buffer.js';
import { Event } from '../../../../base/common/event.js';
import { IRequestContext } from '../../../../base/parts/request/common/request.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { TestConfigurationService } from '../../../configuration/test/common/testConfigurationService.js';
import { IEnvironmentMainService } from '../../../environment/electron-main/environmentMainService.js';
import { ILifecycleMainService } from '../../../lifecycle/electron-main/lifecycleMainService.js';
import { NullLogService } from '../../../log/common/log.js';
import { IMeteredConnectionService } from '../../../meteredConnection/common/meteredConnection.js';
import { IProductService } from '../../../product/common/productService.js';
import { IRequestService } from '../../../request/common/request.js';
import { IApplicationStorageMainService } from '../../../storage/electron-main/storageMainService.js';
import { NullTelemetryService } from '../../../telemetry/common/telemetryUtils.js';
import { AbstractUpdateService, createUpdateURL, isNewerBuild, IUpdateURLOptions } from '../../electron-main/abstractUpdateService.js';

/** Minimal update service whose feed always returns `manifest` with HTTP 200, like a file on GitHub Releases. */
class StaticFeedUpdateService extends AbstractUpdateService {
	constructor(manifest: object, commit: string) {
		const configurationService = new TestConfigurationService();
		configurationService.setUserConfiguration('update.mode', 'default');
		super(
			{ when: () => Promise.resolve(), setRelaunchHandler: () => { }, quit: () => Promise.resolve(false), onWillShutdown: Event.None } as unknown as ILifecycleMainService,
			configurationService,
			{ isBuilt: false, disableUpdates: false } as unknown as IEnvironmentMainService,
			{
				request: async (): Promise<IRequestContext> => ({
					res: { statusCode: 200, headers: {} },
					stream: bufferToStream(VSBuffer.fromString(JSON.stringify(manifest))),
				})
			} as unknown as IRequestService,
			new NullLogService(),
			{ updateUrl: 'https://feed.example', commit, quality: 'alpha', version: '1.0.0' } as unknown as IProductService,
			NullTelemetryService,
			{ whenReady: Promise.resolve(), get: () => undefined, store: () => { } } as unknown as IApplicationStorageMainService,
			{ isConnectionMetered: false, onDidChangeIsConnectionMetered: Event.None } as unknown as IMeteredConnectionService,
			false
		);
		this.quality = 'alpha';
	}

	protected buildUpdateFeedUrl(quality: string, commit: string, options?: IUpdateURLOptions): string {
		return createUpdateURL('https://feed.example', 'win32-x64-user', quality, commit, options);
	}

	protected doCheckForUpdates(): void { }

	isLatest(commit?: string) {
		return this.doIsLatestVersion(commit);
	}
}

suite('eddy update feed', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

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

	test('a downloaded update is the latest while the feed names its commit (no endless re-download)', async () => {
		const manifest = { version: 'alpha2', productVersion: '1.0.0-alpha.2', url: 'https://feed.example/setup.exe' };
		const service = store.add(new StaticFeedUpdateService(manifest, 'alpha1'));

		// The running build (alpha1) is outdated...
		assert.strictEqual(await service.isLatest(), false);
		// ...but the pending update (alpha2) is the latest, so it must not be thrown away and downloaded again.
		assert.strictEqual(await service.isLatest('alpha2'), true);
	});
});
