/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from '../../../../base/common/codicons.js';
import { KeyCode, KeyMod } from '../../../../base/common/keyCodes.js';
import Severity from '../../../../base/common/severity.js';
import { localize, localize2 } from '../../../../nls.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { KeybindingWeight } from '../../../../platform/keybinding/common/keybindingsRegistry.js';
import { IQuickInputService, IQuickPickItem } from '../../../../platform/quickinput/common/quickInput.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { CONTEXTS_VIEW_ID, ContextsCountContext, IContextsService, IWorkContext } from '../common/contexts.js';

export const NEW_CONTEXT_COMMAND_ID = 'contextIde.newContext';
export const SWITCH_CONTEXT_COMMAND_ID = 'contextIde.switchContext';
export const RENAME_CONTEXT_COMMAND_ID = 'contextIde.renameContext';
export const DELETE_CONTEXT_COMMAND_ID = 'contextIde.deleteContext';

const category = localize2('contexts.category', "Contexts");

/**
 * Unsaved editors cannot be stored in a working set: applying another
 * working set keeps them open, so they would silently follow the user.
 * Ask first. Returns `false` if the user cancelled or saving failed.
 */
async function confirmUnsavedEditors(editorService: IEditorService, dialogService: IDialogService): Promise<boolean> {
	const dirtyCount = editorService.editors.filter(e => e.isDirty()).length;
	if (dirtyCount === 0) {
		return true;
	}

	const { result } = await dialogService.prompt<'save' | 'carry'>({
		type: Severity.Warning,
		message: dirtyCount === 1
			? localize('contexts.unsaved.one', "1 editor has unsaved changes.")
			: localize('contexts.unsaved.many', "{0} editors have unsaved changes.", dirtyCount),
		detail: localize('contexts.unsaved.detail', "Unsaved editors can't be kept in a Context. If you switch without saving, they stay open and move to the next Context."),
		buttons: [
			{ label: localize({ key: 'contexts.unsaved.save', comment: ['&& denotes a mnemonic'] }, "&&Save All and Switch"), run: () => 'save' },
			{ label: localize({ key: 'contexts.unsaved.carry', comment: ['&& denotes a mnemonic'] }, "Switch and &&Bring Them Along"), run: () => 'carry' },
		],
		cancelButton: true,
	});

	if (result === 'save') {
		const { success } = await editorService.saveAll();
		return success;
	}
	return result === 'carry';
}

interface IContextPick extends IQuickPickItem {
	readonly context?: IWorkContext;
}

function pickContext(contextsService: IContextsService, quickInputService: IQuickInputService, placeHolder: string, includeNew: boolean): Promise<IContextPick | undefined> {
	const activeId = contextsService.activeContext.id;
	const picks: IContextPick[] = contextsService.contexts.map(c => ({
		label: c.name,
		description: c.id === activeId ? localize('contexts.pick.active', "active") : undefined,
		context: c,
	}));
	if (includeNew) {
		picks.push({ label: `$(add) ${localize('contexts.pick.new', "New Context...")}` });
	}
	return quickInputService.pick(picks, { placeHolder });
}

