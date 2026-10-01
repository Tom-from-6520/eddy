/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/contexts.css';
import { $, append } from '../../../../base/browser/dom.js';
import { IListRenderer, IListVirtualDelegate } from '../../../../base/browser/ui/list/list.js';
import { toAction } from '../../../../base/common/actions.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { localize, localize2 } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { WorkbenchList } from '../../../../platform/list/browser/listService.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IViewPaneOptions, ViewPane } from '../../../browser/parts/views/viewPane.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { CONTEXTS_VIEW_ID, IContextsService, IWorkContext } from '../common/contexts.js';
import { DELETE_CONTEXT_COMMAND_ID, RENAME_CONTEXT_COMMAND_ID, SWITCH_CONTEXT_COMMAND_ID } from './contextsActions.js';

const ROW_HEIGHT = 26;

class ContextsDelegate implements IListVirtualDelegate<IWorkContext> {
	getHeight(): number { return ROW_HEIGHT; }
	getTemplateId(): string { return ContextRenderer.TEMPLATE_ID; }
}

interface IContextTemplate {
	readonly row: HTMLElement;
	readonly icon: HTMLElement;
	readonly name: HTMLElement;
}

class ContextRenderer implements IListRenderer<IWorkContext, IContextTemplate> {
	static readonly TEMPLATE_ID = 'context';
	readonly templateId = ContextRenderer.TEMPLATE_ID;

	constructor(private readonly _contextsService: IContextsService) { }

	renderTemplate(container: HTMLElement): IContextTemplate {
		const row = append(container, $('.context-row'));
		const icon = append(row, $('span.context-icon'));
		const name = append(row, $('span.context-name'));
		return { row, icon, name };
	}

	renderElement(context: IWorkContext, _index: number, template: IContextTemplate): void {
		const isActive = context.id === this._contextsService.activeContext.id;
		template.row.classList.toggle('active', isActive);
		template.icon.className = 'context-icon';
		template.icon.classList.add(...ThemeIcon.asClassNameArray(isActive ? Codicon.circleFilled : Codicon.circleOutline));
		template.name.textContent = context.name;
		template.row.title = isActive
			? localize('contexts.activeTooltip', "{0} (active)", context.name)
			: localize('contexts.switchTooltip', "Switch to {0}", context.name);
	}

	disposeTemplate(): void { }
}

export class ContextsViewPane extends ViewPane {

	static readonly ID = CONTEXTS_VIEW_ID;
	static readonly NAME = localize2('contexts.board', "Contexts");

	private _list: WorkbenchList<IWorkContext> | undefined;

	constructor(
		options: IViewPaneOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IOpenerService openerService: IOpenerService,
		@IThemeService themeService: IThemeService,
		@IHoverService hoverService: IHoverService,
		@IContextsService private readonly _contextsService: IContextsService,
		@ICommandService private readonly _commandService: ICommandService,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);

		const list = this._list = this._register(this.instantiationService.createInstance(
			WorkbenchList<IWorkContext>,
			'ContextsBoard',
			append(container, $('.contexts-board')),
			new ContextsDelegate(),
			[new ContextRenderer(this._contextsService)],
			{
				multipleSelectionSupport: false,
				horizontalScrolling: false,
				openOnSingleClick: true,
				identityProvider: { getId: (c: IWorkContext) => c.id },
				accessibilityProvider: {
					getAriaLabel: (c: IWorkContext | null) => c
						? (c.id === this._contextsService.activeContext.id ? localize('contexts.ariaActive', "{0}, active context", c.name) : c.name)
						: '',
					getWidgetAriaLabel: () => localize('contexts.ariaList', "Contexts"),
				},
			}
		));

		this._register(list.onDidOpen(e => {
			if (e.element) {
				this._commandService.executeCommand(SWITCH_CONTEXT_COMMAND_ID, e.element.id);
			}
		}));

		this._register(list.onContextMenu(e => {
			const context = e.element;
			if (!context) {
				return;
			}
			this.contextMenuService.showContextMenu({
				getAnchor: () => e.anchor,
				getActions: () => [
					toAction({ id: 'contexts.ctx.switch', label: localize('contexts.menu.switch', "Switch to Context"), enabled: context.id !== this._contextsService.activeContext.id, run: () => this._commandService.executeCommand(SWITCH_CONTEXT_COMMAND_ID, context.id) }),
					toAction({ id: 'contexts.ctx.rename', label: localize('contexts.menu.rename', "Rename..."), run: () => this._commandService.executeCommand(RENAME_CONTEXT_COMMAND_ID, context.id) }),
					toAction({ id: 'contexts.ctx.delete', label: localize('contexts.menu.delete', "Delete"), enabled: this._contextsService.contexts.length > 1, run: () => this._commandService.executeCommand(DELETE_CONTEXT_COMMAND_ID, context.id) }),
				],
			});
		}));

		this._register(this._contextsService.onDidChange(() => this._refresh()));
		this._refresh();
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		this._list?.layout(height, width);
	}

	private _refresh(): void {
		this._list?.splice(0, this._list.length, [...this._contextsService.contexts]);
	}
}
