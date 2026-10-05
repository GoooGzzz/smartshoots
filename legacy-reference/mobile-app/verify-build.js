#!/usr/bin/env node
/**
 * Guards against the exact white-screen bug already diagnosed in
 * capacitor.config.ts: if frontend/dist-mobile was ever accidentally
 * built with the Django-targeted `npm run build` (base '/static/')
 * instead of `npm run build:mobile` (base '/'), every asset request
 * inside the WebView 404s and the app is a blank white screen on
 * launch - with no error visible anywhere except a completely silent
 * failure. This runs as part of `npm run build:apk`, BEFORE the slow
 * Gradle build, so a wrong build fails fast and loud instead of
 * producing an APK that installs fine and then just... doesn't show
 * anything.
 */
const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'frontend', 'dist-mobile', 'index.html');

if (!fs.existsSync(indexPath)) {
  console.error('\n[build check] FAILED: frontend/dist-mobile/index.html does not exist.');
  console.error('  The mobile-specific frontend build did not run (or failed).');
  console.error('  Expected it to have been produced by: cd frontend && npm run build:mobile\n');
  process.exit(1);
}

const html = fs.readFileSync(indexPath, 'utf8');

// The Django-targeted build (base: '/static/') emits asset URLs like
// /static/assets/index-xxx.js. The mobile build (base: '/') emits plain
// /assets/index-xxx.js. Finding "/static/assets" here means the WRONG
// build got copied into dist-mobile.
if (html.includes('/static/assets')) {
  console.error('\n[build check] FAILED: frontend/dist-mobile/index.html references "/static/assets/...".');
  console.error('  This means the Django-targeted build (base: "/static/") ended up here instead');
  console.error('  of the mobile build (base: "/") - every asset request in the Android app will');
  console.error('  404 and the app will show a blank white screen on launch.');
  console.error('  Fix: delete frontend/dist-mobile and re-run "npm run build:apk" from mobile-app/');
  console.error('  (it runs "npm run build:mobile" in frontend/ automatically - never run the plain');
  console.error('  "npm run build" and copy it over manually).\n');
  process.exit(1);
}

console.log('[build check] OK: dist-mobile looks like the correct mobile build (base "/").');
