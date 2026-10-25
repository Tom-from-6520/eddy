import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Tab } from '../../../shared/tab-types'
import { createTestStore, makeWorktree, seedStore } from '../store/slices/store-test-helpers'
import { readKeptChatSessions, resetKeptChatSessionsForTests } from './kept-chat-sessions'

const mocks = vi.hoisted(() => ({ beginClose: vi.fn() }))

vi.mock('sonner', () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn(), warning: vi.fn() }
}))
vi.mock('@/runtime/structured-agent-session-tab-retirement', () => ({
  beginStructuredAgentSessionTabClose: mocks.beginClose
}))

const WORKTREE = 'repo-1::/work/app'

function chatTab(): Tab {
  return {
    id: 'agent-session:chat-1',
    entityId: 'chat-1',
    groupId: 'group-1',
    worktreeId: WORKTREE,
    contentType: 'agent-session',
    agentSessionAgent: 'claude',
    label: 'Investigate flaky test',
    customLabel: null,
    color: null,
    sortOrder: 0,
    createdAt: 1,
    executionHostId: 'local'
  }
}

function storeWithChat(): ReturnType<typeof createTestStore> {
  const tab = chatTab()
  const store = createTestStore()
  seedStore(store, {
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: owner resolution reads only the repo id.
    repos: [{ id: 'repo-1', path: '/work/app', name: 'app' }] as never,
    worktreesByRepo: {
      'repo-1': [
        makeWorktree({ id: WORKTREE, repoId: 'repo-1', path: '/work/app', hostId: 'local' })
      ]
    },
    activeWorktreeId: WORKTREE,
    unifiedTabsByWorktree: { [WORKTREE]: [tab] },
    groupsByWorktree: {
      [WORKTREE]: [{ id: 'group-1', worktreeId: WORKTREE, activeTabId: tab.id, tabOrder: [tab.id] }]
    }
  })
  return store
}

beforeEach(() => {
  mocks.beginClose.mockReset()
  resetKeptChatSessionsForTests()
})

describe('closing a native chat tab', () => {
  it('keeps the chat listed under its workspace', () => {
    const store = storeWithChat()

    store.getState().closeUnifiedTab('agent-session:chat-1')

    expect(mocks.beginClose).toHaveBeenCalled()
    expect(readKeptChatSessions(WORKTREE)).toEqual([
      expect.objectContaining({
        sessionId: 'chat-1',
        worktreeId: WORKTREE,
        title: 'Investigate flaky test',
        agent: 'claude'
      })
    ])
  })

  it('does not keep chats closed by teardown or replacement', () => {
    const store = storeWithChat()

    store.getState().closeUnifiedTab('agent-session:chat-1', { recordInteraction: false })

    expect(readKeptChatSessions(WORKTREE)).toEqual([])
  })
})
