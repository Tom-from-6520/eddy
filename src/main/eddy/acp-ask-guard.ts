// eddy: keeps a chat's Ask authoritative over an ACP agent's own approval switches (eddy/DESIGN.md
// O19). Copilot can approve for the person through `allow_all` or autopilot mode, which its slash
// commands and its own plan exit can turn on. A chat that is not in Full access withholds those
// commands, starts only once the agent confirms both switches are off, and switches them back off
// whenever the agent reports one on, ending the chat if the agent refuses.

import type { AgentChatPermissionMode } from '../../shared/agent-chat-permission-mode'
import type { AgentJournalMessageItem } from '../../shared/agent-session-journal-types'
import {
  createStructuredAgentSessionLogger,
  type StructuredAgentSessionLogger
} from '../native-chat/agent-session-wire/structured-agent-session-logger'
import { GENERIC_ACP_DIALECT, type AcpDialect } from '../acp/acp-dialects/acp-dialect'
import type { AcpSessionEvent } from '../acp/acp-session-events'
import { acpAgentName } from '../acp/acp-structured-agent-definitions'
import type { AcpStructuredSession } from '../acp/acp-structured-session'
import type { SessionConfigOption } from '../acp/generated/acp-protocol.generated'

/** One agent config option that can approve for the person: the values that do, and Ask's value. */
type AcpApprovalSwitch = { configId: string; approving: readonly string[]; ask: string }

type AcpAskGuard = {
  /** In write order: a mode that implies a switch goes before that switch. */
  switches: readonly AcpApprovalSwitch[]
  /** The agent's commands that only raise access; a chat never sends them. */
  withheldCommands: readonly string[]
}

const COPILOT_AUTOPILOT_MODE = 'https://agentclientprotocol.com/protocol/session-modes#autopilot'
const COPILOT_AGENT_MODE = 'https://agentclientprotocol.com/protocol/session-modes#agent'

const COPILOT_ASK_GUARD: AcpAskGuard = {
  switches: [
    // Autopilot "enables allow-all and runs until task completion without user interaction".
    { configId: 'mode', approving: [COPILOT_AUTOPILOT_MODE], ask: COPILOT_AGENT_MODE },
    { configId: 'allow_all', approving: ['on'], ask: 'off' }
  ],
  withheldCommands: ['allow-all', 'autopilot', 'permissions']
}

function acpAskGuardFor(agent: string): AcpAskGuard | null {
  return agent === 'copilot' ? COPILOT_ASK_GUARD : null
}

/** Copilot's ACP dialect: the shared one, without the commands that only raise access. */
export const COPILOT_ACP_DIALECT: AcpDialect = {
  ...GENERIC_ACP_DIALECT,
  withheldCommands: COPILOT_ASK_GUARD.withheldCommands
}

/** Whether `body` runs one of `withheld` as an agent command: a text block whose first word is
 *  `/name`, with or without arguments, in any letter case. */
export function sendsWithheldAcpCommand(
  body: Pick<AgentJournalMessageItem, 'blocks'>,
  withheld: readonly string[]
): boolean {
  return body.blocks.some((block) => {
    const name =
      block.type === 'text' ? /^\/(?<name>\S+)/.exec(block.text.trimStart())?.groups?.name : null
    return name !== null && name !== undefined && withheld.includes(name.toLowerCase())
  })
}

type AskWrite = { configId: string; value: string }

/** The writes that put `configOptions` back on Ask; a switch the agent does not list needs none. */
function acpAskWrites(
  guard: AcpAskGuard,
  configOptions: readonly SessionConfigOption[]
): AskWrite[] {
  return guard.switches.flatMap((entry) => {
    const current = configOptions.find((option) => option.id === entry.configId)?.currentValue
    return typeof current === 'string' && entry.approving.includes(current)
      ? [{ configId: entry.configId, value: entry.ask }]
      : []
  })
}

/** The writes an agent report asks for: its config options, or the mode it says it moved to. */
function reportedAskWrites(guard: AcpAskGuard, event: AcpSessionEvent): AskWrite[] {
  if (event.kind !== 'known') {
    return []
  }
  const { update } = event.notification
  if (update.sessionUpdate === 'config_option_update') {
    return acpAskWrites(guard, update.configOptions)
  }
  if (update.sessionUpdate === 'current_mode_update') {
    return guard.switches
      .filter(
        (entry) => entry.configId === 'mode' && entry.approving.includes(update.currentModeId)
      )
      .map((entry) => ({ configId: entry.configId, value: entry.ask }))
  }
  return []
}

type AskGuardedSession = Pick<
  AcpStructuredSession,
  'sessionId' | 'spec' | 'connection' | 'options'
> & { lane: AcpStructuredSession['lane'] | null }

async function restoreAsk(
  session: AskGuardedSession,
  guard: AcpAskGuard,
  writes: readonly AskWrite[]
): Promise<void> {
  let current: readonly SessionConfigOption[] | null = null
  for (const write of writes) {
    current = (await session.connection.setConfigOption(write.configId, write.value)).configOptions
    session.options.adoptConfigOptions([...current])
  }
  const left = current ? acpAskWrites(guard, current) : []
  if (left.length > 0) {
    throw new Error(`still approves for the person: ${left.map((write) => write.configId).join()}`)
  }
}

/**
 * Holds a started session to Ask, unless it runs Full access. At start a refusal fails the start,
 * as a permission mode the agent will not confirm does. Afterwards a reported switch is turned
 * back at once; the agent may approve a request in the moment before it lands.
 */
export async function guardAcpAsk(
  session: AskGuardedSession,
  permissionMode: AgentChatPermissionMode | undefined,
  logger: StructuredAgentSessionLogger = createStructuredAgentSessionLogger()
): Promise<void> {
  const guard = acpAskGuardFor(session.spec.agent)
  if (!guard || permissionMode === 'full-access') {
    return
  }
  const agentName = acpAgentName(session.spec.agent)
  try {
    await restoreAsk(session, guard, acpAskWrites(guard, session.options.readConfigOptions()))
  } catch (error) {
    session.lane?.dispose()
    throw new Error(`${agentName} could not be kept on Ask`, { cause: error })
  }
  const fields = { scope: 'eddy-acp-ask-guard', sessionId: session.sessionId }
  let restoring = false
  const restore = (writes: readonly AskWrite[]): void => {
    if (restoring || writes.length === 0) {
      return
    }
    restoring = true
    logger.warn(`${agentName} approved for the person in an Ask chat; restoring Ask`, {
      ...fields,
      switches: writes.map((write) => write.configId).join()
    })
    restoreAsk(session, guard, writes).then(
      () => {
        restoring = false
        // A report that arrived while this write ran is in what the session holds now.
        restore(acpAskWrites(guard, session.options.readConfigOptions()))
      },
      (error: unknown) => {
        logger.error(`${agentName} could not be kept on Ask; ending the chat`, { ...fields, error })
        void session.connection.close().catch(() => false)
      }
    )
  }
  session.connection.subscribe((event) => restore(reportedAskWrites(guard, event)))
}
