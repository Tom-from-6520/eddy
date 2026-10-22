import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import type { AgentJournalMessageItem } from '../../shared/agent-session-journal-types'
import {
  closeProviderTimelineRigs,
  SESSION
} from '../native-chat/agent-session-timeline/provider-timeline-assembler-test-support'
import { acpLaunchSpecFor } from '../acp/acp-launch-specs'
import type { AcpScriptedAgent } from '../acp/acp-scripted-agent.test-support'
import {
  openAcpAdapterRig,
  waitFor,
  type AcpAdapterRig
} from '../acp/acp-structured-adapter.test-support'
import { readAcpFixture } from '../acp/acp-timeline-fixture.test-support'
import {
  NewSessionResponseSchema,
  type SessionConfigOption
} from '../acp/generated/acp-protocol.generated'
import { sendsWithheldAcpCommand } from './acp-ask-guard'

afterEach(async () => {
  await closeProviderTimelineRigs()
})

const COPILOT = acpLaunchSpecFor('copilot')!
const AUTOPILOT = 'https://agentclientprotocol.com/protocol/session-modes#autopilot'
const AGENT = 'https://agentclientprotocol.com/protocol/session-modes#agent'
const setConfigSchema = z.object({ configId: z.string(), value: z.string() })

/** The config options Copilot 1.0.98 reported for a new session: mode agent, allow_all off. */
async function recordedConfigOptions(): Promise<SessionConfigOption[]> {
  const frames = await readAcpFixture('copilot-v1-handshake')
  const response = NewSessionResponseSchema.parse(
    frames.find((frame) => frame.direction === 'in' && frame.message.id === 2)?.message.result
  )
  return response.configOptions ?? []
}

function withValues(
  options: readonly SessionConfigOption[],
  values: Readonly<Record<string, string>>
): SessionConfigOption[] {
  return options.map((option) => {
    const value = values[option.id]
    return option.type === 'select' && value !== undefined
      ? { ...option, currentValue: value }
      : option
  })
}

const valuesOf = (options: readonly SessionConfigOption[]) =>
  Object.fromEntries(options.map((option) => [option.id, option.currentValue]))

/** A Copilot that starts on `start` and applies each config write, or ignores them when `refuses`. */
function copilotAgent(start: SessionConfigOption[], refuses = false) {
  const state = { options: start }
  const script = (agent: AcpScriptedAgent): void => {
    agent.on('session/new', (frame) =>
      agent.reply(frame, { sessionId: 'copilot-1', configOptions: state.options })
    )
    agent.on('session/set_config_option', (frame) => {
      const { configId, value } = setConfigSchema.parse(frame.params)
      if (!refuses) {
        state.options = withValues(state.options, { [configId]: value })
      }
      agent.reply(frame, { configOptions: state.options })
    })
  }
  return { state, script }
}

const writes = (rig: AcpAdapterRig) =>
  rig.sent('session/set_config_option').map((frame) => setConfigSchema.parse(frame.params))

function logger() {
  return { warn: vi.fn(), error: vi.fn() }
}

function reportOptions(rig: AcpAdapterRig, options: SessionConfigOption[]): void {
  rig.child().agent.notify('session/update', {
    sessionId: 'copilot-1',
    update: { sessionUpdate: 'config_option_update', configOptions: options }
  })
}

describe('withheld agent commands', () => {
  it('refuses a message whose text names one, arguments and letter case aside', () => {
    const withheld = ['allow-all', 'autopilot', 'permissions']
    const message = (...texts: string[]): Pick<AgentJournalMessageItem, 'blocks'> => ({
      blocks: texts.map((text) => ({ type: 'text', text }))
    })
    expect(
      [
        message('/allow-all'),
        message('/allow-all on'),
        message('  /Autopilot fix the failing tests --max-ai-credits 5'),
        message('/permissions allow-all'),
        message('look at this', '/allow-all on'),
        message('/allow-all\nand then fix it'),
        message('/compact'),
        message('please explain what /allow-all does'),
        message('/allow-allx'),
        message('')
      ].map((body) => sendsWithheldAcpCommand(body, withheld))
    ).toEqual([true, true, true, true, true, true, false, false, false, false])
  })

  it('refuses /allow-all on before it reaches Copilot', async () => {
    const { script } = copilotAgent(await recordedConfigOptions())
    const rig = await openAcpAdapterRig({ spec: COPILOT, script, deps: { logger: logger() } })
    await rig.acquire()
    const outcome = await rig.adapter.dispatch({
      sessionId: SESSION,
      clientMessageId: 'send-1',
      body: { kind: 'message', role: 'user', blocks: [{ type: 'text', text: '/allow-all on' }] },
      fence: 1
    })
    expect(outcome.state).toBe('rejected')
    expect(rig.sent('session/prompt')).toEqual([])
  })
})

