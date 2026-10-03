/**
 * NEW: plain JavaScript instead of capacitor.config.ts.
 *
 * FIX: `npx cap sync` failed with "Could not find installation of
 * TypeScript" - Capacitor has to compile a .ts config file before reading
 * it, and this project's own package.json never listed `typescript` as a
 * dependency, so a clean `npm install` in mobile-app/ left it missing. A
 * .js config needs no compiler at all, so this class of error can't
 * recur, regardless of what is or isn't installed.
 *
 * This wraps the SAME React app used by the desktop build (frontend/) as
 * a native Android app via Capacitor's WebView shell - not a rewrite.
 *
 * FIX: webDir used to point at frontend/dist, the exact same build the
 * desktop app serves through Django. That build is compiled with vite's
 * `base: '/static/'` (see frontend/vite.config.ts) because Django serves
 * static files under /static/... - correct for Django, but Capacitor
 * serves webDir's contents directly at its own root, with no /static/
 * prefix at all. The result: index.html loaded fine, but every JS/CSS
 * asset request 404'd inside the WebView (it asked for /static/assets/...
 * which simply isn't there), so React never mounted - a blank white
 * screen on launch, while browser/QR access (which goes through the real
 * Django server) worked perfectly. Two different serving contexts need
 * two different builds: `npm run build:mobile` in frontend/ (base '/',
 * output to dist-mobile) instead of the Django-targeted `npm run build`.
 */
const config = {
  appId: 'com.smartshoots.app',
  appName: 'SMART SHOOTS',
  webDir: '../frontend/dist-mobile',
  server: {
    // FIX/NEW: without this, Capacitor serves the app from
    // https://localhost, and every plain HTTP request to the PC's LAN
    // server (http://192.168.x.x:8000) gets blocked as mixed content by
    // Android's WebView - exactly the kind of silent "data entry doesn't
    // work" failure this app has otherwise been fixed to avoid. Cleartext
    // (plain HTTP) traffic is allowed here because this app deliberately
    // talks to a Django server on the local network, not the public
    // internet, and Settings > Server Address is the only place a host
    // gets typed in.
    androidScheme: 'https',
    cleartext: true,
    allowNavigation: ['*'],
  },
  android: {
    allowMixedContent: true,
  },
};

module.exports = config;
