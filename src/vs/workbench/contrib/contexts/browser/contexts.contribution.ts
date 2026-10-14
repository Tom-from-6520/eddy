/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from '../../../../base/common/codicons.js';
import { Disposable, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { localize, localize2 } from '../../../../nls.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { ViewPaneContainer } from '../../../browser/parts/views/viewPaneContainer.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { Extensions as ViewExtensions, IViewContainersRegistry, IViewsRegistry, ViewContainerLocation } from '../../../common/views.js';
import { IStatusbarEntryAccessor, IStatusbarService, StatusbarAlignment } from '../../../services/statusbar/browser/statusbar.js';
import { CONTEXTS_VIEW_CONTAINER_ID, CONTEXTS_VIEW_ID, ContextsCountContext, IContextsService } from '../common/contexts.js';
import { SWITCH_CONTEXT_COMMAND_ID } from './contextsActions.js';
import { ContextsService } from './contextsService.js';
import { ContextsViewPane } from './contextsView.js';
import '../common/eddyConfiguration.js';

registerSingleton(IContextsService, ContextsService, InstantiationType.Delayed);

const contextsViewIcon = registerIcon('contexts-view-icon', Codicon.layers, localize('contextsViewIcon', "View icon of the Contexts board."));

const viewContainer = Registry.as<IViewContainersRegistry>(ViewExtensions.ViewContainersRegistry).registerViewContainer({
	id: CONTEXTS_VIEW_CONTAINER_ID,
	title: localize2('contexts', "Contexts"),
	icon: contextsViewIcon,
	ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [CONTEXTS_VIEW_CONTAINER_ID, { mergeViewWithContainerWhenSingleView: true }]),
	storageId: CONTEXTS_VIEW_CONTAINER_ID,
	// Before Explorer (order 0): the Context board is the first thing in the left bar (D7).
	order: -1,
	openCommandActionDescriptor: {
		id: CONTEXTS_VIEW_CONTAINER_ID,
		title: localize2('contexts', "Contexts"),
		order: -1,
	},
}, ViewContainerLocation.Sidebar);

Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry).registerViews([{
	id: CONTEXTS_VIEW_ID,
	name: ContextsViewPane.NAME,
	containerIcon: contextsViewIcon,
	ctorDescriptor: new SyncDescriptor(ContextsViewPane),
	canToggleVisibility: false,
	canMoveView: true,
}], viewContainer);

class ContextsStatusContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.contextsStatus';

	private readonly _entry = this._register(new MutableDisposable<IStatusbarEntryAccessor>());

	constructor(
		@IContextsService private readonly _contextsService: IContextsService,
		@IStatusbarService private readonly _statusbarService: IStatusbarService,
		@IContextKeyService contextKeyService: IContextKeyService,
	) {
		super();

		const countKey = ContextsCountContext.bindTo(contextKeyService);
		const update = () => {
			countKey.set(this._contextsService.contexts.length);
			this._updateEntry();
		};
		this._register(this._contextsService.onDidChange(update));
		update();
	}

	private _updateEntry(): void {
		const name = this._contextsService.activeContext.name;
		const entry = {
			name: localize('contexts.status.name', "Active Context"),
			text: `$(layers) ${name}`,
			ariaLabel: localize('contexts.status.aria', "Active Context: {0}", name),
			tooltip: localize('contexts.status.tooltip', "Active Context: {0}. Click to switch.", name),
			command: SWITCH_CONTEXT_COMMAND_ID,
		};
		if (this._entry.value) {
			this._entry.value.update(entry);
		} else {
			this._entry.value = this._statusbarService.addEntry(entry, 'status.contextIde.activeContext', StatusbarAlignment.LEFT, 10_000);
		}
	}
}

registerWorkbenchContribution2(ContextsStatusContribution.ID, ContextsStatusContribution, WorkbenchPhase.AfterRestored);
