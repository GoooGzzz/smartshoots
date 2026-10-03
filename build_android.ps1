#Requires -Version 5.1
<#
.SYNOPSIS
    Builds a debug-signed SMART SHOOTS Android APK (personal/sideload use,
    no Google Play account or paid certificate needed).

.DESCRIPTION
    "Unsigned" APKs cannot actually be installed on Android - it's an OS
    requirement, not a Play Store one. What this script produces instead
    is DEBUG-signed: Android's own tooling auto-generates a free, local
    debug keystore the first time you build, and that's enough to install
    and run on your own phone via "install unknown apps" - no developer
    account, no purchased certificate, no Play Store submission.

    This wraps the SAME React app used by the Windows build (frontend/)
    as a native Android app via Capacitor - it is not a separate rewrite.
    It talks to the same Django backend over Wi-Fi (configure the PC's
    address from Settings > Server Address in the app after installing),
    and keeps working (viewing cached data, queuing new entries) if Wi-Fi
    drops temporarily, syncing automatically once it's back.

.PARAMETER Clean
    Delete previous build output (frontend/dist, mobile-app/android/app/build)
    before building.

.EXAMPLE
    .\build_android.ps1
#>
[CmdletBinding()]
param(
    [switch]$Clean,
    [switch]$InstallSdk   # download + install the Android SDK automatically if none is found
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

function Write-Step($msg) { Write-Host ""; Write-Host "== $msg ==" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn2($msg) { Write-Host "  [!] $msg" -ForegroundColor Yellow }
function Write-Err($msg) { Write-Host "  [FAIL] $msg" -ForegroundColor Red }
function Test-Command($name) { return [bool](Get-Command $name -ErrorAction SilentlyContinue) }

function Invoke-Checked {
    param([Parameter(Mandatory)][string]$Exe, [Parameter(Mandatory)][string[]]$ArgumentList, [Parameter(Mandatory)][string]$WorkingDirectory)
    Write-Host "  `$ $Exe $($ArgumentList -join ' ')   (in $WorkingDirectory)" -ForegroundColor DarkGray
    $prevLoc = Get-Location
    try {
        Set-Location $WorkingDirectory
        & $Exe @ArgumentList
        if ($LASTEXITCODE -ne 0) { throw "'$Exe $($ArgumentList -join ' ')' exited with code $LASTEXITCODE" }
    } finally {
        Set-Location $prevLoc
    }
}

# ---------------------------------------------------------------------
# 0. Toolchain: Node, JDK 17+, Android SDK (found or installed automatically)
# ---------------------------------------------------------------------
Write-Step "Checking prerequisites"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$Frontend = Join-Path $Root 'frontend'
$Mobile = Join-Path $Root 'mobile-app'
$AndroidDir = Join-Path $Mobile 'android'
$missing = @()

if (-not (Test-Command 'node')) { $missing += "Node.js 18+  (https://nodejs.org)" } else { Write-Ok "Node.js $(node --version)" }
if (-not (Test-Command 'npm')) { $missing += "npm (comes with Node.js)" } else { Write-Ok "npm $(npm --version)" }

function Get-JavaMajor($javaHome) {
    if (-not $javaHome) { return 0 }
    $exe = Join-Path $javaHome 'bin\java.exe'
    if (-not (Test-Path $exe)) { return 0 }
    # Read the JDK's own 'release' file. (Running `java -version` prints to
    # stderr, which Windows PowerShell 5.1 turns into a terminating error
    # under $ErrorActionPreference = 'Stop'.)
    $rel = Join-Path $javaHome 'release'
    if (Test-Path $rel) {
        $m = Select-String -Path $rel -Pattern '^JAVA_VERSION="?([0-9.]+)' | Select-Object -First 1
        if ($m) {
            $v = $m.Matches[0].Groups[1].Value
            if ($v -like '1.*') { return [int]($v.Split('.')[1]) }
            return [int]($v.Split('.')[0])
        }
    }
    # Fallback: run it with error-stopping switched off.
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { $out = (cmd /c "`"$exe`" -version 2>&1") | Out-String } finally { $ErrorActionPreference = $prev }
    if ($out -match 'version "1\.(\d+)') { return [int]$Matches[1] }
    if ($out -match 'version "(\d+)') { return [int]$Matches[1] }
    return 0
}

# FIX: @capacitor/android 8.x hardcodes sourceCompatibility/
# targetCompatibility = JavaVersion.VERSION_21 in its own build.gradle -
# javac can't target a release newer than the JDK actually running it, so
# building with JDK 17 fails with "invalid source release: 21" (a real
# Capacitor 8.x requirement, not a config mistake). JDK 21 is required;
# JDK 17 no longer works with this Capacitor version.
$jdkCandidates = @($env:JAVA_HOME)
foreach ($pat in @('C:\Program Files\Eclipse Adoptium\jdk-21*', 'C:\Program Files\Eclipse Adoptium\jdk-22*', 'C:\Program Files\Eclipse Adoptium\jdk-25*', 'C:\Program Files\Microsoft\jdk-21*', 'C:\Program Files\Java\jdk-21*', 'C:\Program Files\Android\Android Studio\jbr')) {
    $jdkCandidates += (Get-ChildItem -Path $pat -Directory -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName)
}
$jdk = $jdkCandidates | Where-Object { $_ -and ((Get-JavaMajor $_) -ge 21) } | Select-Object -First 1

if (-not $jdk -and $InstallSdk) {
    Write-Step "No JDK 21+ found - installing Temurin 21"
    $msi = Join-Path $env:TEMP 'temurin21.msi'
    $ok = $false
    foreach ($try in 1..3) {
        try { Invoke-WebRequest 'https://api.adoptium.net/v3/installer/latest/21/ga/windows/x64/jdk/hotspot/normal/eclipse' -OutFile $msi -UseBasicParsing; $ok = $true; break }
        catch { Write-Warn2 "Download attempt $try failed: $($_.Exception.Message)"; Start-Sleep 3 }
    }
    if ($ok) {
        Start-Process msiexec.exe -Wait -ArgumentList "/i `"$msi`" /qn ADDLOCAL=FeatureMain,FeatureEnvironment,FeatureJavaHome"
        $jdk = Get-ChildItem -Path 'C:\Program Files\Eclipse Adoptium\jdk-21*' -Directory -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
    }
}

if ($jdk) {
    $env:JAVA_HOME = $jdk
    $env:Path = "$(Join-Path $jdk 'bin');$env:Path"
    Write-Ok "JDK $(Get-JavaMajor $jdk) -> $jdk"
} else {
    $missing += "JDK 21+  (needed by @capacitor/android 8.x - install Temurin 21: https://adoptium.net/temurin/releases/?version=21 - or re-run with -InstallSdk to fetch it automatically - or Android Studio, which includes a JDK 21+)"
}

# Android SDK: env var, then the usual install locations.
$sdk = @($env:ANDROID_HOME, $env:ANDROID_SDK_ROOT, (Join-Path $env:LOCALAPPDATA 'Android\Sdk'), 'C:\Android\Sdk') |
    Where-Object { $_ -and (Test-Path (Join-Path $_ 'platforms')) } | Select-Object -First 1

function Install-AndroidSdk($target) {
    Write-Step "Installing the Android SDK into $target"
    New-Item -ItemType Directory -Force (Join-Path $target 'cmdline-tools') | Out-Null
    $zip = Join-Path $env:TEMP 'cmdline-tools.zip'
    $ok = $false
    foreach ($try in 1..3) {
        try { Invoke-WebRequest 'https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip' -OutFile $zip -UseBasicParsing; $ok = $true; break }
        catch { Write-Warn2 "Download attempt $try failed: $($_.Exception.Message)"; Start-Sleep 3 }
    }
    if (-not $ok) { throw "Could not download the Android command-line tools (network/antivirus blocking dl.google.com?). Install Android Studio instead: https://developer.android.com/studio" }
    $latest = Join-Path $target 'cmdline-tools\latest'
    if (Test-Path $latest) { Remove-Item -Recurse -Force $latest }
    Expand-Archive $zip (Join-Path $target 'cmdline-tools') -Force
    Rename-Item (Join-Path $target 'cmdline-tools\cmdline-tools') 'latest'
    $sm = Join-Path $latest 'bin\sdkmanager.bat'
    1..40 | ForEach-Object { 'y' } | & $sm "--sdk_root=$target" --licenses | Out-Null
    & $sm "--sdk_root=$target" 'platform-tools' 'platforms;android-36' 'build-tools;36.0.0'
    if ($LASTEXITCODE -ne 0) { throw "sdkmanager failed (exit $LASTEXITCODE)" }
}

if (-not $sdk) {
    if ($InstallSdk -and $jdk) {
        $sdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
        Install-AndroidSdk $sdk
    } else {
        $missing += "Android SDK  (re-run with:  .\build_android.ps1 -InstallSdk   to download it automatically, or install Android Studio)"
    }
}
if ($sdk) {
    $env:ANDROID_HOME = $sdk; $env:ANDROID_SDK_ROOT = $sdk
    Write-Ok "Android SDK -> $sdk"
}

if ($missing.Count -gt 0) {
    Write-Err "Missing required tools:"
    $missing | ForEach-Object { Write-Host "    - $_" -ForegroundColor Red }
    exit 1
}

# Tell Gradle about them (files, so it also works from Android Studio) and
# harden its downloads - "Read timed out" on slow links was a build killer.
function Set-PropLine($file, $key, $value) {
    $lines = @(); if (Test-Path $file) { $lines = @(Get-Content $file | Where-Object { $_ -notmatch ('^' + [regex]::Escape($key) + '=') }) }
    $lines += "$key=$value"
    Set-Content -Path $file -Value $lines -Encoding ascii
}
Set-PropLine (Join-Path $AndroidDir 'local.properties') 'sdk.dir' ($sdk -replace '\\', '\\')
$gp = Join-Path $AndroidDir 'gradle.properties'
Set-PropLine $gp 'org.gradle.java.home' ($jdk -replace '\\', '/')
foreach ($k in 'systemProp.http.socketTimeout', 'systemProp.http.connectionTimeout', 'systemProp.https.socketTimeout', 'systemProp.https.connectionTimeout') { Set-PropLine $gp $k '180000' }
Write-Ok "Wrote local.properties + gradle.properties (JDK, SDK, network timeouts)"

if ($Clean) {
    Write-Step "Cleaning previous build output"
    foreach ($p in @((Join-Path $Frontend 'dist'), (Join-Path $Frontend 'dist-mobile'), (Join-Path $AndroidDir 'app\build'), (Join-Path $AndroidDir 'build'))) {
        if (Test-Path $p) { Remove-Item -Recurse -Force $p; Write-Ok "Removed $p" }
    }
}

# ---------------------------------------------------------------------
# 1. Build the frontend - BOTH targets
# ---------------------------------------------------------------------
Write-Step "1/3: Building the React frontend"
Invoke-Checked -Exe 'npm' -ArgumentList @('install') -WorkingDirectory $Frontend
# FIX: this used to build only the Django/desktop bundle (dist), but the APK
# is packaged from dist-mobile - so the APK silently kept shipping an OLD
# copy of the app and never received new features (offline caching etc.).
Invoke-Checked -Exe 'npm' -ArgumentList @('run', 'build') -WorkingDirectory $Frontend
Invoke-Checked -Exe 'npm' -ArgumentList @('run', 'build:mobile') -WorkingDirectory $Frontend
if (-not (Test-Path (Join-Path $Frontend 'dist-mobile\index.html'))) {
    throw "frontend/dist-mobile/index.html wasn't produced - the mobile frontend build did not complete."
}
Write-Ok "Frontend built -> frontend\dist (web) and frontend\dist-mobile (APK)"

# FIX: `python manage.py runserver` (what you run for the web/desktop
# server) does NOT read frontend/dist directly - it serves the copy
# Django's collectstatic puts in staticfiles/. Skipping this after a
# rebuild leaves OLD JS/CSS files being served under brand-new filenames
# in a fresh index.html - every asset 404s and the app never gets past
# its own loading screen. Now run automatically after every build so
# this can't happen again from this script.
Write-Step "Collecting static files for the web/desktop server (staticfiles/)"
Invoke-Checked -Exe 'python' -ArgumentList @('manage.py', 'collectstatic', '--noinput', '--clear') -WorkingDirectory $Root
Write-Ok "staticfiles/ refreshed - restart 'python manage.py runserver' to pick it up"

# ---------------------------------------------------------------------
# 2. Sync the mobile build into the Capacitor/Android project
# ---------------------------------------------------------------------
Write-Step "2/3: Installing mobile-app dependencies and syncing into Android"
Invoke-Checked -Exe 'npm' -ArgumentList @('install') -WorkingDirectory $Mobile
Invoke-Checked -Exe 'npx' -ArgumentList @('cap', 'sync', 'android') -WorkingDirectory $Mobile

# ---------------------------------------------------------------------
# 3. Debug build via Gradle (auto-signed with Android's local debug key)
# ---------------------------------------------------------------------
Write-Step "3/3: Building the debug APK with Gradle"
$gradlew = if (Test-Path (Join-Path $AndroidDir 'gradlew.bat')) { '.\gradlew.bat' } else { './gradlew' }
try { Invoke-Checked -Exe $gradlew -ArgumentList @('--stop') -WorkingDirectory $AndroidDir } catch { }
$built = $false
foreach ($attempt in 1..3) {
    try { Invoke-Checked -Exe $gradlew -ArgumentList @('assembleDebug') -WorkingDirectory $AndroidDir; $built = $true; break }
    catch {
        Write-Warn2 "Gradle attempt $attempt failed: $($_.Exception.Message)"
        if ($attempt -lt 3) { Write-Warn2 "Retrying (downloads are often just a network hiccup)..."; Start-Sleep 5 }
    }
}
if (-not $built) {
    Write-Err "Gradle build failed 3 times. Run  cd mobile-app\android ; .\gradlew.bat assembleDebug --stacktrace  and send the FIRST 'What went wrong' block."
    exit 1
}

$apk = Get-ChildItem -Path (Join-Path $AndroidDir 'app\build\outputs\apk\debug') -Filter '*.apk' -ErrorAction SilentlyContinue | Select-Object -First 1

Write-Host ""
if ($apk) {
    Write-Host "=======================================================" -ForegroundColor Green
    Write-Host " Build complete!" -ForegroundColor Green
    Write-Host " APK: $($apk.FullName)" -ForegroundColor Green
    Write-Host "=======================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Install: copy the .apk to the phone and open it (allow 'install unknown apps'),"  -ForegroundColor DarkGray
    Write-Host "or with USB debugging: adb install -r `"$($apk.FullName)`"  (-r keeps your data when updating)" -ForegroundColor DarkGray
    Write-Host "First launch: Settings > Server Address > e.g. http://192.168.1.20:8000" -ForegroundColor DarkGray
} else {
    Write-Err "Build finished but no .apk was found under mobile-app\android\app\build\outputs\apk\debug."
    exit 1
}
