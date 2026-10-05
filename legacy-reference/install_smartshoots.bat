@echo off
setlocal EnableDelayedExpansion
title SMART SHOOTS - Setup
color 0B
cd /d "%~dp0"

:: =======================================================================
:: SMART SHOOTS - one-click installer / build launcher
::
:: What this does, and why:
::  1. Elevates to Administrator once, up front - needed so it can install
::     missing prerequisites (Node.js/Python via winget) itself instead of
::     stopping halfway through with "please go install this and re-run."
::  2. Never touches your system-wide PowerShell execution policy. Every
::     powershell.exe call below passes -ExecutionPolicy Bypass directly
::     on that one invocation instead - this avoids the "is not digitally
::     signed" error from an unsigned local script WITHOUT permanently
::     changing any security setting on your PC (Set-ExecutionPolicy at
::     the system/user level is not used anywhere in this file).
::  3. Checks for Node.js and Python and installs whichever is missing via
::     winget (Windows' built-in package manager, Windows 10 1809+/11).
::  4. Hands off to build_windows.ps1 (already in this folder) for the
::     actual build - real tool output stays visible the whole time, so
::     if something does go wrong you can see exactly what and why,
::     rather than it being hidden behind decoration.
::  5. On success, offers to launch the finished installer immediately.
:: =======================================================================

call :banner

:: ---------------------------------------------------------------------
:: 1. Elevate to Administrator (single UAC prompt, once)
:: ---------------------------------------------------------------------
net session >nul 2>&1
if not "%errorlevel%"=="0" (
    echo   This needs to run as Administrator ^(to install any missing
    echo   prerequisites^) - you'll see a Windows permission prompt next.
    echo.
    call :progress "Requesting permission" 3
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs" 
    exit /b
)
echo   [OK] Running with Administrator permission
echo.

:: ---------------------------------------------------------------------
:: 2. Prerequisites - install anything missing via winget
:: ---------------------------------------------------------------------
call :stage "Checking prerequisites"

where winget >nul 2>&1
if not "%errorlevel%"=="0" (
    echo   [!] winget ^(Windows Package Manager^) isn't available on this PC.
    echo       Missing prerequisites below will need to be installed manually.
    set "HAVE_WINGET=0"
) else (
    echo   [OK] winget available
    set "HAVE_WINGET=1"
)

where node >nul 2>&1
if "%errorlevel%"=="0" (
    echo   [OK] Node.js already installed
) else (
    if "!HAVE_WINGET!"=="1" (
        echo   [!] Node.js not found - installing via winget...
        call :progress "Downloading and installing Node.js LTS" 5
        winget install -e --id OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
        call :refresh_path
        where node >nul 2>&1
        if "!errorlevel!"=="0" (
            echo   [OK] Node.js installed
        ) else (
            echo   [FAIL] Node.js install didn't complete. Install manually from nodejs.org, then re-run this file.
            echo         ^(or try: winget search nodejs   - the package id may have changed^)
            goto :fail_pause
        )
    ) else (
        echo   [FAIL] Node.js not found and winget isn't available. Install from nodejs.org, then re-run this file.
        goto :fail_pause
    )
)

where python >nul 2>&1
if "%errorlevel%"=="0" (
    echo   [OK] Python already installed
) else (
    if "!HAVE_WINGET!"=="1" (
        echo   [!] Python not found - installing via winget...
        call :progress "Downloading and installing Python 3.12" 5
        winget install -e --id Python.Python.3.12 --silent --accept-package-agreements --accept-source-agreements
        call :refresh_path
        where python >nul 2>&1
        if "!errorlevel!"=="0" (
            echo   [OK] Python installed
        ) else (
            echo   [FAIL] Python install didn't complete. Install manually from python.org, then re-run this file.
            echo         ^(or try: winget search python   - the package id may have changed^)
            goto :fail_pause
        )
    ) else (
        echo   [FAIL] Python not found and winget isn't available. Install from python.org, then re-run this file.
        goto :fail_pause
    )
)

echo.
echo   All prerequisites ready.
call :progress "Preparing the build" 4
echo.

:: ---------------------------------------------------------------------
:: 3. Hand off to build_windows.ps1 for the actual build
:: ---------------------------------------------------------------------
call :stage "Building SMART SHOOTS (this can take several minutes)"
echo   Real progress from each tool is shown below as it happens.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build_windows.ps1"
set "BUILD_RESULT=%errorlevel%"

if not "%BUILD_RESULT%"=="0" (
    echo.
    call :stage "Build failed"
    echo   Scroll up for the exact error from the step that failed.
    echo   Common fixes: close any running SMART SHOOTS window first, or
    echo   check you have a normal internet connection ^(the build downloads
    echo   packages the first time it runs^).
    goto :fail_pause
)

:: ---------------------------------------------------------------------
:: 4. Success - find the installer (and APK, if built) and offer to run it
:: ---------------------------------------------------------------------
call :stage "Build complete"

set "INSTALLER_EXE="
for /f "delims=" %%F in ('dir /b /o-d "%~dp0desktop-app\dist\*.exe" 2^>nul') do (
    if not defined INSTALLER_EXE set "INSTALLER_EXE=%~dp0desktop-app\dist\%%F"
)

set "APK_FILE="
for /f "delims=" %%F in ('dir /b /s /o-d "%~dp0mobile-app\android\app\build\outputs\apk\*.apk" 2^>nul') do (
    if not defined APK_FILE set "APK_FILE=%%F"
)

if defined INSTALLER_EXE (
    echo   Windows installer ready:
    echo     !INSTALLER_EXE!
) else (
    echo   [!] Build reported success but no .exe was found under
    echo       desktop-app\dist - check the output above.
)
echo.
if defined APK_FILE (
    echo   Android APK ready ^(copy this to a phone/tablet to install^):
    echo     !APK_FILE!
) else (
    echo   [i] No Android APK was built - this is optional and needs the
    echo       Android SDK ^(Android Studio^) installed separately. See the
    echo       output above for exactly what's missing, if anything.
)
echo.

if defined INSTALLER_EXE (
    choice /C YN /M "  Run the Windows installer now"
    if "!errorlevel!"=="1" (
        start "" "!INSTALLER_EXE!"
    )
)

echo.
echo   Done.
pause
exit /b 0

:fail_pause
echo.
pause
exit /b 1

:: =======================================================================
:: Helper subroutines
:: =======================================================================

:banner
echo.
echo    _____ __  ______    ____  ______   _____ __  ______  ____  ___________
echo   / ___//  ^|/  /   ^|  / __ \/_  __/  / ___// / / / __ \/ __ \/_  __/ ___/
echo   \__ \/ /^|_/ / /^| ^| / /_/ / / /     \__ \/ /_/ / / / / / / / / /  \__ \
echo  ___/ / /  / / ___ ^|/ _, _/ / /     ___/ / __  / /_/ / /_/ / / /  ___/ /
echo /____/_/  /_/_/  ^|_/_/ ^|_^| /_/     /____/_/ /_/\____/\____/ /_/  /____/
echo.
echo                One-click setup ^& installer for Windows
echo   ------------------------------------------------------------------
echo.
exit /b

:stage
echo.
echo   ====================================================================
echo     %~1
echo   ====================================================================
exit /b

:: Prints a short "Xxx..." message followed by an animated run of dots,
:: purely decorative (used only during waits this script fully controls -
:: never layered over real tool output, which stays untouched below).
:progress
setlocal
set "msg=%~1"
set "count=%~2"
if "%count%"=="" set "count=3"
<nul set /p "=  %msg%"
for /l %%i in (1,1,%count%) do (
    ping -n 1 -w 350 127.0.0.1 >nul
    <nul set /p "=."
)
echo.
endlocal
exit /b

:: After winget installs something, the new PATH entry isn't visible to
:: this already-running cmd session without re-reading it from the
:: registry - without this, "Node.js installed" could be immediately
:: followed by "node not found" even though it really did install.
:refresh_path
for /f "tokens=2*" %%A in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "SYS_PATH=%%B"
for /f "tokens=2*" %%A in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "USER_PATH=%%B"
set "PATH=%SYS_PATH%;%USER_PATH%"
exit /b
