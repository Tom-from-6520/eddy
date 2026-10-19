<#
.SYNOPSIS
  Disables every GitHub Actions workflow on the eddy-omega repo except eddy's own.

.DESCRIPTION
  Orca ships ~90 workflows (push/PR triggers, scheduled builds, self-hosted runners,
  cloud deployments). None should run on eddy-omega. Run this after the first push
  and after every upstream sync, because workflows that upstream adds start enabled.
  Only workflows whose file name starts with "eddy-" stay enabled.

.EXAMPLE
  pwsh eddy/scripts/disable-upstream-workflows.ps1 -Repo Tom-from-6520/eddy-omega -WhatIf
#>
[CmdletBinding(SupportsShouldProcess)]
param(
	[Parameter(Mandatory)]
	[string]$Repo,
	[string]$KeepPattern = '^\.github/workflows/eddy-[^/]+\.ya?ml$'
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
	throw 'GitHub CLI (gh) is required.'
}

$json = gh api --paginate "repos/$Repo/actions/workflows" --jq '.workflows[] | {id, name, path, state}'
if ($LASTEXITCODE -ne 0) {
	throw "Could not list workflows of $Repo (is gh signed in to the right account?)."
}
$workflows = @($json | Where-Object { $_ } | ForEach-Object { $_ | ConvertFrom-Json })

$disabled = 0
$kept = 0
$failed = 0
foreach ($wf in $workflows) {
	# GitHub-managed "dynamic/..." entries (Copilot review, Dependabot) aren't workflow files.
	if (-not $wf.path.StartsWith('.github/workflows/')) {
		continue
	}
	if ($wf.path -match $KeepPattern) {
		$kept++
		continue
	}
	if ($wf.state -ne 'active') {
		continue
	}
	if ($PSCmdlet.ShouldProcess("$($wf.path) ($($wf.name))", 'Disable workflow')) {
		gh api -X PUT "repos/$Repo/actions/workflows/$($wf.id)/disable" | Out-Null
		if ($LASTEXITCODE -ne 0) {
			Write-Warning "Failed to disable $($wf.path)."
			$failed++
			continue
		}
		$disabled++
	}
}

Write-Host "Disabled $disabled workflow(s), kept $kept eddy workflow(s) enabled, $failed failure(s)."
if ($failed -gt 0) {
	exit 1
}
