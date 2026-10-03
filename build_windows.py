#!/usr/bin/env python
"""
build_windows.py - one command to produce a single, self-contained
SMART SHOOTS installer for Windows.

Run this ONCE on a Windows machine (the developer's machine), with Python
3.11+ and Node.js installed. The OUTPUT is what you hand to end users, and
THEY need nothing installed - no Python, no Node, no separate "start the
backend" step. Double-click the installer, then double-click the app icon.

    python build_windows.py

What it does, in order:
  1. npm install + npm run build  in frontend/         -> frontend/dist
  2. pip install -r requirements.txt                    (dev machine only)
  3. pyinstaller backend.spec                           -> dist/SmartShootsBackend/
  4. Copies that folder into desktop-app/build-resources/backend
  5. npm install + npm run dist   in desktop-app/       -> the final .exe installer

The finished installer is written to desktop-app/dist/SMART SHOOTS Setup *.exe
"""
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def run(cmd, cwd):
    print(f"\n$ {' '.join(cmd)}   (in {cwd})")
    subprocess.run(cmd, cwd=cwd, shell=(sys.platform == 'win32'), check=True)


def kill_leftover_processes():
    """
    FIX: electron-builder failed with "Access is denied" trying to
    overwrite SmartShootsBackend.exe in a previous build - because a
    manually-launched copy of it (e.g. run directly for testing, or a
    still-open instance of the app) was still running and Windows locks
    the .exe file of any running process. Kill known leftover processes
    before touching dist/ so a rebuild never gets blocked by this again.
    """
    if sys.platform != 'win32':
        return
    for name in ('SmartShootsBackend.exe', 'SMART SHOOTS.exe'):
        subprocess.run(['taskkill', '/IM', name, '/F'],
                        capture_output=True)  # ignore result - fine if not running


def main():
    if sys.platform != 'win32':
        print("This script must be run on Windows to produce a Windows .exe "
              "(PyInstaller/electron-builder both build for the OS they run on).")
        sys.exit(1)

    kill_leftover_processes()

    frontend = ROOT / 'frontend'
    desktop = ROOT / 'desktop-app'
    backend_out = desktop / 'build-resources' / 'backend'

    print("== 1/5: building the React frontend ==")
    run(['npm', 'install'], cwd=frontend)
    run(['npm', 'run', 'build'], cwd=frontend)

    print("== 2/5: installing backend Python dependencies ==")
    run([sys.executable, '-m', 'pip', 'install', '-r', 'requirements.txt'], cwd=ROOT)

    print("== 3/5: freezing the Django backend into SmartShootsBackend.exe ==")
    run([sys.executable, '-m', 'PyInstaller', '--noconfirm', 'backend.spec'], cwd=ROOT)

    print("== 4/5: staging the backend into the desktop app ==")
    if backend_out.exists():
        shutil.rmtree(backend_out)
    shutil.copytree(ROOT / 'dist' / 'SmartShootsBackend', backend_out)

    print("== 5/5: building the Windows installer with electron-builder ==")
    run(['npm', 'install'], cwd=desktop)
    run(['npm', 'run', 'dist'], cwd=desktop)

    print("\nDone! Find the installer under desktop-app/dist/*.exe")
    print("That single file is everything an end user needs - no separate")
    print("backend, Python, or Node install required on their machine.")


if __name__ == '__main__':
    main()
