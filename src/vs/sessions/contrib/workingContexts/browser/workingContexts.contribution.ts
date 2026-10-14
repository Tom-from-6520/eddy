/*---------------------------------------------------------------------------------------------
 *  Copyright (c) eddy contributors. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from '../../../../base/common/codicons.js';
import { localize, localize2 } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../../workbench/common/contributions.js';
import { Menus } from '../../../browser/menus.js';
import { ISessionGroupsService } from '../../../services/sessions/browser/sessionGroupsService.js';
import { ISessionsService } from '../../../services/sessions/browser/sessionsService.js';
import { IWorkingContextsService, WorkingContextsService } from './workingContexts.js';
import '../../../../workbench/contrib/contexts/common/eddyConfiguration.js';

registerSingleton(IWorkingContextsService, WorkingContextsService, InstantiationType.Delayed);

/** Instantiates the service at startup so it tracks the active context from the first thread on. */
class WorkingContextsContribution implements IWorkbenchContribution {
	static readonly ID = 'eddy.workingContexts';
	constructor(@IWorkingContextsService _service: IWorkingContextsService) { }
}
registerWorkbenchContribution2(WorkingContextsContribution.ID, WorkingContextsContribution, WorkbenchPhase.AfterRestored);

export const NEW_WORKING_CONTEXT_COMMAND_ID = 'eddy.workingContexts.new';

registerAction2(class NewWorkingContextAction extends Action2 {
	constructor() {
		super({
			id: NEW_WORKING_CONTEXT_COMMAND_ID,
			title: localize2('eddy.newWorkingContext', "New Working Context..."),
			icon: Codicon.newFolder,
			f1: true,
			menu: [{ id: Menus.SidebarSessionsHeader, group: 'navigation', order: 1 }],
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const quickInputService = accessor.get(IQuickInputService);
		const workingContextsService = accessor.get(IWorkingContextsService);
		const sessionsService = accessor.get(ISessionsService);
		const sessionGroupsService = accessor.get(ISessionGroupsService);

		const name = await quickInputService.input({
			prompt: localize('eddy.newWorkingContext.prompt', "Name the Working Context (a feature, bug, incident or investigation)"),
			placeHolder: localize('eddy.newWorkingContext.placeholder', "e.g. Incident 4521 – upstream data gap"),
			validateInput: async value => value.trim() ? undefined : localize('eddy.newWorkingContext.empty', "The name can't be empty."),
		});
		if (name === undefined) {
			return;
		}
		const contextId = await workingContextsService.createContext(name);

		// Start the context's first thread.
		await sessionsService.openNewSession();
		sessionGroupsService.setPendingNewSessionGroup(contextId);
	}
});
