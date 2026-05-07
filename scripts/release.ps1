param(
  [string]$OutputDir = "dist",
  [string]$NamePrefix = "omni-note-release",
  [switch]$IncludeDatabase
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
Set-Location $projectRoot

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outDirPath = Join-Path $projectRoot $OutputDir
$zipPath = Join-Path $outDirPath ("{0}-{1}.zip" -f $NamePrefix, $timestamp)
$stageDir = Join-Path $outDirPath ("_stage-{0}" -f $timestamp)

if (!(Test-Path $outDirPath)) {
  New-Item -ItemType Directory -Path $outDirPath | Out-Null
}
if (Test-Path $stageDir) {
  Remove-Item -Path $stageDir -Recurse -Force
}
New-Item -ItemType Directory -Path $stageDir | Out-Null

$excludedDirs = @(
  ".git",
  "env",
  ".venv",
  "venv",
  "__pycache__",
  "dist",
  "data",
  ".vscode"
)

$excludedExtensions = @(".pyc", ".pyo", ".pyd")
$excludedDbExtensions = @(".db", ".sqlite")

$files = Get-ChildItem -Path $projectRoot -Recurse -File | Where-Object {
  $fullPath = $_.FullName
  $relative = $fullPath.Substring($projectRoot.Length).TrimStart('\', '/')

  $isExcludedDir = $false
  foreach ($d in $excludedDirs) {
    if ($relative -like "$d\*" -or $relative -like "$d/*") {
      $isExcludedDir = $true
      break
    }
  }
  if ($isExcludedDir) { return $false }

  if ($excludedExtensions -contains $_.Extension) { return $false }

  if (-not $IncludeDatabase -and ($excludedDbExtensions -contains $_.Extension)) {
    return $false
  }

  return $true
}

foreach ($file in $files) {
  $relative = $file.FullName.Substring($projectRoot.Length).TrimStart('\', '/')
  $targetPath = Join-Path $stageDir $relative
  $targetDir = Split-Path -Parent $targetPath

  if (!(Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
  }

  Copy-Item -Path $file.FullName -Destination $targetPath -Force
}

if (Test-Path $zipPath) {
  Remove-Item -Path $zipPath -Force
}

Compress-Archive -Path (Join-Path $stageDir "*") -DestinationPath $zipPath -Force
Remove-Item -Path $stageDir -Recurse -Force

$zipInfo = Get-Item $zipPath
$fileCount = $files.Count
$sizeMB = [Math]::Round($zipInfo.Length / 1MB, 2)

Write-Host "Release package created: $zipPath"
Write-Host "Included files: $fileCount"
Write-Host "Zip size: $sizeMB MB"
Write-Host "Include database files: $IncludeDatabase"
