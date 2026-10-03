# Running SMART SHOOTS on Windows

There are two ways to run this. Pick based on what you're doing.

## A) Quick dev run (you have Python + Node installed)

**Security note:** the backend now listens on `0.0.0.0` (every network
interface), not just `127.0.0.1` - this is what makes the "Connect Your
Phone" QR code in Settings work, since it lets another device on your
Wi-Fi actually reach it. It also means anyone else on the same
Wi-Fi/LAN can reach the app's API too (still behind login, but worth
knowing). Windows may prompt to allow this the first time - see
README-ANDROID.md's Troubleshooting section if that prompt gets missed
or declined.

```bat
:: one-time setup
pip install -r requirements.txt
cd frontend
npm install
npm run build
cd ..

:: every time you want to use the app
cd desktop-app
npm install
npm start
```

This launches the Electron window, which starts `run_server.py` for you in
the background (migrations run automatically, a default admin account is
created the first time: **admin / admin123** - change the password in
Settings after logging in). You never type `manage.py runserver` yourself.

Want some realistic demo data (sample clients, orders, payments, an
appointment) to click around with? Run this once after the first launch:

```bat
python manage.py load_sample_data
```

## B) Build the final installer (what you hand to other people)

This produces **one .exe installer**. Whoever runs it needs nothing else -
no Python, no Node, no manual backend step, ever.

**Easiest: one-click.** Double-click **`install_smartshoots.bat`** in the
project root. It requests Administrator permission once (needed only to
install Node.js/Python automatically via `winget` if either is missing),
checks everything it needs, then builds and offers to launch the finished
installer for you - no typing required. This is the same PowerShell build
underneath (see below), just wrapped with prerequisite checks and a
friendlier front end.

**Manual, if you prefer to run it yourself:**
```bat
python build_windows.py
```
or, from PowerShell:
```powershell
.\build_windows.ps1
```

Either one does the frontend build, freezes the backend with PyInstaller,
and packages everything with electron-builder. The finished installer
lands in `desktop-app\dist\SMART SHOOTS Setup *.exe`.

Every user's data (SQLite database + uploaded photos/attachments) is
stored under `%APPDATA%\smart-shoots-desktop\data`, separate from the
installed program, so reinstalling/upgrading never wipes their data and
no admin rights are needed to write to it.

If you hit a **different** `ModuleNotFoundError` for some other dotted
path (e.g. `some_package.some_module`), it's the same root cause: add it
to `hiddenimports` in `backend.spec` and re-run `python build_windows.py`.
Anything that only shows up as a *string* in `settings.py` (middleware,
`REST_FRAMEWORK` classes, cache/email backends, etc.) is invisible to
PyInstaller's static analysis and has to be listed by hand.

## Add Client (or Appointment / Expense / Order / Delivery / Evaluation) silently not saving?

This was a real, systemic bug, not just Client. Several models have a
required `created_by` (or `uploaded_by`) field with no default - it's
supposed to be set automatically from whoever's logged in, not typed by
the user. The serializers didn't mark those fields read-only, so DRF
treated them as required *input*, and the corresponding "add client
never sends `created_by`" -> instant validation failure, silently, before
anything reached the database. Affected every one of these creates:
Client, Appointment, ResourceBlock, ExpenseCategory, Expense,
ProductionOrder, Delivery, StaffEvaluation, Attachment. Fixed by marking
the field read-only on each serializer and setting it from
`request.user` in each viewset's `perform_create()`.

## Backup/restore not working?

Two more bugs beyond the ones already covered above:

- `BackupView` opened its temp file with no explicit text encoding.
  Windows defaults that to its locale encoding (often `cp1252`), not
  UTF-8 - so the moment your data contains any Arabic text (this app
  explicitly supports Arabic), writing the backup crashed with
  `UnicodeEncodeError` and the download failed. Fixed by opening it with
  `encoding='utf-8'` explicitly.
- (Covered above, but bears repeating): `restore_data` didn't exist as a
  file at all before this pass, and `backup_data` wasn't actually writing
  real data to the captured output.

If backup/restore still misbehave after this, check
`%APPDATA%\smart-shoots-desktop\data\backend.log` for the real traceback
(500 responses from Django print their traceback there since
`DEBUG=False` just returns a generic error page to the browser) and paste
it here.