registerAction2(class NewContextAction extends Action2 {
	constructor() {
		super({
			id: NEW_CONTEXT_COMMAND_ID,
			title: localize2('contexts.new', "New Context..."),
			category,
			icon: Codicon.add,
			f1: true,
			menu: { id: MenuId.ViewTitle, when: ContextKeyExpr.equals('view', CONTEXTS_VIEW_ID), group: 'navigation', order: 1 },
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const contextsService = accessor.get(IContextsService);
		const quickInputService = accessor.get(IQuickInputService);
		const editorService = accessor.get(IEditorService);
		const dialogService = accessor.get(IDialogService);

		const name = await quickInputService.input({
			prompt: localize('contexts.new.prompt', "Name the new Context (e.g. a feature, bug or incident)"),
			value: localize('contexts.new.default', "Context {0}", contextsService.contexts.length + 1),
			validateInput: async v => v.trim() ? undefined : localize('contexts.name.empty', "Name can't be empty"),
		});
		if (name === undefined || !await confirmUnsavedEditors(editorService, dialogService)) {
			return;
		}
		await contextsService.createContext(name);
	}
});

registerAction2(class SwitchContextAction extends Action2 {
	constructor() {
		super({
			id: SWITCH_CONTEXT_COMMAND_ID,
			title: localize2('contexts.switch', "Switch Context..."),
			category,
			f1: true,
			keybinding: { weight: KeybindingWeight.WorkbenchContrib, primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.KeyX },
		});
	}

	async run(accessor: ServicesAccessor, contextId?: unknown): Promise<void> {
		const contextsService = accessor.get(IContextsService);
		const quickInputService = accessor.get(IQuickInputService);
		const editorService = accessor.get(IEditorService);
		const dialogService = accessor.get(IDialogService);
		const commandService = accessor.get(ICommandService);

		let targetId = typeof contextId === 'string' ? contextId : undefined;
		if (!targetId) {
			const pick = await pickContext(contextsService, quickInputService, localize('contexts.switch.placeholder', "Select a Context to switch to"), true);
			if (!pick) {
				return;
			}
			if (!pick.context) {
				await commandService.executeCommand(NEW_CONTEXT_COMMAND_ID);
				return;
			}
			targetId = pick.context.id;
		}

		if (targetId === contextsService.activeContext.id || !await confirmUnsavedEditors(editorService, dialogService)) {
			return;
		}
		await contextsService.switchContext(targetId);
	}
});

registerAction2(class RenameContextAction extends Action2 {
	constructor() {
		super({
			id: RENAME_CONTEXT_COMMAND_ID,
			title: localize2('contexts.rename', "Rename Context..."),
			category,
			f1: true,
		});
	}

	async run(accessor: ServicesAccessor, contextId?: unknown): Promise<void> {
		const contextsService = accessor.get(IContextsService);
		const quickInputService = accessor.get(IQuickInputService);

		const context = contextsService.contexts.find(c => c.id === contextId) ?? contextsService.activeContext;
		const name = await quickInputService.input({
			prompt: localize('contexts.rename.prompt', "Rename Context"),
			value: context.name,
			validateInput: async v => v.trim() ? undefined : localize('contexts.name.empty', "Name can't be empty"),
		});
		if (name !== undefined) {
			contextsService.renameContext(context.id, name);
		}
	}
});

registerAction2(class DeleteContextAction extends Action2 {
	constructor() {
		super({
			id: DELETE_CONTEXT_COMMAND_ID,
			title: localize2('contexts.delete', "Delete Context..."),
			category,
			f1: true,
			precondition: ContextsCountContext.greater(1),
		});
	}

	async run(accessor: ServicesAccessor, contextId?: unknown): Promise<void> {
		const contextsService = accessor.get(IContextsService);
		const quickInputService = accessor.get(IQuickInputService);
		const editorService = accessor.get(IEditorService);
		const dialogService = accessor.get(IDialogService);

		let context = contextsService.contexts.find(c => c.id === contextId);
		if (!context) {
			context = (await pickContext(contextsService, quickInputService, localize('contexts.delete.placeholder', "Select a Context to delete"), false))?.context;
			if (!context) {
				return;
			}
		}

		const isActive = context.id === contextsService.activeContext.id;
		const { confirmed } = await dialogService.confirm({
			type: Severity.Warning,
			message: localize('contexts.delete.confirm', "Delete Context '{0}'?", context.name),
			detail: isActive
				? localize('contexts.delete.detailActive', "Its open editors will be closed and you'll switch to another Context. Files on disk are not affected.")
				: localize('contexts.delete.detail', "Its saved editor layout will be discarded. Files on disk are not affected."),
			primaryButton: localize({ key: 'contexts.delete.button', comment: ['&& denotes a mnemonic'] }, "&&Delete"),
		});
		if (!confirmed || (isActive && !await confirmUnsavedEditors(editorService, dialogService))) {
			return;
		}
		await contextsService.deleteContext(context.id);
	}
});
