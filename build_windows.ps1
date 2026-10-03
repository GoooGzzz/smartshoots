#Requires -Version 5.1
<#
.SYNOPSIS
    One-command build of the SMART SHOOTS Windows installer (.exe).

.DESCRIPTION
    Equivalent to build_windows.py, but as a native PowerShell script with
    proper prerequisite checks, colored progress output, and clear error
    messages instead of a raw Python traceback if something's missing.

    Run this ON WINDOWS (PyInstaller and electron-builder both build for
    whatever OS they run on). It:
      1. Checks Python 3.11+, Node.js, and npm are on PATH
      2. Kills any leftover SmartShootsBackend.exe / SMART SHOOTS.exe so a
         previous run of the app can't lock files the build needs to
         overwrite
      3. npm install && npm run build     in frontend/        -> frontend/dist
      4. pip install -r requirements.txt                       (this machine only)
      5. pyinstaller backend.spec                              -> dist/SmartShootsBackend/
      6. Copies that folder into desktop-app/build-resources/backend
      7. npm install && npm run dist      in desktop-app/      -> the final .exe

    The finished installer is written to desktop-app\dist\SMART SHOOTS Setup *.exe
    That single file is everything an end user needs - no Python or Node
    required on their machine.

.PARAMETER Clean
    Delete previous build output (dist/, build/, frontend/dist,
    desktop-app/dist, desktop-app/build-resources) before building.

.PARAMETER SkipFrontend
    Skip the "npm install && npm run build" step in frontend/ - use this
    for a quick rebuild when only Python/backend files changed.

.PARAMETER SkipBackend
    Skip the PyInstaller freeze step - use this when only frontend or
    Electron shell files changed and dist/SmartShootsBackend is still current.

.EXAMPLE
    .\build_windows.ps1
    Full build from scratch.

.EXAMPLE
    .\build_windows.ps1 -Clean
    Wipe all previous build artifacts first, then build from scratch.

.EXAMPLE
    .\build_windows.ps1 -SkipBackend
    Rebuild just the frontend + Electron installer, reusing the existing
    frozen backend.
