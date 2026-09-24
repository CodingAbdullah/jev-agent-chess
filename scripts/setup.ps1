<#
.SYNOPSIS
Set up Jev Chess on this machine, then optionally start it.

.DESCRIPTION
  .\scripts\setup.ps1                 asks how you want to run it
  .\scripts\setup.ps1 local           Node.js: writes .env.local for `npm run dev`
  .\scripts\setup.ps1 docker          Docker: writes .env for `docker compose`
  .\scripts\setup.ps1 cloud           shows how to add the key to a Claude cloud environment
  .\scripts\setup.ps1 vercel          shows how to add the key to Vercel
  .\scripts\setup.ps1 local -Start    also installs and starts the app

The TypeSafe API key is typed at a hidden prompt, never taken as an argument,
and saved only in the git-ignored env file. Leave it empty to play against the
mock Jev. Works in Windows PowerShell 5.1 and PowerShell 7. If Windows blocks
the script, run it with:

  powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1

The macOS and Linux version is setup.sh.
#>
# The script talks to a person at a console, so Write-Host is the right output.
[Diagnostics.CodeAnalysis.SuppressMessageAttribute('PSAvoidUsingWriteHost', '')]
[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [ValidateSet('local', 'docker', 'cloud', 'vercel')]
  [string]$Mode,
  [switch]$Start,
  [switch]$NoStart
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Fail([string]$Message) {
  Write-Host "Error: $Message" -ForegroundColor Red
  exit 1
}

function Test-Interactive {
  -not [Console]::IsInputRedirected
}

function Test-Command([string]$Name) {
  [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

if ($Start -and $NoStart) { Fail 'Choose -Start or -NoStart, not both.' }

if (-not $Mode) {
  if (-not (Test-Interactive)) { Fail 'Say how to run it: .\scripts\setup.ps1 local|docker|cloud|vercel' }
  Write-Host 'How do you want to run Jev Chess?'
  Write-Host '  1) Node.js on this machine (npm run dev)'
  Write-Host '  2) Docker (docker compose)'
  Write-Host '  3) Claude Code cloud environment'
  Write-Host '  4) Vercel'
  $choice = Read-Host 'Choose 1-4 [1]'
  switch ($choice) {
    { $_ -in '', '1', 'local' } { $Mode = 'local'; break }
    { $_ -in '2', 'docker' } { $Mode = 'docker'; break }
    { $_ -in '3', 'cloud' } { $Mode = 'cloud'; break }
    { $_ -in '4', 'vercel' } { $Mode = 'vercel'; break }
    default { Fail 'Please choose 1, 2, 3 or 4.' }
  }
}

if ($Mode -eq 'cloud') {
  Write-Host @'
Add your TypeSafe key to a Claude Code cloud environment. The key lives in the
environment's settings, never in the repository or the chat.

  1. In a session on claude.ai/code, open the cloud environment menu in the
     session's title bar and choose Edit.
  2. Add TYPESAFE_API_KEY under API credentials if that section is offered,
     otherwise as an environment variable: TYPESAFE_API_KEY=your-key
  3. Add api.typesafe.ai to the environment's allowed network domains.
  4. Start a new session. Settings only reach sessions started afterwards.
  5. In the new session, check the key with: npm run jev:smoke
'@
  exit 0
}

if ($Mode -eq 'vercel') {
  Write-Host @'
Add your TypeSafe key to Vercel. Vercel stores it encrypted and only the
server reads it.

  1. Import the repository at vercel.com/new, or use the Deploy button in
     the README. The button asks for TYPESAFE_API_KEY while it sets up.
  2. For an existing project, open Settings, then Environment Variables, and
     add TYPESAFE_API_KEY for Production and Preview.
  3. Redeploy, since variables apply to new deployments only.

With the Vercel CLI, in a linked project, this asks for the value without
showing it:

  vercel env add TYPESAFE_API_KEY production
'@
  exit 0
}

# Check the tools this mode needs.
if ($Mode -eq 'local') {
  if (-not (Test-Command 'node')) { Fail 'Node.js is not installed. Install Node.js 22 from https://nodejs.org.' }
  if (-not (Test-Command 'npm')) { Fail 'npm is not installed. It comes with Node.js.' }
  $nodeVersion = (& node -p 'process.versions.node').Trim()
  if ([version]$nodeVersion -lt [version]'20.9.0') {
    Fail "Node.js $nodeVersion is too old. Jev Chess needs 20.9 or newer, 22 recommended."
  }
  $envName = '.env.local'
}
else {
  if (-not (Test-Command 'docker')) { Fail 'Docker is not installed. See https://docs.docker.com/get-docker/.' }
  & docker compose version *> $null
  if ($LASTEXITCODE -ne 0) { Fail 'Docker Compose is missing. Install Docker Desktop or the compose plugin.' }
  $envName = '.env'
}

$example = Join-Path $root '.env.example'
$envPath = Join-Path $root $envName
if (-not (Test-Path $example)) { Fail '.env.example is missing. Run this from a copy of the Jev Chess repository.' }

# UTF-8 without a byte order mark, which Node and Docker Compose both read.
$utf8 = New-Object System.Text.UTF8Encoding($false)

function Protect-EnvFile {
  # On macOS and Linux, make the file readable by you alone. On Windows it
  # inherits your user folder's permissions.
  if ($PSVersionTable.PSEdition -eq 'Core' -and -not $IsWindows) { & chmod 600 $envPath }
}

if (Test-Path $envPath) {
  Write-Host "Using your existing $envName. Its other settings are kept."
}
else {
  [IO.File]::WriteAllText($envPath, [IO.File]::ReadAllText($example), $utf8)
  Protect-EnvFile
  Write-Host "Created $envName from .env.example."
}

function Get-Setting([string]$Name) {
  foreach ($line in [IO.File]::ReadAllLines($envPath)) {
    if ($line.StartsWith("$Name=")) { return $line.Substring($Name.Length + 1).Trim() }
  }
  return ''
}

function Save-Key([string]$Key) {
  $found = $false
  $lines = foreach ($line in [IO.File]::ReadAllLines($envPath)) {
    if ($line.StartsWith('TYPESAFE_API_KEY=')) { "TYPESAFE_API_KEY=$Key"; $found = $true }
    else { $line }
  }
  if (-not $found) { $lines = @($lines) + "TYPESAFE_API_KEY=$Key" }
  [IO.File]::WriteAllText($envPath, (($lines -join "`n") + "`n"), $utf8)
  Protect-EnvFile
}

$hasKey = (Get-Setting 'TYPESAFE_API_KEY') -ne ''
if ($hasKey) { $prompt = 'TypeSafe API key (hidden; press Enter to keep the saved key)' }
else { $prompt = 'TypeSafe API key (hidden; press Enter to play against the mock Jev)' }

if (Test-Interactive) {
  $secure = Read-Host -Prompt $prompt -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { $key = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}
else {
  Write-Host "${prompt}:"
  $key = [Console]::In.ReadLine()
}
if ($null -eq $key) { $key = '' }
$key = $key.Trim()

if ($key) {
  if ($key -match '[\s#$"''`\\]') {
    Fail "That key has spaces or characters such as # `$ or quotes, which env files cannot hold as typed. Edit $envName by hand."
  }
  Save-Key $key
  Write-Host "Saved the key in $envName."
  $hasKey = $true
}
elseif ($hasKey) { Write-Host 'Kept the saved key.' }
else { Write-Host 'No key saved: Jev will be the local mock. Run this again to add one.' }
Remove-Variable key

if ($hasKey -and (Get-Setting 'JEV_MOCK') -eq '1') {
  Write-Host "Note: JEV_MOCK=1 in $envName, so the mock is used even with a key. Clear it to use the real Jev."
}

if ($Start) { $run = $true }
elseif ($NoStart -or -not (Test-Interactive)) { $run = $false }
else { $run = (Read-Host 'Start Jev Chess now? [Y/n]') -notmatch '^[Nn]' }

if ($Mode -eq 'local') {
  if (-not $run) {
    Write-Host "`nNext: npm install, then npm run dev, and open http://localhost:3000"
    exit 0
  }
  if (-not (Test-Path (Join-Path $root 'node_modules'))) {
    Write-Host "`nInstalling dependencies..."
    & npm install
    if ($LASTEXITCODE -ne 0) { Fail 'npm install failed.' }
  }
  Write-Host "`nStarting the development server. Open http://localhost:3000 and press Ctrl+C to stop."
  & npm run dev
  exit $LASTEXITCODE
}

$port = $env:PORT
if (-not $port) { $port = Get-Setting 'PORT' }
if (-not $port) { $port = '3000' }
if (-not $run) {
  Write-Host "`nNext: docker compose up --build, and open http://localhost:$port"
  exit 0
}
& docker info *> $null
if ($LASTEXITCODE -ne 0) { Fail 'Docker is not running. Start Docker, then run: docker compose up --build -d' }
Write-Host "`nBuilding and starting the container. The first build takes a few minutes."
& docker compose up --build -d
if ($LASTEXITCODE -ne 0) { Fail 'docker compose up failed. See the output above.' }
Write-Host -NoNewline 'Waiting for the app to answer'
for ($i = 0; $i -lt 60; $i++) {
  try {
    Invoke-WebRequest -Uri "http://localhost:$port/" -UseBasicParsing -TimeoutSec 5 | Out-Null
    Write-Host "`nJev Chess is running at http://localhost:$port"
    Write-Host "See the logs with: docker compose logs -f`nStop it with: docker compose down"
    exit 0
  }
  catch {
    Write-Host -NoNewline '.'
    Start-Sleep -Seconds 2
  }
}
Write-Host ''
Fail 'The app did not answer within two minutes. See: docker compose logs'
