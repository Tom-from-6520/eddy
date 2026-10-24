import { describe, expect, it } from 'vitest'
import type { FolderWorkspace } from '../folder-workspace-types'
import type { ProjectGroup } from '../project-group-types'
import type { Repo } from '../repo-types'
import type { Worktree } from '../worktree/types'
import { LOCAL_EXECUTION_HOST_ID } from '../execution-host'
import { cloneDefaultWorkspaceStatuses } from '../workspace-statuses'
import { getProjectGroupHeaderKey } from '../sidebar-list/group-keys'
import type { Row } from '../sidebar-list/row-types'
import { planSidebarRows } from '../sidebar-list/sidebar-row-plan'
import type { ProjectGroupWorkspaceKindFilter } from './project-group-workspace-filter'

const PARENT: ProjectGroup = {
  id: 'group-parent',
  name: 'Parent',
  parentPath: '/tmp/parent',
  parentGroupId: null,
  createdFrom: 'folder-scan',
  tabOrder: 0,
  isCollapsed: false,
  color: null,
  createdAt: 1,
  updatedAt: 1
}

const CHILD: ProjectGroup = {
  ...PARENT,
  id: 'group-child',
  name: 'Child',
  parentPath: '/tmp/parent/child',
  parentGroupId: PARENT.id
}

const REPO: Repo = {
  id: 'repo-1',
  path: '/tmp/parent/orca',
  displayName: 'orca',
  badgeColor: '#000000',
  addedAt: 0,
  projectGroupId: PARENT.id
}

const CHILD_REPO: Repo = {
  ...REPO,
  id: 'repo-2',
  path: '/tmp/parent/child/app',
  displayName: 'app',
  projectGroupId: CHILD.id
}

const WORKTREE: Worktree = {
  id: 'wt-1',
  repoId: REPO.id,
  path: '/tmp/parent/orca-feature',
  branch: 'refs/heads/feature',
  head: 'abc123',
  isBare: false,
  isMainWorktree: false,
  linkedIssue: null,
  linkedPR: null,
  linkedLinearIssue: null,
  isArchived: false,
  comment: '',
  isUnread: false,
  isPinned: false,
  displayName: 'feature',
  sortOrder: 0,
  lastActivityAt: 0
}

const CHILD_WORKTREE: Worktree = {
  ...WORKTREE,
  id: 'wt-2',
  repoId: CHILD_REPO.id,
  path: '/tmp/parent/child/app-feature'
}

function folderWorkspace(id: string, projectGroupId: string, folderPath: string): FolderWorkspace {
  return {
    id,
    projectGroupId,
    name: id,
    folderPath,
    linkedTask: null,
    comment: '',
    isArchived: false,
    isUnread: false,
    isPinned: false,
    sortOrder: 1,
    lastActivityAt: 1,
    createdAt: 1,
    updatedAt: 1,
    workspaceStatus: 'in-progress'
  }
}

function buildRows(parentFilter?: ProjectGroupWorkspaceKindFilter): Row[] {
  const worktrees = [WORKTREE, CHILD_WORKTREE]
  const parent: ProjectGroup = parentFilter
    ? { ...PARENT, workspaceKindFilter: parentFilter }
    : PARENT
  return planSidebarRows({
    groupBy: 'repo',
    worktrees,
    repoMap: new Map([
      [REPO.id, REPO],
      [CHILD_REPO.id, CHILD_REPO]
    ]),
    prGroupOf: () => 'in-progress',
    workspaceStatuses: cloneDefaultWorkspaceStatuses(),
    projectOrderBy: 'manual',
    lineageById: {},
    worktreeMap: new Map(worktrees.map((entry) => [entry.id, entry])),
    nestLineage: false,
    projectGroups: [parent, CHILD],
    placeholderRepoIds: new Set(),
    importedWorktreesByRepo: new Map(),
    newExternalWorktreesInboxByRepo: new Map(),
    pendingCreations: [],
    folderWorkspaces: [
      folderWorkspace('fw-parent', PARENT.id, PARENT.parentPath ?? ''),
      folderWorkspace('fw-child', CHILD.id, CHILD.parentPath ?? '')
    ],
    defaultHostId: LOCAL_EXECUTION_HOST_ID,
    pinnedDisplayPolicy: 'single-location',
    filterRepoIds: []
  }).render(new Set())
}

function summarize(rows: Row[]): string[] {
  return rows.map((row) => {
    switch (row.type) {
      case 'header':
        return `header:${row.label}`
      case 'item':
        return `item:${row.worktree.id}`
      case 'folder-workspace':
        return `folder:${row.folderWorkspace.id}`
      default:
        return row.type
    }
  })
}

function groupHeaderCount(rows: Row[], group: ProjectGroup): number | undefined {
  const key = getProjectGroupHeaderKey(group.id)
  const header = rows.find((row) => row.type === 'header' && row.key === key)
  return header?.type === 'header' ? header.count : undefined
}

describe('project group workspace kind filter in sidebar rows', () => {
  it('shows both kinds by default', () => {
    const rows = buildRows()
    expect(summarize(rows)).toContain('folder:fw-parent')
    expect(summarize(rows)).toContain('item:wt-1')
    expect(groupHeaderCount(rows, PARENT)).toBe(4)
  })

  it('treats an explicit all like the default', () => {
    expect(summarize(buildRows('all'))).toEqual(summarize(buildRows()))
  })

  it('hides the group folder workspaces under worktrees', () => {
    const rows = buildRows('worktrees')
    const summary = summarize(rows)
    expect(summary).not.toContain('folder:fw-parent')
    expect(summary).toContain('header:orca')
    expect(summary).toContain('item:wt-1')
    // The child group keeps its own (default) filter.
    expect(summary).toContain('header:Child')
    expect(summary).toContain('folder:fw-child')
    expect(summary).toContain('item:wt-2')
    expect(groupHeaderCount(rows, PARENT)).toBe(3)
  })

  it('hides the group projects under folders without ungrouping them', () => {
    const rows = buildRows('folders')
    const summary = summarize(rows)
    expect(summary).toContain('folder:fw-parent')
    expect(summary).not.toContain('header:orca')
    expect(summary).not.toContain('item:wt-1')
    expect(summary).toContain('header:Child')
    expect(summary).toContain('folder:fw-child')
    expect(summary).toContain('item:wt-2')
    expect(groupHeaderCount(rows, PARENT)).toBe(3)
  })
})
