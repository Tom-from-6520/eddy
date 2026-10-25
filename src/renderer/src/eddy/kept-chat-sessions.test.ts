import { afterEach, describe, expect, it } from 'vitest'
import {
  archiveKeptChatSession,
  keepClosedChatSession,
  parseKeptChatSessions,
  readKeptChatSessions,
  removeKeptChatSession,
  resetKeptChatSessionsForTests,
  selectClosedKeptChatSessions,
  upsertKeptChatSession,
  type KeptChatSession
} from './kept-chat-sessions'
import type { Tab } from '../../../shared/tab-types'

function kept(sessionId: string, closedAt: number, worktreeId = 'wt-1'): KeptChatSession {
  return { sessionId, worktreeId, title: `chat ${sessionId}`, agent: 'claude', closedAt }
}

describe('kept chat sessions', () => {
  afterEach(() => {
    resetKeptChatSessionsForTests()
  })

  it('lists the newest close first and moves a re-closed chat back to the top', () => {
    let state = upsertKeptChatSession({}, kept('a', 1))
    state = upsertKeptChatSession(state, kept('b', 2))
    state = upsertKeptChatSession(state, { ...kept('a', 3), title: 'renamed' })
    expect(state['wt-1']?.map((s) => [s.sessionId, s.title])).toEqual([
      ['a', 'renamed'],
      ['b', 'chat b']
    ])
  })

  it('archives only the named chat and drops an emptied workspace', () => {
    let state = upsertKeptChatSession({}, kept('a', 1))
    state = upsertKeptChatSession(state, kept('b', 2, 'wt-2'))
    state = removeKeptChatSession(state, 'wt-1', 'a')
    expect(state).toEqual({ 'wt-2': [kept('b', 2, 'wt-2')] })
    expect(removeKeptChatSession(state, 'wt-2', 'missing')).toBe(state)
  })

  it('parses persisted entries and skips malformed ones', () => {
    const raw = JSON.stringify([kept('a', 1), { sessionId: 'x' }, 'junk', kept('b', 2, 'wt-2')])
    expect(parseKeptChatSessions(raw)).toEqual({
      'wt-1': [kept('a', 1)],
      'wt-2': [kept('b', 2, 'wt-2')]
    })
    expect(parseKeptChatSessions('{not json')).toEqual({})
    expect(parseKeptChatSessions(null)).toEqual({})
  })

  it('keeps and archives through the module store', () => {
    keepClosedChatSession(kept('a', 1))
    keepClosedChatSession(kept('b', 2))
    expect(readKeptChatSessions('wt-1').map((s) => s.sessionId)).toEqual(['b', 'a'])
    archiveKeptChatSession('wt-1', 'b')
    expect(readKeptChatSessions('wt-1').map((s) => s.sessionId)).toEqual(['a'])
    expect(readKeptChatSessions('wt-other')).toEqual([])
  })

  it('hides kept chats whose tab is open again', () => {
    const openTab: Tab = {
      id: 'agent-session:a',
      entityId: 'a',
      groupId: 'g',
      worktreeId: 'wt-1',
      contentType: 'agent-session',
      label: 'chat a',
      customLabel: null,
      color: null,
      sortOrder: 0,
      createdAt: 0
    }
    const sessions = [kept('a', 2), kept('b', 1)]
    expect(selectClosedKeptChatSessions(sessions, [openTab]).map((s) => s.sessionId)).toEqual(['b'])
    expect(selectClosedKeptChatSessions(sessions, [])).toEqual(sessions)
  })
})
