const { app, BrowserWindow, shell, dialog, Menu, ipcMain } = require('electron');
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const https = require('https');

// ---------------------------------------------------------------------
// FIXES vs the original main.js:
//  1. It called the system-wide `python` command directly. That meant
//     every end user had to install Python + every pip package by hand -
//     exactly the "needs a backend running" problem this rewrite removes.
//     In a packaged build we now spawn the bundled SmartShootsBackend.exe
//     (built by build_windows.py / backend.spec) which contains its own
//     Python runtime and every dependency, so nothing needs installing.
//  2. It always assumed port 8000 was free. run_server.py now falls back
//     to a random free port and reports it; this file reads that instead
//     of guessing.
//  3. `backendProcess.kill()` doesn't reliably kill everything on Windows
//     when the process was spawned with shell:true (it kills the cmd.exe
//     shell, not the python.exe grandchild), which left orphaned backend
//     processes running after the app was closed. We now use `taskkill
//     /T /F` on Windows to kill the whole process tree.
//  4. Added a single-instance lock, a startup error dialog instead of a
//     silently blank window, and a per-user data directory
//     (app.getPath('userData')) so the SQLite database and uploaded
//     files/media survive reinstalls and don't need admin rights.
// ---------------------------------------------------------------------

let backendProcess;
let backendPort = 8000;
let mainWindow;
let backendLogTail = '';

const isDev = !app.isPackaged;
const backendRoot = isDev
  ? path.join(__dirname, '..')
  : path.join(process.resourcesPath, 'backend');
const dataDir = path.join(app.getPath('userData'), 'data');
const portFile = path.join(dataDir, '.port');
const logFile = path.join(dataDir, 'backend.log');
const connectionConfigFile = path.join(app.getPath('userData'), 'connection-config.json');

// NEW: lets this same desktop app optionally act as a thin client
// pointed at a cloud-hosted backend (see DEPLOY.md) instead of always
// spawning and using its own local one - so the Windows app and the
// Android app can share one real database instead of each keeping a
// separate local copy. Persisted outside the renderer's localStorage
// (which the main process can't read directly) in a small JSON file, so
// the choice survives restarts and is known BEFORE deciding whether to
// spawn a local backend at all.
function readConnectionConfig() {
  try {
    const raw = fs.readFileSync(connectionConfigFile, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && parsed.mode === 'remote' && typeof parsed.remoteUrl === 'string' && parsed.remoteUrl.trim()) {
      return { mode: 'remote', remoteUrl: parsed.remoteUrl.trim().replace(/\/+$/, '') };
    }
  } catch (_) {
    // no config yet, or it's corrupt - fall through to local mode, which
    // is always safe (it's the original, self-contained behavior).
  }
  return { mode: 'local', remoteUrl: '' };
}

function writeConnectionConfig(config) {
  fs.mkdirSync(path.dirname(connectionConfigFile), { recursive: true });
  fs.writeFileSync(connectionConfigFile, JSON.stringify(config, null, 2));
}

let connectionConfig = readConnectionConfig();

function ensureDataDir() {
  fs.mkdirSync(dataDir, { recursive: true });
}

// FIX: this used to generate a brand-new random SECRET_KEY on every
// single launch (`process.env.SMARTSHOOTS_SECRET_KEY || crypto.randomBytes(...)`
// re-evaluated fresh each time startBackend() ran). Django uses this key
// to sign sessions and CSRF tokens, so a different key every restart
// meant those silently stopped validating each time the app was closed
// and reopened - not the cause of a hard crash, but a real, avoidable
// correctness bug. Generated once, the first time the app ever runs on
// a given PC, and reused from then on.
function getOrCreatePersistentSecretKey() {
  const keyFile = path.join(app.getPath('userData'), 'secret.key');
  try {
    const existing = fs.readFileSync(keyFile, 'utf8').trim();
    if (existing) return existing;
  } catch (_) {
    // doesn't exist yet - fall through and create it
  }
  const key = require('crypto').randomBytes(32).toString('hex');
  try {
    fs.mkdirSync(path.dirname(keyFile), { recursive: true });
    fs.writeFileSync(keyFile, key);
  } catch (_) {
    // couldn't persist it (read-only profile, etc.) - still better to use
    // SOMETHING for this run than crash; it just won't survive a restart.
  }
  return key;
}

