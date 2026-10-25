// eddy: repairs model lists saved before the fix that records an ACP session's effort menu only
// for the model it runs (eddy/DESIGN.md O28). Such a list says every other model has no efforts,
// so a chat whose saved effort belongs to one is refused at create, and no chat starts to replace
// the list.

import type { AgentModelCatalogListing } from '../native-chat/agent-model-catalog/agent-model-catalog-entry'

/** ACP agents whose models only a chat session lists: nothing else ever replaces a saved list. */
const SESSION_LISTED_ACP_AGENTS: ReadonlySet<string> = new Set(['copilot', 'antigravity'])

/** A session-listed menu where some models have efforts and others none: the empty ones are
 *  models the session didn't run, so their efforts are unknown rather than absent. */
export function repairSavedAcpEffortMenus(
  agent: string,
  listing: AgentModelCatalogListing | null
): AgentModelCatalogListing | null {
  if (
    !listing ||
    listing.origin !== 'live-session' ||
    !SESSION_LISTED_ACP_AGENTS.has(agent) ||
    !listing.models.some((model) => model.efforts.length > 0)
  ) {
    return listing
  }
  return {
    ...listing,
    models: listing.models.map((model) =>
      model.efforts.length === 0 && model.effortsKnown !== false
        ? { ...model, effortsKnown: false as const }
        : model
    )
  }
}
