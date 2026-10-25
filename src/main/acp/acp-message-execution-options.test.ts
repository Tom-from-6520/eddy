import { describe, expect, it, vi } from 'vitest'
import { applyAcpMessageOptions } from './acp-message-execution-options'
import { GENERIC_ACP_DIALECT } from './acp-dialects/acp-dialect'
import { AcpStructuredOptions } from './acp-structured-options'
import type { AcpStructuredSession } from './acp-structured-session'
import type { SessionConfigOption } from './generated/acp-protocol.generated'

function modelOption(current: string): SessionConfigOption {
  return {
    id: 'model',
    name: 'Model',
    category: 'model',
    type: 'select',
    currentValue: current,
    options: [
      { value: 'model-a', name: 'Model A' },
      { value: 'model-b', name: 'Model B' }
    ]
  }
}

const effortOption: SessionConfigOption = {
  id: 'reasoning_effort',
  name: 'Effort',
  category: 'thought_level',
  type: 'select',
  currentValue: 'medium',
  options: [
    { value: 'medium', name: 'Medium' },
    { value: 'high', name: 'High' }
  ]
}

/** A session running model-b with an effort option, whose model writes report `afterModel`. */
function sessionOn(afterModel: (model: string) => SessionConfigOption[]) {
  const options = new AcpStructuredOptions()
  options.adoptSession({ configOptions: [modelOption('model-b'), effortOption] }, 'new')
  const session = {
    options,
    spec: { dialect: GENERIC_ACP_DIALECT }
  } as unknown as AcpStructuredSession
  const setOption = vi.fn(async (key: 'model' | 'effort', value: string) => {
    if (key === 'model') {
      options.adoptConfigOptions(afterModel(value))
    }
  })
  return { session, setOption }
}

// eddy: an effort kept from another model must not refuse a message to a model without one.
describe('ACP message options', () => {
  it('drops an effort the newly picked model gives no option for', async () => {
    const { session, setOption } = sessionOn((model) => [modelOption(model)])
    await expect(
      applyAcpMessageOptions(session, { model: 'model-a', effort: 'high' }, setOption, () => true)
    ).resolves.toBe(true)
    expect(setOption.mock.calls).toEqual([['model', 'model-a']])
  })

  it('writes the effort where the newly picked model offers one', async () => {
    const { session, setOption } = sessionOn((model) => [modelOption(model), effortOption])
    await expect(
      applyAcpMessageOptions(session, { model: 'model-a', effort: 'high' }, setOption, () => true)
    ).resolves.toBe(true)
    expect(setOption.mock.calls).toEqual([
      ['model', 'model-a'],
      ['effort', 'high']
    ])
  })
})