function appendLog(chunk) {
  const text = chunk.toString();
  backendLogTail = (backendLogTail + text).slice(-4000); // keep last ~4KB for the error dialog
  try { fs.appendFileSync(logFile, text); } catch (_) {}
}

function startBackend() {
  ensureDataDir();
  try { fs.unlinkSync(portFile); } catch (_) {}
  try { fs.writeFileSync(logFile, ''); } catch (_) {}

  const env = {
    ...process.env,
    SMARTSHOOTS_DATA_DIR: dataDir,
    SMARTSHOOTS_DEBUG: 'False',
    SMARTSHOOTS_SECRET_KEY: getOrCreatePersistentSecretKey(),
    // FIX: the backend was left listening on 127.0.0.1 only (loopback -
    // reachable from THIS PC alone), while Settings' "Connect Your
    // Phone" QR code advertises the PC's real LAN address for OTHER
    // devices to use. Those two facts contradict each other - no matter
    // how a phone tried to reach that LAN address (scanning the QR,
    // typing the IP manually, or just opening it in a mobile browser),
    // the connection could never succeed, because nothing was actually
    // listening there. The request wouldn't fail fast either - it would
    // just hang, since nothing sends back so much as a rejection, which
    // is exactly the "stuck loading forever" symptom this was causing.
    // Binding to 0.0.0.0 makes the backend reachable on every network
    // interface (still including 127.0.0.1 for the desktop app itself),
    // which is what a phone-connection feature fundamentally requires -
    // see the security note in DEPLOY.md and README-ANDROID.md.
    SMARTSHOOTS_HOST: '0.0.0.0',
  };

  if (isDev) {
    // Dev mode: run straight from source with the system Python so you
    // can iterate without rebuilding the .exe every time.
    backendProcess = spawn('python', ['run_server.py'], {
      cwd: backendRoot,
      env,
      windowsHide: true,
    });
  } else {
    // Packaged mode: run the frozen, self-contained backend binary.
    const exePath = path.join(backendRoot, 'SmartShootsBackend.exe');
    backendProcess = spawn(exePath, [], {
      cwd: backendRoot,
      env,
      windowsHide: true,
    });
  }

  backendProcess.stdout.on('data', (data) => { console.log(`Backend: ${data}`); appendLog(data); });
  backendProcess.stderr.on('data', (data) => { console.error(`Backend Error: ${data}`); appendLog(data); });
  backendProcess.on('error', (err) => {
    dialog.showErrorBox(
      'SMART SHOOTS - failed to start',
      `Could not start the local backend.\n\n${err.message}`
    );
  });
  backendProcess.on('close', (code) => console.log(`Backend exited with code ${code}`));
}

function killBackend() {
  if (!backendProcess || backendProcess.killed) return;
  if (process.platform === 'win32') {
    try {
      // Kills the whole process tree (/T), forcefully (/F). Needed
      // because shell:true / frozen exes can spawn child processes that
      // plain .kill() leaves running in the background.
      execSync(`taskkill /PID ${backendProcess.pid} /T /F`);
    } catch (_) { /* already gone */ }
  } else {
    backendProcess.kill();
  }
}

function waitForBackend(timeout = 45000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    // FIX: previously if the backend crashed 1 second after launching,
    // the app still sat there for the full 45s before giving any
    // feedback. Now an early process exit fails fast with the real
    // error instead of a generic timeout message.
    const onEarlyExit = (code) => {
      reject(new Error(
        `Backend process exited early (code ${code}) before it was ready.\n\n` +
        `Last output:\n${backendLogTail || '(no output captured)'}`
      ));
    };
    backendProcess.once('exit', onEarlyExit);

    const check = () => {
      if (fs.existsSync(portFile)) {
        const port = parseInt(fs.readFileSync(portFile, 'utf8').trim(), 10);
        if (port) {
          backendPort = port;
          // FIX: this used to be `http.get(url, () => resolve()).on('error', () =>
          // resolve())` - meaning a CONNECTION ERROR (backend not actually
          // listening yet, e.g. the port file was written a split second
          // before the HTTP server actually starts accepting connections)
          // resolved exactly the same as a successful response. The app
          // would then load http://127.0.0.1:<port> before anything was
          // really there, land on Chromium's blank "can't reach this page"
          // error screen, and every subsequent API call (including every
          // "add/save" the user tried) would just silently fail against a
          // page that was never the real app to begin with. Now a
          // connection error just retries like the port file not existing
          // yet would, instead of pretending the backend is ready.
          const req = http.get(`http://127.0.0.1:${port}/api/accounts/`, () => {
            backendProcess.removeListener('exit', onEarlyExit);
            resolve();
          });
          req.on('error', () => setTimeout(check, 400));
          req.setTimeout(3000, () => { req.destroy(); setTimeout(check, 400); });
          return;
        }
      }
      if (Date.now() - startTime > timeout) {
        backendProcess.removeListener('exit', onEarlyExit);
        reject(new Error(
          `Backend did not start within ${timeout / 1000} seconds.\n\n` +
          `Last output:\n${backendLogTail || '(no output captured - check ' + logFile + ')'}`
        ));
        return;
      }
      setTimeout(check, 400);
    };
    check();
  });
}

