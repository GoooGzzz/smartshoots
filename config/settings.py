"""
Django settings for SMART SHOOTS project.

Fixes applied:
- SECRET_KEY / DEBUG now come from environment variables so a packaged
  Windows build runs with DEBUG=False and a real secret key, while local
  development still works with no setup (safe fallbacks below).
- 'apps.ai_assistant' was missing from INSTALLED_APPS even though it is
  wired up in config/urls.py and ships migrations -> this used to crash
  the app the moment anyone opened the AI assistant tab.
- SMARTSHOOTS_DATA_DIR lets the desktop app point the sqlite database and
  media/ folder at a writable per-user folder (e.g. %APPDATA%) instead of
  the (read-only, once installed) Program Files folder on Windows.
"""

import os
import sys
from pathlib import Path

# FIX: `Path(__file__).resolve().parent.parent` breaks once PyInstaller
# freezes this file - `__file__` for a module loaded out of the frozen
# PYZ archive does not point at a real location on disk, so BASE_DIR
# silently pointed at the wrong folder. That made Django unable to find
# frontend/dist (TEMPLATES DIRS) or the apps' migrations, so the packaged
# .exe crashed on startup - which just looked like "the backend never
# starts" / a 45-second timeout in the desktop app, with no error shown.
# sys._MEIPASS (set by PyInstaller, for both onefile AND onedir builds)
# is the correct base folder to use instead when frozen.
if getattr(sys, 'frozen', False):
    BASE_DIR = Path(sys._MEIPASS)
else:
    BASE_DIR = Path(__file__).resolve().parent.parent

# Where the desktop app should keep user data (db, media, logs) so it
# survives reinstalls/updates and doesn't need admin rights to write to.
# The Electron shell sets SMARTSHOOTS_DATA_DIR to app.getPath('userData').
DATA_DIR = Path(os.environ.get('SMARTSHOOTS_DATA_DIR', BASE_DIR))
DATA_DIR.mkdir(parents=True, exist_ok=True)

SECRET_KEY = os.environ.get(
    'SMARTSHOOTS_SECRET_KEY',
    'django-insecure-smart-shoots-development-key-CHANGE-ME',
)
DEBUG = os.environ.get('SMARTSHOOTS_DEBUG', 'False') == 'True'

# NEW: this used to be permanently hardcoded to ['*'] with a comment
# saying "the desktop app only ever talks to itself on 127.0.0.1" - true
# for the Windows build, but no longer true once the same backend is
# deployed on a small cloud VPS for the Android app to reach over the
# internet (see DEPLOY.md). Django's ALLOWED_HOSTS mainly guards against
# Host-header spoofing, so it's worth actually locking down once a
# deployment has a real, fixed hostname - but keeping '*' as the default
# means the desktop/local-LAN setup keeps working with zero config
# changes.
ALLOWED_HOSTS = [h.strip() for h in os.environ.get('SMARTSHOOTS_ALLOWED_HOSTS', '*').split(',') if h.strip()]

# NEW: only relevant for the cloud-VPS deployment (DEPLOY.md), where a
# reverse proxy (Caddy) terminates HTTPS and forwards to Django over
# plain HTTP internally. Without SECURE_PROXY_SSL_HEADER, Django can't
# tell the original request was HTTPS, so request.is_secure() is wrong
# and cookie-security settings that depend on it misbehave. Left off by
# default (SMARTSHOOTS_BEHIND_PROXY unset) so the desktop app - which
# really is plain HTTP on 127.0.0.1, not behind any proxy - is completely
# unaffected.
BEHIND_PROXY = os.environ.get('SMARTSHOOTS_BEHIND_PROXY', 'False') == 'True'
if BEHIND_PROXY:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    CSRF_TRUSTED_ORIGINS = [o.strip() for o in os.environ.get('SMARTSHOOTS_CSRF_TRUSTED_ORIGINS', '').split(',') if o.strip()]
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third-party
    'rest_framework',
    'rest_framework.authtoken',
    'corsheaders',
    'django_filters',
    'django_fsm',

    # Local apps
    'apps.accounts',
    'apps.production',
    'apps.scheduling',
    'apps.finance',
    'apps.notifications',
    'apps.reports',
    'apps.ai_assistant',  # FIX: was missing -> AI assistant tab crashed
    'apps.toolkit',  # NEW: outreach scripts + academic/service profiles
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',  # <-- whitenoise for static files
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        # FIX: index.html (the built React app) lives in frontend/dist.
        # Without this, Django had no template to serve at '/' so
        # config/urls.py just redirected everyone to /admin/.
        'DIRS': [BASE_DIR / 'frontend' / 'dist'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        # FIX: honors SMARTSHOOTS_DATA_DIR so the Windows build keeps the
        # database in the user's AppData folder instead of next to the
        # (often read-only / reinstalled) program files.
        'NAME': DATA_DIR / 'db.sqlite3',
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Africa/Cairo'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, images)
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_DIRS = [
    BASE_DIR / 'frontend' / 'dist',
]
# FIX: WhiteNoise was listed as middleware but never configured to compress
# / hash-version files, and STATIC_ROOT didn't exist until collectstatic
# ran once. This makes `manage.py runserver`/waitress correctly serve the
# built React JS/CSS bundle with no separate web server (nginx/IIS) needed.
# Uses the modern STORAGES dict (STATICFILES_STORAGE alone is deprecated
# since Django 4.2 and Django 5.2 warns loudly about it).
STORAGES = {
    'default': {
        'BACKEND': 'django.core.files.storage.FileSystemStorage',
    },
    'staticfiles': {
        # FIX: "Manifest" storage re-hashes every filename AGAIN on top of
        # Vite's own content hash (e.g. index-xxx.js -> index-xxx.abc123.js
        # on disk), while index.html still points at the un-re-hashed name
        # -> every JS/CSS request 404'd. Vite already provides cache-busted
        # filenames, so plain compression (gzip/brotli, no renaming) is the
        # correct WhiteNoise storage class here.
        'BACKEND': 'whitenoise.storage.CompressedStaticFilesStorage',
    },
}

# Media files (client photos/attachments) - kept in the writable data dir.
MEDIA_URL = 'media/'
MEDIA_ROOT = DATA_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
AUTH_USER_MODEL = 'accounts.User'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
}

CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True

# CSRF settings
CSRF_COOKIE_HTTPONLY = False
SESSION_COOKIE_HTTPONLY = False

# Cache (simple in-memory cache)
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'unique-snowflake',
    }
}

# Twilio settings (optional, for WhatsApp/SMS)
TWILIO_ACCOUNT_SID = ''
TWILIO_AUTH_TOKEN = ''
TWILIO_WHATSAPP_NUMBER = ''