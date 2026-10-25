import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createAgentModelCatalogFilePersistence } from '../native-chat/agent-model-catalog/agent-model-catalog-persistence'
import { assertAgentSessionOptionsAdmitted } from '../runtime/agent-session-record-options'
import { repairSavedAcpEffortMenus } from './acp-saved-effort-repair'

const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'].map((value) => ({ value, label: value }))

/** A list saved by a session that ran Sonnet: only Sonnet has a menu. */
const sonnetSessionListing = {
  origin: 'live-session' as const,
  at: 1,
  models: [
    { id: 'auto', label: 'Auto', isDefault: false, efforts: [] },
    { id: 'claude-sonnet-5.5', label: 'Claude Sonnet 5.5', isDefault: false, efforts: EFFORTS },
    { id: 'claude-opus-5.5', label: 'Claude Opus 5.5', isDefault: false, efforts: [] }
  ]
}

let directory: string | undefined
afterEach(async () => {
  if (directory) {
    await rm(directory, { recursive: true, force: true })
    directory = undefined
  }
})

describe('saved ACP effort menus', () => {
  it('admits a new Copilot chat on a model a saved list wrongly says has no efforts', async () => {
    directory = await mkdtemp(join(tmpdir(), 'eddy-catalog-'))
    await writeFile(
      join(directory, 'agent-model-catalog.json'),
      JSON.stringify({
        version: 3,
        entries: [
          { agent: 'copilot', fingerprint: 'f', discovered: null, live: sonnetSessionListing }
        ]
      })
    )
    const [entry] = await createAgentModelCatalogFilePersistence(directory).load()
    expect(() =>
      assertAgentSessionOptionsAdmitted('copilot', entry!.models, {
        model: 'claude-opus-5.5',
        effort: 'high'
      })
    ).not.toThrow()
    // The model the session ran keeps its known menu.
    expect(() =>
      assertAgentSessionOptionsAdmitted('copilot', entry!.models, {
        model: 'claude-sonnet-5.5',
        effort: 'ultra'
      })
    ).toThrow()
  })

  it('leaves agents with their own model listing, probes and effortless lists alone', () => {
    expect(repairSavedAcpEffortMenus('grok', sonnetSessionListing)).toBe(sonnetSessionListing)
    const probed = { ...sonnetSessionListing, origin: 'probe' as const }
    expect(repairSavedAcpEffortMenus('copilot', probed)).toBe(probed)
    const effortless = {
      ...sonnetSessionListing,
      models: sonnetSessionListing.models.map((model) => ({ ...model, efforts: [] }))
    }
    expect(repairSavedAcpEffortMenus('copilot', effortless)).toBe(effortless)
    expect(repairSavedAcpEffortMenus('copilot', null)).toBeNull()
  })
})
