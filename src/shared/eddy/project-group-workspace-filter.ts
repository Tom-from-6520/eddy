import { z } from 'zod'
import type { ProjectGroup } from '../project-group-types'

/**
 * Which workspaces a project group lists in the sidebar (Group by: Project). Stored on the group,
 * so it syncs with the group's host like `isCollapsed` and `color`. Absent means 'all'.
 *   - 'worktrees': hide the group's folder workspaces, keep its projects and their worktrees.
 *   - 'folders': hide the group's projects (headers and worktrees), keep its folder workspaces.
 * Child groups always stay listed and apply their own filter.
 */
export const PROJECT_GROUP_WORKSPACE_KIND_FILTERS = ['all', 'worktrees', 'folders'] as const

export type ProjectGroupWorkspaceKindFilter = (typeof PROJECT_GROUP_WORKSPACE_KIND_FILTERS)[number]

export const ProjectGroupWorkspaceKindFilterSchema = z.enum(PROJECT_GROUP_WORKSPACE_KIND_FILTERS)

type UpdatableGroupField = 'name' | 'isCollapsed' | 'tabOrder' | 'color' | 'workspaceKindFilter'

/** The group fields a client may update (upstream's list plus the workspace kind filter). */
export type ProjectGroupUpdates = Partial<Pick<ProjectGroup, UpdatableGroupField>>

export function isProjectGroupWorkspaceKindFilter(
  value: unknown
): value is ProjectGroupWorkspaceKindFilter {
  return (
    typeof value === 'string' &&
    (PROJECT_GROUP_WORKSPACE_KIND_FILTERS as readonly string[]).includes(value)
  )
}

/** The field as a persisted group carries it: only a non-default filter is stored. */
export function normalizeProjectGroupWorkspaceKindFilter(
  value: unknown
): Pick<ProjectGroup, 'workspaceKindFilter'> {
  return isProjectGroupWorkspaceKindFilter(value) && value !== 'all'
    ? { workspaceKindFilter: value }
    : {}
}

/** Applies an update to a stored group; 'all' removes the field. */
export function applyProjectGroupWorkspaceKindFilterUpdate(
  group: ProjectGroup,
  value: unknown
): void {
  if (!isProjectGroupWorkspaceKindFilter(value)) {
    return
  }
  if (value === 'all') {
    delete group.workspaceKindFilter
  } else {
    group.workspaceKindFilter = value
  }
}

export function getProjectGroupWorkspaceKindFilter(
  group: Pick<ProjectGroup, 'workspaceKindFilter'> | null | undefined
): ProjectGroupWorkspaceKindFilter {
  const value = group?.workspaceKindFilter
  return isProjectGroupWorkspaceKindFilter(value) ? value : 'all'
}

export function projectGroupShowsFolderWorkspaces(
  group: Pick<ProjectGroup, 'workspaceKindFilter'> | null | undefined
): boolean {
  return getProjectGroupWorkspaceKindFilter(group) !== 'worktrees'
}

export function projectGroupShowsProjects(
  group: Pick<ProjectGroup, 'workspaceKindFilter'> | null | undefined
): boolean {
  return getProjectGroupWorkspaceKindFilter(group) !== 'folders'
}