#>
[CmdletBinding()]
param(
    [switch]$Clean,
    [switch]$SkipFrontend,
    [switch]$SkipBackend,
    [switch]$SkipApk
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

function Write-Step($msg) {
    Write-Host ""
    Write-Host "== $msg ==" -ForegroundColor Cyan
}
function Write-Ok($msg) { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn2($msg) { Write-Host "  [!] $msg" -ForegroundColor Yellow }
function Write-Err($msg) { Write-Host "  [FAIL] $msg" -ForegroundColor Red }

function Test-Command($name) {
    return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

function Invoke-Checked {
    <#
        Runs an external command and stops the whole script with a clear
        message if it exits non-zero - PowerShell does NOT do this by
        default for external .exe calls, so without this a failed
        `npm install` would silently continue into `npm run build`
        against a broken node_modules and produce a confusing, unrelated
        error much later.
    #>
    param(
        [Parameter(Mandatory)][string]$Exe,
        [Parameter(Mandatory)][string[]]$ArgumentList,
        [Parameter(Mandatory)][string]$WorkingDirectory
    )
    Write-Host "  `$ $Exe $($ArgumentList -join ' ')   (in $WorkingDirectory)" -ForegroundColor DarkGray
    $prevLoc = Get-Location
    try {
        Set-Location $WorkingDirectory
        & $Exe @ArgumentList
        if ($LASTEXITCODE -ne 0) {
            throw "'$Exe $($ArgumentList -join ' ')' exited with code $LASTEXITCODE"
        }
    } finally {
        Set-Location $prevLoc
    }
}

# ---------------------------------------------------------------------
# 0. Prerequisite checks - fail fast with a clear, actionable message
#    instead of a confusing error 10 steps into the build.
# ---------------------------------------------------------------------
Write-Step "Checking prerequisites"

$missing = @()

if (-not (Test-Command 'node')) {
    $missing += "Node.js 18+  (https://nodejs.org)"
} else {
    $nodeVersion = (node --version) -replace 'v', ''
    $nodeMajor = [int]($nodeVersion.Split('.')[0])
    if ($nodeMajor -lt 18) {
        Write-Warn2 "Node.js $nodeVersion found, but 18+ is recommended. Continuing anyway."
    } else {
        Write-Ok "Node.js $nodeVersion"
    }
}

if (-not (Test-Command 'npm')) {
    $missing += "npm (comes with Node.js - https://nodejs.org)"
} else {
    Write-Ok "npm $(npm --version)"
}

$pythonCmd = $null
foreach ($candidate in @('python', 'py')) {
    if (Test-Command $candidate) { $pythonCmd = $candidate; break }
}
if (-not $pythonCmd) {
    $missing += "Python 3.11+  (https://python.org/downloads - check 'Add python.exe to PATH' during install)"
} else {
    $verOutput = & $pythonCmd --version 2>&1
    Write-Host "  Found: $verOutput" -ForegroundColor DarkGray
    if ($verOutput -match '(\d+)\.(\d+)') {
        $pyMajor = [int]$Matches[1]; $pyMinor = [int]$Matches[2]
        if ($pyMajor -lt 3 -or ($pyMajor -eq 3 -and $pyMinor -lt 11)) {
            Write-Warn2 "Python 3.11+ is recommended (found $verOutput). Continuing anyway."
        } else {
            Write-Ok "$verOutput"
        }
    }
}

if ($missing.Count -gt 0) {
    Write-Err "Missing required tools:"
    $missing | ForEach-Object { Write-Host "    - $_" -ForegroundColor Red }
    Write-Host ""
    Write-Host "Install the above, restart PowerShell (so PATH updates take effect), and re-run this script." -ForegroundColor Red
    exit 1
}

# ---------------------------------------------------------------------
# 1. Kill leftover processes so electron-builder / PyInstaller can
#    overwrite their .exe files. This is the single most common cause of
#    a Windows build failing with "Access is denied" mid-way through -
#    Windows locks the file of any .exe that's currently running, and a
#    previous test run of the app (or a still-open instance) holds that
#    lock silently in the background.
# ---------------------------------------------------------------------
Write-Step "Closing any running SMART SHOOTS instances"
foreach ($procName in @('SmartShootsBackend', 'SMART SHOOTS')) {
    $proc = Get-Process -Name $procName -ErrorAction SilentlyContinue
    if ($proc) {
        Write-Warn2 "Stopping running process: $procName"
        Stop-Process -Name $procName -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1
    }
}
Write-Ok "No conflicting processes running"

# ---------------------------------------------------------------------
# 2. Optional clean
# ---------------------------------------------------------------------
if ($Clean) {
    Write-Step "Cleaning previous build output"
    $pathsToClean = @(
        (Join-Path $Root 'dist'),
        (Join-Path $Root 'build'),
        (Join-Path $Root 'frontend\dist'),
        (Join-Path $Root 'desktop-app\dist'),
        (Join-Path $Root 'desktop-app\build-resources')
    )
    foreach ($p in $pathsToClean) {
        if (Test-Path $p) {
            Remove-Item -Recurse -Force $p
            Write-Ok "Removed $p"
        }
    }
}

$Frontend = Join-Path $Root 'frontend'
$Desktop = Join-Path $Root 'desktop-app'
$BackendOut = Join-Path $Desktop 'build-resources\backend'

# ---------------------------------------------------------------------
# 3. Frontend
# ---------------------------------------------------------------------
if (-not $SkipFrontend) {
    Write-Step "1/6: Building the React frontend"
    Invoke-Checked -Exe 'npm' -ArgumentList @('install') -WorkingDirectory $Frontend
    Invoke-Checked -Exe 'npm' -ArgumentList @('run', 'build') -WorkingDirectory $Frontend
    if (-not (Test-Path (Join-Path $Frontend 'dist\index.html'))) {
        throw "frontend/dist/index.html wasn't produced - the frontend build did not complete successfully."
    }
    Write-Ok "Frontend built -> frontend\dist"
} else {
    Write-Step "1/6: Skipping frontend build (-SkipFrontend)"
    if (-not (Test-Path (Join-Path $Frontend 'dist\index.html'))) {
        Write-Err "frontend\dist\index.html doesn't exist. Remove -SkipFrontend and build it at least once."
        exit 1
    }
}

# ---------------------------------------------------------------------
# 4/5. Backend
# ---------------------------------------------------------------------
if (-not $SkipBackend) {
    Write-Step "2/6: Installing backend Python dependencies"
    Invoke-Checked -Exe $pythonCmd -ArgumentList @('-m', 'pip', 'install', '-r', 'requirements.txt') -WorkingDirectory $Root

    Write-Step "3/6: Freezing the Django backend into SmartShootsBackend.exe"
    Invoke-Checked -Exe $pythonCmd -ArgumentList @('-m', 'PyInstaller', '--noconfirm', 'backend.spec') -WorkingDirectory $Root

    $frozenBackend = Join-Path $Root 'dist\SmartShootsBackend'
    if (-not (Test-Path $frozenBackend)) {
        throw "PyInstaller did not produce dist\SmartShootsBackend - check the output above for errors."
    }

    Write-Step "4/6: Staging the backend into the desktop app"
    if (Test-Path $BackendOut) { Remove-Item -Recurse -Force $BackendOut }
    New-Item -ItemType Directory -Force -Path (Split-Path $BackendOut) | Out-Null
    Copy-Item -Recurse -Force $frozenBackend $BackendOut
    Write-Ok "Backend staged -> desktop-app\build-resources\backend"
} else {
    Write-Step "2-4/6: Skipping backend freeze (-SkipBackend)"
    if (-not (Test-Path $BackendOut)) {
        Write-Err "desktop-app\build-resources\backend doesn't exist. Remove -SkipBackend and build it at least once."
        exit 1
    }
}

# ---------------------------------------------------------------------
# 5. Electron installer
# ---------------------------------------------------------------------
Write-Step "5/6: Building the Windows installer with electron-builder"
Invoke-Checked -Exe 'npm' -ArgumentList @('install') -WorkingDirectory $Desktop
Invoke-Checked -Exe 'npm' -ArgumentList @('run', 'dist') -WorkingDirectory $Desktop

$installer = Get-ChildItem -Path (Join-Path $Desktop 'dist') -Filter '*.exe' -ErrorAction SilentlyContinue | Select-Object -First 1

Write-Host ""
if ($installer) {
    Write-Host "=======================================================" -ForegroundColor Green
    Write-Host " Desktop build complete!" -ForegroundColor Green
    Write-Host " Installer: $($installer.FullName)" -ForegroundColor Green
    Write-Host "=======================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "That single file is everything a Windows user needs - no Python," -ForegroundColor DarkGray
    Write-Host "Node, or separate backend install required on their machine." -ForegroundColor DarkGray
} else {
    Write-Err "Build finished but no .exe was found under desktop-app\dist - check the electron-builder output above."
    exit 1
}

# ---------------------------------------------------------------------
# 6. Android APK - a SEPARATE frontend build (see mobile-app/README-ANDROID.md
#    for why: Django needs assets under /static/, Capacitor serves webDir
#    at its own root - reusing one build for both caused a blank white
#    screen on the native app). Needs a JDK + Android SDK, which is a much
#    heavier ask than Node/Python, so this checks for them and SKIPS with
#    a clear explanation instead of failing the whole script if missing -
#    the desktop installer above is already a complete, successful result
#    on its own either way.
# ---------------------------------------------------------------------
$apkBuilt = $false
if (-not $SkipApk) {
    Write-Step "6/6: Android APK (optional)"

    $hasJava = Test-Command 'java'
    $androidHome = $env:ANDROID_HOME
    if (-not $androidHome) { $androidHome = $env:ANDROID_SDK_ROOT }
    $hasAndroidSdk = $androidHome -and (Test-Path $androidHome)

    if (-not $hasJava -or -not $hasAndroidSdk) {
        Write-Warn2 "Skipping the Android APK - not a failure, just not set up yet:"
        if (-not $hasJava) { Write-Host "    - No Java/JDK found on PATH (Android Studio installs one; or get Temurin 17 from adoptium.net)" -ForegroundColor Yellow }
        if (-not $hasAndroidSdk) { Write-Host "    - ANDROID_HOME / ANDROID_SDK_ROOT isn't set (install Android Studio, then set it to the SDK path it shows you)" -ForegroundColor Yellow }
        Write-Host "    Easiest path: winget install -e --id Google.AndroidStudio, open it once to finish SDK setup, restart PowerShell, then re-run this script." -ForegroundColor DarkGray
        Write-Host "    The Windows installer above is unaffected and already complete." -ForegroundColor DarkGray
    } else {
        Write-Ok "Java and Android SDK both found - building the APK"
        $Mobile = Join-Path $Root 'mobile-app'
        try {
            Invoke-Checked -Exe 'npm' -ArgumentList @('install') -WorkingDirectory $Mobile
            # NOTE: this runs `prebuild:frontend` internally first (builds
            # frontend/dist-mobile with the correct asset paths for
            # Capacitor) before syncing and invoking Gradle - see
            # mobile-app/package.json.
            Invoke-Checked -Exe 'npm' -ArgumentList @('run', 'build:apk') -WorkingDirectory $Mobile
            $apk = Get-ChildItem -Path (Join-Path $Mobile 'android\app\build\outputs\apk') -Filter '*.apk' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($apk) {
                $apkBuilt = $true
                Write-Host ""
                Write-Host "=======================================================" -ForegroundColor Green
                Write-Host " Android build complete!" -ForegroundColor Green
                Write-Host " APK: $($apk.FullName)" -ForegroundColor Green
                Write-Host "=======================================================" -ForegroundColor Green
                Write-Host "Copy this file to the phone/tablet and open it there to install" -ForegroundColor DarkGray
                Write-Host "('allow installs from unknown sources' for a debug build like this)." -ForegroundColor DarkGray
            } else {
                Write-Warn2 "APK build ran but no .apk was found under mobile-app\android\app\build\outputs\apk - check the Gradle output above."
            }
        } catch {
            # CAUTION: an Android build failure must never take down the
            # Windows installer that already succeeded above - it's
            # reported clearly and the script still exits 0 overall.
            Write-Warn2 "Android build failed: $($_.Exception.Message)"
            Write-Host "    The Windows installer above is unaffected and already complete." -ForegroundColor DarkGray
        }
    }
} else {
    Write-Step "6/6: Skipping Android APK (-SkipApk)"
}

Write-Host ""
Write-Host "Done. Desktop installer: $(if ($installer) {'yes'} else {'no'})   Android APK: $(if ($apkBuilt) {'yes'} else {'skipped'})" -ForegroundColor Cyan
