import { useSyncExternalStore } from 'react'
import type { AgentType } from '../../../shared/agent-status-types'
import type { Tab } from '../../../shared/tab-types'
import { resolveUnifiedTabLabel } from '../../../shared/tab-title-resolution'

/**
 * Native chats the user closed in the layout but still wants listed under their workspace in the
 * sidebar. Closing a chat only hides its tab (the host keeps the record and journal on disk), so a
 * kept entry is a pointer the sidebar can reveal again; archiving drops the pointer, never the chat.
 */
export type KeptChatSession = {
  sessionId: string
  worktreeId: string
  title: string
  agent?: AgentType
  closedAt: number
}

export type KeptChatSessionsByWorktree = Readonly<Record<string, readonly KeptChatSession[]>>

const STORAGE_KEY = 'eddy:keptChatSessions:v1'
const MAX_KEPT_PER_WORKTREE = 50
const EMPTY: readonly KeptChatSession[] = Object.freeze([])

let sessionsByWorktree: KeptChatSessionsByWorktree = {}
let loaded = false
const listeners = new Set<() => void>()

function isKeptChatSession(value: unknown): value is KeptChatSession {
  if (!value || typeof value !== 'object') {
    return false
  }
  return (
    'sessionId' in value &&
    typeof value.sessionId === 'string' &&
    value.sessionId.length > 0 &&
    'worktreeId' in value &&
    typeof value.worktreeId === 'string' &&
    value.worktreeId.length > 0 &&
    'title' in value &&
    typeof value.title === 'string' &&
    'closedAt' in value &&
    typeof value.closedAt === 'number' &&
    (!('agent' in value) || value.agent === undefined || typeof value.agent === 'string')
  )
}

export function parseKeptChatSessions(raw: string | null): KeptChatSessionsByWorktree {
  if (!raw) {
    return {}
  }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return {}
    }
    let next: KeptChatSessionsByWorktree = {}
    for (const value of parsed) {
      if (isKeptChatSession(value)) {
        next = upsertKeptChatSession(next, value)
      }
    }
    return next
  } catch {
    return {}
  }
}

/** Newest close first; re-closing a reopened chat moves it to the top with its latest title. */
export function upsertKeptChatSession(
  current: KeptChatSessionsByWorktree,
  entry: KeptChatSession
): KeptChatSessionsByWorktree {
  const others = (current[entry.worktreeId] ?? EMPTY).filter(
    (kept) => kept.sessionId !== entry.sessionId
  )
  const list = [entry, ...others]
    .sort((a, b) => b.closedAt - a.closedAt)
    .slice(0, MAX_KEPT_PER_WORKTREE)
  return { ...current, [entry.worktreeId]: list }
}

export function removeKeptChatSession(
  current: KeptChatSessionsByWorktree,
  worktreeId: string,
  sessionId: string
): KeptChatSessionsByWorktree {
  const list = current[worktreeId]
  if (!list?.some((kept) => kept.sessionId === sessionId)) {
    return current
  }
  const remaining = list.filter((kept) => kept.sessionId !== sessionId)
  if (remaining.length > 0) {
    return { ...current, [worktreeId]: remaining }
  }
  const { [worktreeId]: _removed, ...rest } = current
  return rest
}

function load(): void {
  if (loaded) {
    return
  }
  loaded = true
  if (typeof localStorage === 'undefined') {
    return
  }
  try {
    sessionsByWorktree = parseKeptChatSessions(localStorage.getItem(STORAGE_KEY))
  } catch {
    console.warn('[eddy:kept-chat-sessions] could not read kept chats')
  }
}

function commit(next: KeptChatSessionsByWorktree): void {
  if (next === sessionsByWorktree) {
    return
  }
  sessionsByWorktree = next
  if (typeof localStorage !== 'undefined') {
    try {
      const all = Object.values(next).flat()
      if (all.length === 0) {
        localStorage.removeItem(STORAGE_KEY)
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
      }
    } catch {
      // Why: the list is a convenience; a failed write must never block closing a tab.
      console.warn('[eddy:kept-chat-sessions] could not persist kept chats')
    }
  }
  for (const listener of listeners) {
    listener()
  }
}

export function keepClosedChatSession(entry: KeptChatSession): void {
  load()
  commit(upsertKeptChatSession(sessionsByWorktree, entry))
}

/** Close hook: keep the native chat tab the user just closed. */
export function keepClosedChatTab(tab: Tab, worktreeId: string, autoGenerateTitle: boolean): void {
  keepClosedChatSession({
    sessionId: tab.entityId,
    worktreeId,
    title: resolveUnifiedTabLabel(tab, autoGenerateTitle),
    ...(tab.agentSessionAgent ? { agent: tab.agentSessionAgent } : {}),
    closedAt: Date.now()
  })
}

export function archiveKeptChatSession(worktreeId: string, sessionId: string): void {
  load()
  commit(removeKeptChatSession(sessionsByWorktree, worktreeId, sessionId))
}

export function readKeptChatSessions(worktreeId: string): readonly KeptChatSession[] {
  load()
  return sessionsByWorktree[worktreeId] ?? EMPTY
}

/** Kept chats whose tab is open are already listed as live agent rows. */
export function selectClosedKeptChatSessions(
  kept: readonly KeptChatSession[],
  tabs: readonly Pick<Tab, 'contentType' | 'entityId'>[]
): readonly KeptChatSession[] {
  if (kept.length === 0) {
    return kept
  }
  const openSessionIds = new Set(
    tabs.filter((tab) => tab.contentType === 'agent-session').map((tab) => tab.entityId)
  )
  return kept.filter((session) => !openSessionIds.has(session.sessionId))
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useKeptChatSessions(worktreeId: string): readonly KeptChatSession[] {
  const read = (): readonly KeptChatSession[] => readKeptChatSessions(worktreeId)
  return useSyncExternalStore(subscribe, read, read)
}

export function resetKeptChatSessionsForTests(): void {
  sessionsByWorktree = {}
  loaded = false
  listeners.clear()
}
