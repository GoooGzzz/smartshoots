# backend.spec
#
# Freezes run_server.py (Django + waitress) into a single Windows .exe with
# NO external Python/pip dependency for the end user.
#
# Run on WINDOWS with:  pyinstaller backend.spec
# (PyInstaller builds for whatever OS it runs on - it must be run on a
# Windows machine, or in a Windows CI runner, to produce a .exe.)
#
# Output: dist/SmartShootsBackend/SmartShootsBackend.exe plus its _internal/
# folder. build_windows.py copies that whole folder into
# desktop-app/build-resources/backend so electron-builder can bundle it.

import glob
import os

block_cipher = None

# Bundle every migrations folder + the built React app as data files, since
# PyInstaller only auto-detects imported .py code, not data/templates.
datas = [
    ('frontend/dist', 'frontend/dist'),
]
for migrations_dir in glob.glob('apps/*/migrations'):
    app_name = migrations_dir.split(os.sep)[1]
    datas.append((migrations_dir, f'apps/{app_name}/migrations'))

hiddenimports = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework.authtoken',
    'corsheaders',
    'django_filters',
    'django_fsm',
    'whitenoise',
    'whitenoise.storage',      # FIX: only referenced as a string in
    'whitenoise.middleware',   # STORAGES/MIDDLEWARE, so PyInstaller's
                               # static analysis never found it and left
                               # it out - caused "ModuleNotFoundError:
                               # No module named 'whitenoise.storage'"
                               # during collectstatic in the frozen .exe.
    'waitress',
    'PIL',
    'apps.accounts',
    'apps.production',
    'apps.scheduling',
    'apps.finance',
    'apps.notifications',
    'apps.reports',
    'apps.ai_assistant',
    # FIX: everything below is referenced only as a dotted STRING in
    # settings.py (MIDDLEWARE, REST_FRAMEWORK dict) - Django/DRF import
    # these dynamically at runtime via import_string(), so PyInstaller's
    # static analysis can't see the reference and leaves them out unless
    # listed explicitly here. whitenoise.storage was the first one that
    # crashed (see README-WINDOWS.md); these are the same class of bug
    # for other settings, added up front instead of one crash at a time.
    'corsheaders.middleware',
    'rest_framework.filters',
    'rest_framework.pagination',
    'rest_framework.authentication',
    'rest_framework.permissions',
    'django_filters.rest_framework',
    # FIX: management commands (backup_data, restore_data, load_sample_data)
    # are loaded by Django's `call_command()` dynamically via
    # importlib/pkgutil scanning of each app's management/commands/
    # package - there's no literal `import apps.finance.management.
    # commands.backup_data` anywhere in the codebase for PyInstaller's
    # static analysis to follow. Left out of hiddenimports, the frozen
    # .exe raised "Unknown command" the moment Settings > Backup (or
    # Restore) was used, even though the exact same code worked fine
    # with a normal `python manage.py backup_data` outside PyInstaller.
    'apps.finance.management',
    'apps.finance.management.commands',
    'apps.finance.management.commands.backup_data',
    'apps.finance.management.commands.restore_data',
    'apps.accounts.management',
    'apps.accounts.management.commands',
    'apps.accounts.management.commands.load_sample_data',
]

a = Analysis(
    ['run_server.py'],
    pathex=['.'],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='SmartShootsBackend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,  # keep a console window in early builds so errors are
                   # visible; flip to False once you trust the build.
)
coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    name='SmartShootsBackend',
)
