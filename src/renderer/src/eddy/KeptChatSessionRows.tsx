import React, { useCallback, useMemo } from 'react'
import { Trash2 } from 'lucide-react'
import { useAppStore } from '@/store'
import { AgentTypeIcon } from '@/lib/agent-type-icon'
import { useNow } from '@/hooks/use-now'
import { cn } from '@/lib/utils'
import { activateAiVaultStructuredSession } from '@/lib/activate-ai-vault-structured-session'
import type { Tab } from '../../../shared/tab-types'
import { formatCompactDuration } from '../../../shared/agent-row-decay-state'
import {
  archiveKeptChatSession,
  selectClosedKeptChatSessions,
  useKeptChatSessions,
  type KeptChatSession
} from './kept-chat-sessions'

const EMPTY_TABS: readonly Tab[] = Object.freeze([])

function formatClosedAgo(closedAt: number, now: number): string {
  const delta = now - closedAt
  return delta < 60_000 ? 'just now' : `${formatCompactDuration(delta)} ago`
}

/**
 * Closed native chats kept under their workspace card, below the live agent rows. Clicking one
 * reopens it from the host's record; the trash button only drops it from this list (the chat stays
 * in Agent Session History).
 */
export const KeptChatSessionRows = React.memo(function KeptChatSessionRows({
  worktreeId
}: {
  worktreeId: string
}): React.JSX.Element | null {
  const kept = useKeptChatSessions(worktreeId)
  const tabs = useAppStore((s) => s.unifiedTabsByWorktree?.[worktreeId] ?? EMPTY_TABS)
  const closed = useMemo(() => selectClosedKeptChatSessions(kept, tabs), [kept, tabs])
  if (closed.length === 0) {
    return null
  }
  return <KeptChatSessionRowsBody worktreeId={worktreeId} sessions={closed} />
})

function KeptChatSessionRowsBody({
  worktreeId,
  sessions
}: {
  worktreeId: string
  sessions: readonly KeptChatSession[]
}): React.JSX.Element {
  const now = useNow(30_000)
  const stopBubble = useCallback((event: React.SyntheticEvent) => {
    event.stopPropagation()
  }, [])
  return (
    // Why: swallow bubbling so row clicks don't reach WorktreeCard's activate / edit-meta handlers.
    <div
      className="mt-1 flex flex-col"
      onClick={stopBubble}
      onDoubleClick={stopBubble}
      onMouseDown={stopBubble}
      onPointerDown={stopBubble}
      role="group"
      aria-label="Closed chats"
      data-eddy-kept-chat-sessions=""
    >
      {sessions.map((session) => (
        <KeptChatSessionRow
          key={session.sessionId}
          session={session}
          now={now}
          worktreeId={worktreeId}
        />
      ))}
    </div>
  )
}

function KeptChatSessionRow({
  session,
  now,
  worktreeId
}: {
  session: KeptChatSession
  now: number
  worktreeId: string
}): React.JSX.Element {
  const title = session.title.trim() || 'Chat'
  const handleOpen = useCallback(() => {
    void activateAiVaultStructuredSession({
      structuredSession: { sessionId: session.sessionId, workspaceId: worktreeId }
    })
  }, [session.sessionId, worktreeId])
  const handleArchive = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation()
      archiveKeptChatSession(worktreeId, session.sessionId)
    },
    [session.sessionId, worktreeId]
  )
  const closedAgo = formatClosedAgo(session.closedAt, now)
  return (
    // Why: no role="button" — the nested trash button would violate ARIA nesting (as DashboardAgentRow).
    <div
      onClick={handleOpen}
      className={cn(
        'group/kept-chat relative -ml-2 flex items-center gap-1.5 px-2 py-1',
        'cursor-pointer rounded-sm worktree-agent-row-hover'
      )}
      title={`${title} • closed ${closedAgo} • click to reopen`}
    >
      {/* Why: a hollow dot in the state-dot gutter marks the chat as closed, not running. */}
      <span className="inline-flex size-2 shrink-0 items-center justify-center" aria-hidden>
        <span className="size-1.5 rounded-full border border-muted-foreground/50" />
      </span>
      <span className="inline-flex shrink-0 opacity-60">
        <AgentTypeIcon agentType={session.agent} size={14} />
      </span>
      <span className="block min-w-0 flex-1 truncate text-[11px] leading-snug text-muted-foreground/80">
        {title}
      </span>
      <span className="relative ml-auto grid h-5 shrink-0 grid-cols-1 grid-rows-1 items-center justify-items-end">
        <span
          className={cn(
            '[grid-area:1/1] pointer-events-none text-[10px] leading-none text-muted-foreground/60',
            'transition-opacity duration-150',
            'group-hover/kept-chat:opacity-0 [@media(hover:none)]:opacity-0'
          )}
          aria-hidden
        >
          {closedAgo}
        </span>
        <button
          type="button"
          onClick={handleArchive}
          onMouseDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
          className={cn(
            '[grid-area:1/1] inline-flex items-center justify-center text-muted-foreground/70 hover:text-destructive',
            'can-hover:opacity-0 transition-opacity duration-150',
            'group-hover/kept-chat:opacity-100 focus-visible:opacity-100'
          )}
          aria-label="Remove chat from list"
          title="Remove from list (stays in Agent Session History)"
        >
          <Trash2 className="size-3.5" />
        </button>
      </span>
    </div>
  )
}