// NEW: a tiny local loading screen shown the instant the window is
// created, before the backend has even started. Previously the
// BrowserWindow stayed hidden (show:false) with nothing loaded until the
// backend finished starting, which is invisible/instant on a fast
// machine but can be several seconds on first launch (migrations +
// seeding reference data) - during that gap the user had no window at
// all, which looks exactly like the app failing to open. This gives
// immediate, honest feedback instead of a silent pause.
const LOADING_HTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  html,body{height:100%;margin:0;background:#0f0b2e;display:flex;align-items:center;justify-content:center;
    font-family:Segoe UI,Arial,sans-serif;color:#fff;}
  .wrap{text-align:center;}
  .spinner{width:44px;height:44px;border-radius:50%;margin:0 auto 18px;
    border:4px solid rgba(255,255,255,0.15);border-top-color:#4F3CC9;animation:spin 0.9s linear infinite;}
  @keyframes spin{to{transform:rotate(360deg);}}
  h1{font-size:1.1rem;font-weight:600;margin:0 0 6px;letter-spacing:1px;}
  p{font-size:0.85rem;color:rgba(255,255,255,0.6);margin:0;}
</style></head><body><div class="wrap">
  <div class="spinner"></div>
  <h1>SMART SHOOTS</h1>
  <p>Starting the local server, please wait&hellip;</p>
</div></body></html>`;

// Single reachability check against an arbitrary URL (local backend or
// remote cloud server) - used both at startup (remote mode) and when the
// user is validating a new server address from Settings before
// committing to it and relaunching.
function checkReachable(url, timeoutMs = 8000) {
  return new Promise((resolve) => {
    try {
      const lib = url.startsWith('https:') ? https : http;
      const req = lib.get(`${url}/api/accounts/`, (res) => {
        res.resume(); // drain, we only care that *something* answered
        resolve(true);
      });
      req.on('error', () => resolve(false));
      req.setTimeout(timeoutMs, () => { req.destroy(); resolve(false); });
    } catch (_) {
      resolve(false);
    }
  });
}

function createWindow(loadUrl) {
  Menu.setApplicationMenu(null);

  const iconPath = path.join(__dirname, 'build', 'icon.ico');

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    // FIX: pointed at build/icon.ico, which doesn't exist in this
    // project - Electron just silently ignores a missing icon path, so
    // this wasn't breaking anything, but guarding it explicitly avoids
    // relying on that silent fallback and makes it obvious how to add a
    // real icon later (drop the file at desktop-app/build/icon.ico).
    ...(fs.existsSync(iconPath) ? { icon: iconPath } : {}),
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.loadURL(loadUrl);
  if (isDev) mainWindow.webContents.openDevTools(); // see network 404s etc. while developing

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // NEW: if the backend process dies AFTER the app is already open and
  // in use (crash, killed by antivirus, out of disk space writing the
  // SQLite file, etc.), every API call - including every "Add/Save" the
  // user tries - starts silently failing with no explanation, which
  // looks exactly like "data entry stopped working" with no visible
  // cause. Surface it immediately instead of leaving a zombie window.
  // Only applies in local mode - in remote mode there's no local
  // backendProcess to watch; a dropped connection there is handled by
  // the app's own in-page "can't reach the server" banner instead.
  if (backendProcess) {
    backendProcess.once('exit', (code) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        // FIX: this used to just report the exit code with no context -
        // exactly what you're seeing if you hit this dialog with no way
        // to tell me (or yourself) what actually went wrong. Same fix as
        // the startup-timeout dialog already had: show the last output
        // the backend actually printed before it died, which is where
        // the real Python traceback/error lives.
        dialog.showErrorBox(
          'SMART SHOOTS - local server stopped',
          `The local server stopped unexpectedly (exit code ${code}), so saving, loading, or entering data will not work ` +
          `until the app is restarted.\n\nLast output:\n${backendLogTail || '(no output captured - check ' + logFile + ')'}` +
          `\n\nRestart SMART SHOOTS to reconnect. Full log: ${logFile}`
        );
      }
    });
  }
}

// Prevent two copies fighting over the same SQLite database / port.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    // Show a loading screen immediately - don't make the user stare at
    // nothing (or a blank white flash) while migrations/seeding run on
    // first launch, which can take several seconds.
    const splash = new BrowserWindow({
      width: 420, height: 280, frame: false, resizable: false,
      backgroundColor: '#0f0b2e', show: true,
      webPreferences: { sandbox: true },
    });
    splash.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(LOADING_HTML)}`);

    try {
      if (connectionConfig.mode === 'remote') {
        // Thin-client mode: no local backend to spawn at all - just
        // confirm the configured cloud server actually answers before
        // handing control to the renderer, same principle as
        // waitForBackend()'s fix for local mode (never load a page that
        // was never really there).
        const reachable = await checkReachable(connectionConfig.remoteUrl, 10000);
        if (!reachable) {
          throw new Error(
            `Can't reach the configured server:\n${connectionConfig.remoteUrl}\n\n` +
            `Check your internet connection and that the server is running (see DEPLOY.md), ` +
            `or switch back to "This PC" mode from Settings once you're able to log in somewhere.`
          );
        }
        createWindow(connectionConfig.remoteUrl);
      } else {
        startBackend();
        await waitForBackend();
        createWindow(`http://127.0.0.1:${backendPort}`);
      }
      mainWindow.once('ready-to-show', () => { if (!splash.isDestroyed()) splash.close(); });
    } catch (err) {
      if (!splash.isDestroyed()) splash.close();
      dialog.showErrorBox('SMART SHOOTS - startup failed', err.message);
      app.quit();
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow(connectionConfig.mode === 'remote' ? connectionConfig.remoteUrl : `http://127.0.0.1:${backendPort}`);
    });
  });

  // NEW: lets Settings (inside the app) switch between "This PC" and
  // "Remote server" mode. Validates the new address actually answers
  // before committing to it - better to tell the user now than have them
  // relaunch into a broken, unreachable app. A relaunch is required
  // either way because whether to spawn a local backend at all is
  // decided once, at startup, before any window exists.
  ipcMain.handle('smartshoots:get-connection-config', () => connectionConfig);

  // NEW: powers the "scan to connect your phone" QR code in Settings.
  // The renderer has no way to know this PC's real LAN IP on its own
  // (window.location is always 127.0.0.1, since that's what the local
  // backend binds to) - os.networkInterfaces() is a Node/Electron-only
  // API, so this has to be answered from the main process. Picks the
  // first private (192.168.x.x / 10.x.x.x / 172.16-31.x.x), non-internal
  // IPv4 address - if a PC has several (VPN, virtual adapters, etc.) this
  // is a best-effort guess, not a guarantee of the "right" one.
  ipcMain.handle('smartshoots:get-lan-address', () => {
    const interfaces = os.networkInterfaces();
    const candidates = [];
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) candidates.push(iface.address);
      }
    }
    const isPrivate = (ip) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
    const best = candidates.find(isPrivate) || candidates[0] || null;
    return best ? { address: best, port: backendPort } : null;
  });

  ipcMain.handle('smartshoots:set-connection-config', async (_event, newConfig) => {
    if (newConfig.mode === 'remote') {
      const url = (newConfig.remoteUrl || '').trim().replace(/\/+$/, '');
      if (!url) return { ok: false, error: 'Enter a server address first.' };
      const reachable = await checkReachable(url, 10000);
      if (!reachable) {
        return { ok: false, error: `Could not reach ${url}. Double-check the address and that the server is running.` };
      }
      writeConnectionConfig({ mode: 'remote', remoteUrl: url });
    } else {
      writeConnectionConfig({ mode: 'local', remoteUrl: '' });
    }
    app.relaunch();
    app.exit(0);
    return { ok: true };
  });

  app.on('window-all-closed', () => {
    killBackend();
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', killBackend);
}
