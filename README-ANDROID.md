# SMART SHOOTS - Android (personal/sideload build)

This packages the exact same React app used by the Windows desktop build
as a native Android app, via [Capacitor](https://capacitorjs.com/). It is
**not** a separate rewrite - `mobile-app/` wraps a frontend build, though
**not the same build folder** the desktop app uses (see the note below -
this matters, and got it wrong at one point).

## Why there are two frontend builds, not one

The desktop app is served by Django, which expects static assets under
`/static/...` - so `frontend/`'s normal `npm run build` compiles with
that path baked in. Capacitor, on the other hand, serves its `webDir`
folder directly at its own root, with no `/static/` prefix at all. Using
the *same* build for both used to cause a **blank white screen on
launch**: index.html loaded, but every JS/CSS request 404'd inside the
WebView (page loads, script never runs - browser/QR access worked fine
because that goes through the real Django server, which is why it looked
so confusing).

The fix: two separate builds.
- `npm run build` in `frontend/` -> `frontend/dist` (Django/desktop only)
- `npm run build:mobile` in `frontend/` -> `frontend/dist-mobile` (Android only)

`mobile-app/capacitor.config.ts`'s `webDir` points at `dist-mobile`, and
`npm run build:apk` in `mobile-app/` now runs the correct frontend build
automatically before syncing - you don't need to remember to do this by
hand, but if you're ever troubleshooting a blank screen again, this is
the first thing to check: **is `mobile-app/android/app/src/main/assets/public`
actually a copy of `dist-mobile`, not `dist`?**

## How it connects to your data

The phone talks to a Django backend over the internet or your local
Wi-Fi - it does not run its own separate copy of the server or database.
Two ways to set that up:

- **Cloud server (works from anywhere)** - deploy the backend once to a
  small always-on VPS with a real domain and HTTPS. See **DEPLOY.md** in
  the project root for the full step-by-step guide. This is the way to
  go if you want the phone to work away from your home/office Wi-Fi.
- **Your PC on the same Wi-Fi (no extra setup, but LAN-only)** - run the
  Windows app (or just `python run_server.py`) and use the PC's local
  network address instead.

Either way, the very first time you open the app on the phone, go to
**Settings > Server Address** and enter it, e.g.:
```
https://smartshoots.yourdomain.com     (cloud, recommended)
http://192.168.1.20:8000               (PC on the same Wi-Fi)
```

### What happens if Wi-Fi drops
The app keeps working in a limited way:
- Pages you've already loaded keep showing their last-known data (a red
  banner appears explaining the server is unreachable).
- New entries (Add Client/Order/Payment/etc.) are accepted and queued
  locally instead of failing outright.
- The moment the connection comes back, queued changes are sent to the
  server automatically, in the order they were made, and a "All changes
  synced" confirmation appears.

This is a **cache + retry queue on top of the same backend** - it is not
an independent copy of the business logic running on the phone. Two
different devices editing the same record while both offline, or editing
something you created offline before it's synced, aren't reconciled
automatically; that would be a much larger project (full multi-writer
sync).

## About "signing"
Android will not install a truly unsigned APK - that's an OS-level rule,
not a Google Play one. This build is **debug-signed**: Android's tooling
auto-generates a free local key the first time you build, with no
developer account, no payment, and no Play Store involved. That's enough
to install and use the app on your own phone(s) indefinitely.

## Prerequisites (one-time, on the machine that builds the APK)
- **Node.js 18+** - https://nodejs.org
- **Android Studio** - https://developer.android.com/studio
  Open it once after installing; it downloads the Android SDK and a JDK
  for you. You don't need to create a new project in it, just let the
  first-run setup finish.
- After that first run, note the SDK path shown under
  *Settings > Languages & Frameworks > Android SDK*, and set it as an
  environment variable (one time):
  ```powershell
  [System.Environment]::SetEnvironmentVariable('ANDROID_HOME', 'C:\Users\<you>\AppData\Local\Android\Sdk', 'User')
  ```
  Then open a **new** PowerShell window so it picks up the change.

## Building the APK
From the project root, in PowerShell:
```powershell
.\build_android.ps1
```
(If you get a script-signing error, first run
`Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` in that
same window - see the desktop build's troubleshooting notes for why.)

The script builds the frontend, syncs it into the Android project, and
runs Gradle. The finished file is:
```
mobile-app\android\app\build\outputs\apk\debug\app-debug.apk
```

### Rebuilding after a code change
Just re-run `.\build_android.ps1`. Add `-Clean` to wipe previous build
output first if something seems stale.

## Installing on your phone
On the phone, **Settings > Security (or "Apps") > Install unknown apps**
needs to be allowed for whatever app you'll open the `.apk` with (Files,
Chrome, Gmail, etc.) - Android will prompt for this the first time
regardless if you forget.

- **Easiest:** copy `app-debug.apk` to the phone (USB cable, email
  yourself, a cloud drive, etc.) and open it from the phone's file
  manager.
- **Via USB with Developer Options enabled:**
  ```powershell
  adb install "mobile-app\android\app\build\outputs\apk\debug\app-debug.apk"
  ```

## Troubleshooting
- **Scanning the QR (or typing the IP) just spins/loads forever and
  never connects:** this is almost always **Windows Firewall**. The
  first time the Windows app starts after this address feature was
  added, Windows may show a prompt like *"Windows Defender Firewall has
  blocked some features of SmartShootsBackend"* - click **Allow access**
  (for Private networks). If you missed that prompt or clicked
  "Cancel," open **Windows Security > Firewall & network protection >
  Allow an app through firewall**, find SmartShootsBackend (or
  SMART SHOOTS), and make sure both "Private" boxes are checked.
- **"Can't reach the local server" banner right after install:** almost
  always the Server Address in Settings is wrong, the PC's backend isn't
  running, the phone and PC aren't on the same Wi-Fi network, or the
  Windows Firewall issue above.
- **Gradle build fails on first run:** it needs to download some
  packages the first time (from Google's Maven repo and
  services.gradle.org) - make sure the build machine has normal internet
  access. Corporate/locked-down networks sometimes block one of these.
- **App installs but shows a blank white screen:** if using a PC/LAN
  address, double check it's `http://` (not `https://`) and the IP/port
  are correct - Android blocks plain HTTP to the wrong/unreachable host
  silently. If using a cloud address, double check it's `https://` and
  the domain actually resolves (try it in a normal browser first).
