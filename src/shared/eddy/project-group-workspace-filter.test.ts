import { describe, expect, it } from 'vitest'
import type { ProjectGroup } from '../project-group-types'
import {
  applyProjectGroupWorkspaceKindFilterUpdate,
  getProjectGroupWorkspaceKindFilter,
  normalizeProjectGroupWorkspaceKindFilter,
  projectGroupShowsFolderWorkspaces,
  projectGroupShowsProjects
} from './project-group-workspace-filter'
import { normalizeProjectGroups } from '../project-groups'
import { ProjectGroupSchema } from '../project-section-catalog-schema'
import { ProjectGroupUpdate } from '../rpc-contract/repo-params'

const GROUP: ProjectGroup = {
  id: 'group-1',
  name: 'Group',
  parentPath: '/tmp/parent',
  parentGroupId: null,
  createdFrom: 'folder-scan',
  tabOrder: 0,
  isCollapsed: false,
  color: null,
  createdAt: 1,
  updatedAt: 1
}

describe('project group workspace kind filter', () => {
  it('reads an absent or unknown filter as all', () => {
    expect(getProjectGroupWorkspaceKindFilter(GROUP)).toBe('all')
    expect(getProjectGroupWorkspaceKindFilter(null)).toBe('all')
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: simulates a newer host's value.
    const future = { workspaceKindFilter: 'agents' } as unknown as ProjectGroup
    expect(getProjectGroupWorkspaceKindFilter(future)).toBe('all')
    expect(projectGroupShowsFolderWorkspaces(future)).toBe(true)
    expect(projectGroupShowsProjects(future)).toBe(true)
  })

  it('maps each filter to the kinds it shows', () => {
    const worktrees = { ...GROUP, workspaceKindFilter: 'worktrees' as const }
    const folders = { ...GROUP, workspaceKindFilter: 'folders' as const }
    expect(projectGroupShowsFolderWorkspaces(worktrees)).toBe(false)
    expect(projectGroupShowsProjects(worktrees)).toBe(true)
    expect(projectGroupShowsFolderWorkspaces(folders)).toBe(true)
    expect(projectGroupShowsProjects(folders)).toBe(false)
  })

  it('stores only a non-default filter', () => {
    expect(normalizeProjectGroupWorkspaceKindFilter('folders')).toEqual({
      workspaceKindFilter: 'folders'
    })
    expect(normalizeProjectGroupWorkspaceKindFilter('all')).toEqual({})
    expect(normalizeProjectGroupWorkspaceKindFilter(42)).toEqual({})
  })

  it('applies updates and removes the field on all', () => {
    const group: ProjectGroup = { ...GROUP }
    applyProjectGroupWorkspaceKindFilterUpdate(group, 'worktrees')
    expect(group.workspaceKindFilter).toBe('worktrees')
    applyProjectGroupWorkspaceKindFilterUpdate(group, undefined)
    expect(group.workspaceKindFilter).toBe('worktrees')
    applyProjectGroupWorkspaceKindFilterUpdate(group, 'all')
    expect('workspaceKindFilter' in group).toBe(false)
  })

  it('survives persistence normalization', () => {
    const [group] = normalizeProjectGroups([{ ...GROUP, workspaceKindFilter: 'folders' }])
    expect(group.workspaceKindFilter).toBe('folders')
    const [plain] = normalizeProjectGroups([{ ...GROUP, workspaceKindFilter: 'bogus' }])
    expect('workspaceKindFilter' in plain).toBe(false)
  })

  it('survives the catalog schema and drops an unknown value', () => {
    expect(
      ProjectGroupSchema.parse({ ...GROUP, workspaceKindFilter: 'worktrees' }).workspaceKindFilter
    ).toBe('worktrees')
    expect(
      ProjectGroupSchema.parse({ ...GROUP, workspaceKindFilter: 'bogus' }).workspaceKindFilter
    ).toBeUndefined()
  })

  it('is accepted by the runtime update params', () => {
    const parsed = ProjectGroupUpdate.parse({
      groupId: 'group-1',
      updates: { workspaceKindFilter: 'folders' }
    })
    expect(parsed.updates.workspaceKindFilter).toBe('folders')
    expect(
      ProjectGroupUpdate.safeParse({ groupId: 'group-1', updates: { workspaceKindFilter: 'x' } })
        .success
    ).toBe(false)
  })
})