## Data validation, design refresh, backup/restore UX (latest pass)

- **Phone numbers**: every phone field (User, Client, additional client
  phones, business settings) now requires exactly 11 digits starting with
  010/011/012/015, enforced on both the backend (model validators, so the
  API rejects bad data no matter what client calls it) and the frontend
  (digit-only input filtering + inline error as you type).
- **Names**: Client name and user first/last name now require
  letters only (English or Arabic) - digits and stray symbols are
  filtered out as you type and rejected server-side.
- **Amounts**: Client, Orders, Expenses, and Payments amount/quantity/rate
  fields are now digit-only (with up to 2 decimal places) on the
  frontend, matching what the backend's DecimalField already enforced.
- **WhatsApp links** on the Clients page were broken by the phone format
  change (local `010...` numbers don't work in `wa.me` links, which need
  international format) - fixed with an automatic `010... -> 20...`
  conversion.
- **Backup/Restore UX**: restoring now asks for confirmation first (it's
  destructive - overwrites current data), both actions show a loading
  spinner and a real success/error message instead of silently doing
  nothing or using a browser `alert()`.
- **Visual redesign**: new indigo/amber theme (previously "Inter" font
  was referenced but never actually loaded - now self-hosted so it works
  fully offline), redesigned Login page (split-screen brand panel +
  clean form), gradient top bar, refreshed card/button styling app-wide.
- **Outdoor package type**: was completely missing from the system (not
  just the dropdown) - the `Package` model only defined Learning and
  Reels. Added `outdoor_shoot` end-to-end: model choice, a `session` unit
  option, sample data, and English/Arabic labels.

## Saving / viewing uploads / backup & restore not working?

These were three separate, real bugs (not just Windows/packaging quirks):

- **Uploading a file (attachments)**: the bulk-upload UI posts to
  `/api/finance/attachments/bulk/`, but that route never existed - only
  the plain create endpoint did, so every bulk upload 404'd. A single-file
  upload also failed validation, because `filename`/`file_type`/
  `file_size`/`uploaded_by` were required, writable serializer fields that
  the frontend never actually sends (they're derived from the file
  itself). Fixed: added the missing `bulk` action, and those four fields
  are now read-only and filled in automatically from the uploaded file /
  logged-in user.
- **Viewing/reading an uploaded file afterwards**: Django only
  auto-serves `MEDIA_URL` when `DEBUG=True`. The packaged app always runs
  with `DEBUG=False`, so files saved fine on upload but every later
  request to actually view/download one 404'd. Added an explicit
  `/media/...` route in `config/urls.py` - safe here since this is a
  single-user local app with no public internet exposure.
