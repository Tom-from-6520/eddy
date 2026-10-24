import type React from 'react'
import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger
} from '@/components/ui/dropdown-menu'
import { useAppStore } from '@/store'
import { findIndexedProjectGroupOwner } from '@/lib/worktree-runtime-owner-index'
import type { ExecutionHostId } from '../../../shared/execution-host'
import {
  getProjectGroupWorkspaceKindFilter,
  isProjectGroupWorkspaceKindFilter,
  type ProjectGroupWorkspaceKindFilter
} from '../../../shared/eddy/project-group-workspace-filter'

const OPTIONS: readonly { value: ProjectGroupWorkspaceKindFilter; label: string }[] = [
  { value: 'all', label: 'Worktrees and folders' },
  { value: 'worktrees', label: 'Worktrees only' },
  { value: 'folders', label: 'Folders only' }
]

/**
 * "Show" submenu of a project group's "…" menu: which workspace kinds the group lists. Only
 * folder-backed groups (a parentPath) hold folder workspaces, so other groups get no submenu.
 */
export function ProjectGroupWorkspaceFilterMenu({
  groupId,
  hostId
}: {
  groupId: string
  hostId?: ExecutionHostId
}): React.JSX.Element | null {
  const isFolderBacked = useAppStore(
    (s) => !!findIndexedProjectGroupOwner(s.projectGroups, groupId, hostId)?.parentPath
  )
  const filter = useAppStore((s) =>
    getProjectGroupWorkspaceKindFilter(
      findIndexedProjectGroupOwner(s.projectGroups, groupId, hostId)
    )
  )
  const updateProjectGroup = useAppStore((s) => s.updateProjectGroup)
  if (!isFolderBacked) {
    return null
  }
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>Show</DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-48">
        <DropdownMenuRadioGroup
          value={filter}
          onValueChange={(value) => {
            if (isProjectGroupWorkspaceKindFilter(value) && value !== filter) {
              void updateProjectGroup(groupId, { workspaceKindFilter: value }, { hostId })
            }
          }}
        >
          {OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}
