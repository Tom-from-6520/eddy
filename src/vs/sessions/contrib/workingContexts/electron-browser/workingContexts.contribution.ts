/*---------------------------------------------------------------------------------------------
 *  Copyright (c) eddy contributors. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from '../../../../base/common/codicons.js';
import { localize, localize2 } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { INativeHostService } from '../../../../platform/native/common/native.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { ISessionGroupItem, SessionGroupIsComparisonContext, SessionGroupToolbarMenuId } from '../../sessions/browser/views/sessionsList.js';
import { IWorkingContextsService } from '../browser/workingContexts.js';

registerAction2(class OpenWorkingContextFolderAction extends Action2 {
	constructor() {
		super({
			id: 'eddy.workingContexts.openFolder',
			title: localize2('eddy.openContextFolder', "Open Context Folder"),
			icon: Codicon.folderOpened,
			f1: true,
			menu: [{ id: SessionGroupToolbarMenuId, group: 'navigation', order: 0, when: SessionGroupIsComparisonContext.negate() }],
		});
	}

	async run(accessor: ServicesAccessor, context?: ISessionGroupItem): Promise<void> {
		const workingContextsService = accessor.get(IWorkingContextsService);
		const nativeHostService = accessor.get(INativeHostService);
		const notificationService = accessor.get(INotificationService);

		const contextId = context?.group.id ?? workingContextsService.activeContextId;
		const folder = contextId ? await workingContextsService.getContextFolder(contextId) : undefined;
		if (!folder) {
			notificationService.info(localize('eddy.openContextFolder.none', "Open a thread of a Working Context first, or use the folder button on a context."));
			return;
		}
		await nativeHostService.openExternal(folder.toString(true));
	}
});