- **Backup**: `backup_data` wrote your real data to a hardcoded relative
  `backup.json` path (unpredictable/likely unwritable once packaged) and
  only ever printed a plain success *message* - not the data - to the
  output the in-app download button actually captures. So every backup
  you downloaded from the app was literally the text "Backup saved to
  backup.json", not your data. Fixed to write the real JSON to that
  captured output, and also keep a timestamped copy under
  `%APPDATA%\smart-shoots-desktop\data\backups\`.
- **Restore**: the `restore_data` management command that the Restore
  button calls didn't exist anywhere in the codebase at all - clicking
  Restore always crashed with "Unknown command". Added it.

## Blank white page with nothing showing?

This means the HTML loaded but the JS bundle never actually ran - almost
always a URL mismatch between what Vite built and what Django serves.
Two separate bugs of that kind existed here and are now fixed:

1. Vite built asset URLs at the root (`/assets/index-xxx.js`), but
   Django's static files live under `/static/...`. The SPA catch-all
   route in `config/urls.py` only excludes `static/`, `api/`, `admin/`,
   `media/` - so a request for `/assets/index-xxx.js` didn't match any of
   those, got swallowed by the catch-all, and the browser received
   `index.html` back instead of JavaScript (200 OK, wrong content, so it
   looks fine in a quick glance but never executes). Fixed by setting
   Vite's `base` to `/static/` (`frontend/vite.config.ts`) so build output
   URLs now line up with Django's `STATIC_URL`.
2. Django's `CompressedManifestStaticFilesStorage` re-hashes every static
   filename *again* on top of Vite's own content-hash filenames, so the
   file that ends up on disk doesn't match what `index.html` references -
   another silent 404. Switched to `whitenoise.storage.CompressedStaticFilesStorage`
   (compression only, no renaming), which is the correct pairing when your
   build tool (Vite) already fingerprints filenames itself.

If you still get a blank page after pulling this fix, delete the stale
`staticfiles` folder so nothing lingers from a previous broken build,
then rebuild:
```bat
rmdir /s /q staticfiles
python build_windows.py
```
and open the app's dev tools (it's still `console=True`/normal Electron,
so you can right-click -> Inspect, or add `mainWindow.webContents.openDevTools()`
temporarily in `desktop-app/main.js`) to check the Network tab for any
remaining 404s - that will point straight at whatever URL still doesn't
match.

## "Backend did not start" / stuck for 45 seconds?

This usually means the bundled backend crashed immediately on launch, not
that it's actually slow. Two causes have already been fixed here:

- `BASE_DIR` in Django was computed from `__file__`, which isn't a real
  path once PyInstaller freezes the code - so the packaged `.exe` couldn't
  find `frontend/dist` or the app migrations and crashed on startup. Both
  `config/settings.py` and `run_server.py` now use `sys._MEIPASS` (the
  folder PyInstaller actually extracts/collects data into) when frozen.
- Any crash is now written to `backend_error.log` next to the database
  (see path below), and the desktop app itself now shows the backend's
  actual last output in the error dialog instead of a bare "45 seconds"
  message, and fails fast instead of waiting the full timeout if the
  backend process exits early.

If you still hit a startup error, check:
```
%APPDATA%\smart-shoots-desktop\data\backend.log
%APPDATA%\smart-shoots-desktop\data\backend_error.log
```
and re-run `python build_windows.py` after making any further fix.

## Seeing a Pillow / PyInstaller install error on Windows?

If `pip install -r requirements.txt` fails while building Pillow (e.g.
`Getting requirements to build wheel ... error`, `KeyError: '__version__'`),
it means your Python install is newer than the packages had pre-built
Windows wheels for. This has already been fixed here by pinning
`Django==5.2.8`, `Pillow==11.3.0`, `djangorestframework==3.16.1`, and
`pyinstaller==6.20.0` - the first versions of each that officially support
Python 3.14. If you're on an even newer Python by the time you read this
and still hit a build error, either:
- update the version pin for whichever package fails to its current latest
  (`pip install -U Django djangorestframework Pillow pyinstaller` and then
  re-freeze `requirements.txt` with `pip freeze`), or
- install Python 3.12 side-by-side and run everything with `py -3.12`
  instead - the most-tested, least-friction option.

## What was actually broken before this pass

- `apps.ai_assistant` was never added to `INSTALLED_APPS` even though its
  URLs were wired up - opening the AI assistant tab crashed the server.
- Its `AppConfig.name` also didn't match its import path, which is a
  second, separate reason Django would refuse to start once the app was
  registered - both are now fixed together.
- The root URL redirected straight to `/admin/` - the actual React app was
  never shown to end users. `/` (and any client-side route) now serves
  the built frontend, with `/api/...` and `/admin/` still working normally.
- `send_reminders` used `settings.TWILIO_ACCOUNT_SID` without importing
  `settings` - guaranteed crash any time it ran.
- `notifications/services.py` imported the `twilio` package at module load
  time, even though it's optional and wasn't in any requirements file -
  crashed on import on a machine without it installed.
- There was **no `requirements.txt` at all** - a fresh machine had no way
  to know what to `pip install`. Pillow (needed for the avatar/logo image
  fields) was also missing.
- The Electron app spawned the system `python` command directly and
  assumed port 8000 was free - meaning end users needed Python + every
  dependency installed by hand, which is the exact problem this rewrite
  removes. It now runs a bundled, self-contained backend .exe with no
  external dependencies, reads back whatever port it actually started on,
  and reliably kills the whole backend process tree on exit instead of
  leaving orphaned processes running (a Windows-specific `taskkill`
  quirk with the old `shell:true` spawn).
- A stray empty `New Text Document.txt` file was left inside the
  `notifications` app folder and has been removed.
- Django's dev server (`runserver`) was being used as if it were a real
  production server. The app now runs on `waitress`, a proper WSGI server,
  for a much steadier desktop-app experience.
