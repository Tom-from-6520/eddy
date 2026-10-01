/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';

export const CONTEXTS_VIEW_CONTAINER_ID = 'workbench.view.contexts';
export const CONTEXTS_VIEW_ID = 'workbench.view.contexts.board';

export const ContextsCountContext = new RawContextKey<number>('contextIde.contextsCount', 0);

/**
 * A named unit of work. In M1 a Context owns its editor working set
 * (tabs + editor group layout); mounts, terminals and chats come later.
 */
export interface IWorkContext {
	readonly id: string;
	readonly name: string;
	readonly createdAt: number;
}

export const IContextsService = createDecorator<IContextsService>('contextIdeContextsService');

export interface IContextsService {
	readonly _serviceBrand: undefined;

	/** Fires when the list of Contexts, a name, or the active Context changes. */
	readonly onDidChange: Event<void>;

	readonly contexts: readonly IWorkContext[];
	readonly activeContext: IWorkContext;

	/** Creates a Context and switches to it (starting with no editors). */
	createContext(name: string): Promise<IWorkContext | undefined>;

	/**
	 * Saves the active Context's editors and restores the target's.
	 * @returns `false` if the Context does not exist or the editors could not be swapped.
	 */
	switchContext(id: string): Promise<boolean>;

	renameContext(id: string, name: string): void;

	/** Deletes a Context. Deleting the active one switches to the most recently created other Context first. The last Context cannot be deleted. */
	deleteContext(id: string): Promise<boolean>;
}
