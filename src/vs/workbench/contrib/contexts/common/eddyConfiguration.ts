/*---------------------------------------------------------------------------------------------
 *  Copyright (c) eddy contributors. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { ConfigurationScope, Extensions, IConfigurationRegistry } from '../../../../platform/configuration/common/configurationRegistry.js';
import { Registry } from '../../../../platform/registry/common/platform.js';

/** eddy-wide settings. Imported by both the Agents window and the editor window so the module registers once per window. */
Registry.as<IConfigurationRegistry>(Extensions.Configuration).registerConfiguration({
	id: 'eddy',
	title: localize('eddy.configurationTitle', "eddy"),
	type: 'object',
	properties: {
		'eddy.startupWindow': {
			type: 'string',
			enum: ['agents', 'editor'],
			enumDescriptions: [
				localize('eddy.startupWindow.agents', "Open the Agents window with your Working Contexts and threads."),
				localize('eddy.startupWindow.editor', "Open the editor window (restores previously opened folders)."),
			],
			default: 'agents',
			scope: ConfigurationScope.APPLICATION,
			description: localize('eddy.startupWindow', "Which window eddy opens when it starts without a file or folder."),
		},
	},
});