describe('Copilot Ask guard at start', () => {
  it('turns autopilot and allow-all off before an Ask chat starts', async () => {
    const recorded = await recordedConfigOptions()
    const { state, script } = copilotAgent(
      withValues(recorded, { mode: AUTOPILOT, allow_all: 'on' })
    )
    const rig = await openAcpAdapterRig({ spec: COPILOT, script, deps: { logger: logger() } })
    await rig.acquire()
    expect(writes(rig)).toEqual([
      { configId: 'mode', value: AGENT },
      { configId: 'allow_all', value: 'off' }
    ])
    expect(valuesOf(state.options)).toMatchObject({ mode: AGENT, allow_all: 'off' })
  })

  it('writes nothing when Copilot already asks', async () => {
    const { script } = copilotAgent(await recordedConfigOptions())
    const rig = await openAcpAdapterRig({ spec: COPILOT, script, deps: { logger: logger() } })
    await rig.acquire()
    expect(writes(rig)).toEqual([])
  })

  it('leaves a Full access chat as Copilot has it', async () => {
    const recorded = await recordedConfigOptions()
    const { script } = copilotAgent(withValues(recorded, { allow_all: 'on' }))
    const rig = await openAcpAdapterRig({ spec: COPILOT, script, deps: { logger: logger() } })
    await rig.acquire({ permissionMode: 'full-access' })
    expect(writes(rig)).toEqual([])
  })

  it('fails the start when Copilot will not turn allow-all off', async () => {
    const recorded = await recordedConfigOptions()
    const { script } = copilotAgent(withValues(recorded, { allow_all: 'on' }), true)
    const rig = await openAcpAdapterRig({ spec: COPILOT, script, deps: { logger: logger() } })
    await rig.acquire()
    expect(rig.openFailure()).toMatchObject({ message: 'GitHub Copilot could not be kept on Ask' })
    expect(rig.child().closes).toBe(1)
  })
})

describe('Copilot Ask guard while the chat runs', () => {
  it('turns allow-all back off when Copilot reports it on', async () => {
    const recorded = await recordedConfigOptions()
    const { state, script } = copilotAgent(recorded)
    const log = logger()
    const rig = await openAcpAdapterRig({ spec: COPILOT, script, deps: { logger: log } })
    await rig.acquire()
    state.options = withValues(recorded, { allow_all: 'on' })
    reportOptions(rig, state.options)
    await waitFor(() => expect(writes(rig)).toEqual([{ configId: 'allow_all', value: 'off' }]))
    await waitFor(() => expect(valuesOf(state.options)).toMatchObject({ allow_all: 'off' }))
    expect(log.warn).toHaveBeenCalledWith(
      'GitHub Copilot approved for the person in an Ask chat; restoring Ask',
      expect.objectContaining({ scope: 'eddy-acp-ask-guard', switches: 'allow_all' })
    )
  })

  it('leaves autopilot when Copilot reports moving to it', async () => {
    const { script } = copilotAgent(await recordedConfigOptions())
    const rig = await openAcpAdapterRig({ spec: COPILOT, script, deps: { logger: logger() } })
    await rig.acquire()
    rig.child().agent.notify('session/update', {
      sessionId: 'copilot-1',
      update: { sessionUpdate: 'current_mode_update', currentModeId: AUTOPILOT }
    })
    await waitFor(() => expect(writes(rig)).toEqual([{ configId: 'mode', value: AGENT }]))
  })

  it('ends the chat when Copilot keeps approving for the person', async () => {
    const recorded = await recordedConfigOptions()
    const { state, script } = copilotAgent(recorded, true)
    const log = logger()
    const rig = await openAcpAdapterRig({ spec: COPILOT, script, deps: { logger: log } })
    await rig.acquire()
    state.options = withValues(recorded, { allow_all: 'on' })
    reportOptions(rig, state.options)
    await waitFor(() => expect(rig.child().closes).toBe(1))
    expect(log.error).toHaveBeenCalledWith(
      'GitHub Copilot could not be kept on Ask; ending the chat',
      expect.objectContaining({ scope: 'eddy-acp-ask-guard' })
    )
  })

  it('ignores the same report in a Full access chat', async () => {
    const recorded = await recordedConfigOptions()
    const { script } = copilotAgent(recorded)
    const rig = await openAcpAdapterRig({ spec: COPILOT, script, deps: { logger: logger() } })
    await rig.acquire({ permissionMode: 'full-access' })
    reportOptions(rig, withValues(recorded, { allow_all: 'on' }))
    await rig.settle()
    expect(writes(rig)).toEqual([])
  })
})
