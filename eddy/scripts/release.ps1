<#
.SYNOPSIS
  Builds eddy for Windows x64 on this machine and publishes a GitHub Release.
  Same steps as .github/workflows/eddy-build.yml (use while CI is unavailable).

.EXAMPLE
  pwsh eddy/scripts/release.ps1 -Tag v1.141.0-eddy.1
  pwsh eddy/scripts/release.ps1 -Tag v1.141.0-eddy.1 -SkipBuild   # reuse the last local build of HEAD
#>
[CmdletBinding()]
param(
	[Parameter(Mandatory)][ValidatePattern('^v\d+\.\d+\.\d+-(eddy|alpha)\.\d+$')][string]$Tag,
	[switch]$SkipBuild,
	[string]$Repo = 'Tom-from-6520/eddy'
)
$ErrorActionPreference = 'Stop'
$root = (git rev-parse --show-toplevel).Trim()
Set-Location $root
$appDir = Join-Path (Split-Path $root -Parent) 'VSCode-win32-x64'

function Invoke-Step([string]$Name, [scriptblock]$Script) {
	Write-Host "==> $Name" -ForegroundColor Cyan
	& $Script
	if ($LASTEXITCODE) { throw "$Name failed (exit $LASTEXITCODE)" }
}

function Get-GitHubToken {
	$account = $Repo.Split('/')[0]
	$out = "protocol=https`nhost=github.com`nusername=$account`n`n" | git -c credential.interactive=never credential fill 2>$null
	$token = ($out | Where-Object { $_ -like 'password=*' }) -replace '^password=', ''
	if (-not $token) { throw "No stored GitHub credential for $account (run any 'git push' to sign in once)." }
	$token
}

# The release must point at a commit that exists on GitHub.
$commit = (git rev-parse HEAD).Trim()
if (git status --porcelain --untracked-files=no) { throw 'Working tree has uncommitted changes.' }
git fetch -q origin
if (-not (git branch -r --contains $commit | Select-String 'origin/')) { throw "HEAD $commit is not pushed to origin." }

$env:FOUNDRY_LOCAL_SKIP_INSTALL = '1'

# Packaging strips signatures from bundled native binaries with signtool.exe (Windows SDK), which is usually not on PATH.
if (-not (Get-Command signtool.exe -ErrorAction SilentlyContinue)) {
	$signtool = Get-ChildItem "${env:ProgramFiles(x86)}\Windows Kits\10\bin" -Recurse -Filter signtool.exe -ErrorAction SilentlyContinue |
		Where-Object { $_.FullName -match '\\x64\\' } | Sort-Object FullName -Descending | Select-Object -First 1
	if (-not $signtool) { throw 'signtool.exe not found. Install the Windows SDK (Visual Studio Installer -> Windows 11 SDK).' }
	$env:PATH = "$($signtool.DirectoryName);$env:PATH"
}

if (-not $SkipBuild) {
	Invoke-Step 'Build app (minified)' { npm run gulp vscode-win32-x64-min }
	Invoke-Step 'Build inno updater' { npm run gulp vscode-win32-x64-inno-updater }
	Invoke-Step 'Build installer (user setup)' { npm run gulp vscode-win32-x64-user-setup }
}

# The packaged product must come from HEAD, or from an earlier commit when only eddy's docs/scripts/CI changed since.
$built = Get-ChildItem $appDir -Recurse -Depth 3 -Filter product.json -ErrorAction SilentlyContinue |
	Where-Object { $_.FullName -like '*resources\app\product.json' } | Select-Object -First 1
if (-not $built) { throw "Packaged app not found at $appDir." }
$builtCommit = (Get-Content $built.FullName -Raw | ConvertFrom-Json).commit
if ($builtCommit -ne $commit) {
	$changed = git diff --name-only $builtCommit $commit
	if ($LASTEXITCODE -or ($changed | Where-Object { $_ -notmatch '^(eddy|\.github)/' })) {
		throw "Packaged build is from $builtCommit, but HEAD ($commit) changed product files since. Rebuild without -SkipBuild."
	}
	Write-Host "Build is from $builtCommit; later commits only touch eddy/ or .github/, releasing that commit."
	$commit = $builtCommit
}

Write-Host '==> Collect outputs' -ForegroundColor Cyan
$label = $Tag.TrimStart('v')
$dist = Join-Path $root '.build\eddy-dist'
Remove-Item $dist -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory $dist | Out-Null
$setup = Get-ChildItem .build\win32-x64\user-setup -Filter *.exe | Select-Object -First 1
if (-not $setup) { throw 'User setup not found in .build\win32-x64\user-setup.' }
Copy-Item $setup.FullName (Join-Path $dist "eddy-$label-win32-x64-user-setup.exe")
Compress-Archive -Path (Join-Path $appDir '*') -DestinationPath (Join-Path $dist "eddy-$label-win32-x64.zip")
$sums = Get-ChildItem $dist | ForEach-Object { "$((Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLower())  $($_.Name)" }
$sums | Set-Content (Join-Path $dist 'SHA256SUMS.txt')
Get-ChildItem $dist | Format-Table Name, @{ n = 'MB'; e = { [math]::Round($_.Length / 1MB, 1) } }

Write-Host "==> Create release $Tag" -ForegroundColor Cyan
$headers = @{ Authorization = "Bearer $(Get-GitHubToken)"; Accept = 'application/vnd.github+json'; 'X-GitHub-Api-Version' = '2022-11-28' }
$body = @{ tag_name = $Tag; target_commitish = $commit; name = "eddy $Tag"; generate_release_notes = $true } | ConvertTo-Json
$release = Invoke-RestMethod -Method Post -Uri "https://api.github.com/repos/$Repo/releases" -Headers $headers -Body $body -ContentType 'application/json'
foreach ($file in Get-ChildItem $dist) {
	Write-Host "   uploading $($file.Name)"
	$uploadUrl = "https://uploads.github.com/repos/$Repo/releases/$($release.id)/assets?name=$([uri]::EscapeDataString($file.Name))"
	Invoke-RestMethod -Method Post -Uri $uploadUrl -Headers $headers -InFile $file.FullName -ContentType 'application/octet-stream' -TimeoutSec 1800 | Out-Null
}
Write-Host "Released: $($release.html_url)" -ForegroundColor Green
