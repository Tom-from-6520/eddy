<#
.SYNOPSIS
  Adds the Linux build (from eddy/scripts/linux-build.sh, e.g. in WSL) to an existing eddy GitHub Release.

.EXAMPLE
  pwsh eddy/scripts/release-linux.ps1 -Tag v1.141.0-eddy.1
  pwsh eddy/scripts/release-linux.ps1 -Tag v1.141.0-eddy.1 -DistPath \\wsl.localhost\Ubuntu-24.04\root\eddy\.build\eddy-dist\linux
#>
[CmdletBinding()]
param(
	[Parameter(Mandatory)][ValidatePattern('^v\d+\.\d+\.\d+-eddy\.\d+$')][string]$Tag,
	[string]$DistPath = '\\wsl.localhost\Ubuntu-24.04\root\eddy\.build\eddy-dist\linux',
	[string]$Repo = 'Tom-from-6520/eddy'
)
$ErrorActionPreference = 'Stop'
$root = (git rev-parse --show-toplevel).Trim()
Set-Location $root

$account = $Repo.Split('/')[0]
$credential = "protocol=https`nhost=github.com`nusername=$account`n`n" | git -c credential.interactive=never credential fill 2>$null
$token = ($credential | Where-Object { $_.StartsWith('password=') }) -replace '^password=', ''
if (-not $token) { throw "No stored GitHub credential for $account (run any 'git push' to sign in once)." }
$headers = @{ Authorization = "Bearer $token"; Accept = 'application/vnd.github+json'; 'X-GitHub-Api-Version' = '2022-11-28' }

$release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/tags/$Tag" -Headers $headers
$releaseCommit = (git rev-parse "$($release.target_commitish)^{commit}").Trim()

$deb = Get-ChildItem $DistPath -Filter '*.deb' | Select-Object -First 1
$tgz = Get-ChildItem $DistPath -Filter '*.tar.gz' | Select-Object -First 1
if (-not $deb -or -not $tgz) { throw "Linux build outputs not found in $DistPath." }

# The Linux build must contain the same product code as the release (later commits may only touch eddy/ or .github/).
if ($deb.Name -notmatch '-([0-9a-f]{10})-linux-amd64\.deb$') { throw "Can't read the commit from $($deb.Name)." }
$builtCommit = (git rev-parse "$($Matches[1])^{commit}").Trim()
$changed = git diff --name-only $releaseCommit $builtCommit
if ($LASTEXITCODE -or ($changed | Where-Object { $_ -notmatch '^(eddy|\.github)/' })) {
	throw "Linux build ($builtCommit) has product changes compared with the release commit ($releaseCommit)."
}

$label = $Tag.TrimStart('v')
$stage = Join-Path $root '.build\eddy-dist\linux'
Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory $stage | Out-Null
Copy-Item $deb.FullName (Join-Path $stage "eddy-$label-linux-amd64.deb")
Copy-Item $tgz.FullName (Join-Path $stage "eddy-$label-linux-x64.tar.gz")
Get-ChildItem $stage | ForEach-Object { "$((Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLower())  $($_.Name)" } |
	Set-Content (Join-Path $stage 'SHA256SUMS-linux.txt')
Get-ChildItem $stage | Format-Table Name, @{ n = 'MB'; e = { [math]::Round($_.Length / 1MB, 1) } }

foreach ($file in Get-ChildItem $stage) {
	$existing = $release.assets | Where-Object name -eq $file.Name
	if ($existing) {
		Invoke-RestMethod -Method Delete -Uri "https://api.github.com/repos/$Repo/releases/assets/$($existing.id)" -Headers $headers | Out-Null
	}
	Write-Host "   uploading $($file.Name)"
	$uploadUrl = "https://uploads.github.com/repos/$Repo/releases/$($release.id)/assets?name=$([uri]::EscapeDataString($file.Name))"
	Invoke-RestMethod -Method Post -Uri $uploadUrl -Headers $headers -InFile $file.FullName -ContentType 'application/octet-stream' -TimeoutSec 1800 | Out-Null
}
Write-Host "Linux files added to $($release.html_url)" -ForegroundColor Green
