#!/usr/bin/env python
"""
run_server.py - the single entrypoint the Windows desktop build uses.

Why this exists (NEW - fixes the "needs a backend running separately"
problem): previously you had to manually run
`python manage.py migrate` and then `python manage.py runserver` in a
terminal every time, with a real Python install and all packages present.
This script does everything a first run needs automatically:

  1. Makes sure the writable data folder (SMARTSHOOTS_DATA_DIR) exists.
  2. Runs database migrations if they haven't been applied yet.
  3. Collects static files (built React bundle) into staticfiles/ if
     missing, so WhiteNoise can serve them.
  4. Creates a default "admin" superuser on first launch ONLY if the
     database has no users yet, so there's no separate manual setup step.
  5. Starts a production-grade server (waitress) on 127.0.0.1 - not the
     Django dev server - and prints "SMARTSHOOTS_READY" once it's actually
     listening, which Electron's main.js watches for instead of polling.

This is the exact script PyInstaller freezes into SmartShootsBackend.exe
(see backend.spec / build_windows.py), so end users never need Python,
Node, or a terminal installed at all.
"""
import os
import socket
import sys
import traceback
from pathlib import Path

# FIX: same frozen-path issue as config/settings.py - __file__ is not a
# real filesystem path once this script is bundled by PyInstaller.
if getattr(sys, 'frozen', False):
    BASE_DIR = Path(sys._MEIPASS)
else:
    BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
os.environ.setdefault('SMARTSHOOTS_DEBUG', 'False')


def find_free_port(preferred=8000):
    """Fall back to a random free port if 8000 is already taken."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(('127.0.0.1', preferred))
            return preferred
        except OSError:
            s.bind(('127.0.0.1', 0))
            return s.getsockname()[1]


def seed_reference_data():
    """Create the picklist records the UI needs to function, if missing.

    Idempotent (uses get_or_create) so it's safe to call on every launch,
    not just the first one - covers upgrades from an older DB that
    predates one of these categories/packages/tags too.
    """
    from decimal import Decimal
    from django.contrib.auth import get_user_model
    from apps.production.models import Package
    from apps.finance.models import ExpenseCategory
    from apps.accounts.models import ClientTag

    User = get_user_model()
    admin = User.objects.filter(is_superuser=True).order_by('id').first()
    if admin is None:
        return

    packages = [
        {'name': 'Hourly Learning Recording', 'type': 'hourly_learning', 'default_rate': '500.00', 'unit': 'hour'},
        {'name': 'Per-Minute Reels', 'type': 'per_minute_reels', 'default_rate': '50.00', 'unit': 'minute'},
        {'name': 'Outdoor Shoot', 'type': 'outdoor_shoot', 'default_rate': '1500.00', 'unit': 'session'},
    ]
    for pkg in packages:
        Package.objects.get_or_create(
            name=pkg['name'],
            defaults={'type': pkg['type'], 'default_rate': Decimal(pkg['default_rate']), 'unit': pkg['unit']},
        )

    ExpenseCategory.create_default_categories(admin)

    # Package-style tags requested for the Add Client form: Outdoor / Reels
    # / Learning, matching the production package names above.
    for tag_name, color in [('Outdoor', '#FF9800'), ('Reels', '#2196F3'), ('Learning', '#4CAF50')]:
        ClientTag.objects.get_or_create(name=tag_name, defaults={'color': color})

    # NEW: default outreach scripts + academic/service profiles for the
    # Tools page, so it's useful immediately rather than a blank page
    # that requires manual setup first. Business-editable afterward -
    # this is a starting point, not a fixed script.
    from apps.toolkit.models import ScriptTemplate, ServiceProfile

    scripts = [
        {
            'category': 'cold_outreach',
            'title': 'First message to a new academic contact',
            'body': (
                "Hi Dr. {client_name},\n\n"
                "I'm reaching out from {business_name} - we help academics and "
                "clinics turn their expertise into professional video content "
                "(lecture recordings, procedure explainers, patient education, "
                "and short-form reels for social media).\n\n"
                "Would you be open to a quick 10-minute call this week to see "
                "if it's a fit for what you're working on?\n\n"
                "Best,\n{business_name}"
            ),
        },
        {
            'category': 'quote_pricing',
            'title': 'Sending a package quote',
            'body': (
                "Hi {client_name}, thanks for your interest!\n\n"
                "For {package_name}, our rate is {price} per {unit}. This "
                "includes filming, editing, and final delivery in your "
                "preferred format.\n\n"
                "Let me know if you'd like to go ahead and I'll get an order "
                "started."
            ),
        },
        {
            'category': 'follow_up',
            'title': 'Following up after no response',
            'body': (
                "Hi {client_name}, just following up on my last message in "
                "case it got buried! Still happy to answer any questions "
                "about {package_name} whenever works for you."
            ),
        },
        {
            'category': 'objection_handling',
            'title': "\"It's too expensive\" - response",
            'body': (
                "Totally understand - happy to work with you here. A couple "
                "of options: we can scope a smaller version of {package_name} "
                "to start, or split payment across the shoot and delivery. "
                "What would help most?"
            ),
        },
        {
            'category': 'renewal',
            'title': 'Renewal / repeat booking check-in',
            'body': (
                "Hi {client_name}, it's been a while since your last "
                "{package_name} session with us! If you have new material "
                "to record, I'd love to get something on the calendar - "
                "just let me know a few dates that work."
            ),
        },
        {
            'category': 'referral',
            'title': 'Asking a happy client for a referral',
            'body': (
                "So glad you're happy with the {package_name} results! If "
                "you know any colleagues who might benefit from similar "
                "content, I'd really appreciate the introduction - happy to "
                "offer them the same rate you got."
            ),
        },
        {
            'category': 'social_caption',
            'title': 'Instagram/Facebook caption for a finished project',
            'body': (
                "New work with {client_name}! 🎥\n\n"
                "Another {package_name} project delivered - swipe to see a "
                "clip. DM us to book your own session.\n\n"
                "#{business_name_tag} #videoproduction"
            ),
        },
    ]
    script_objs = {}
    for s in scripts:
        obj, _ = ScriptTemplate.objects.get_or_create(
            title=s['title'], defaults={'category': s['category'], 'body': s['body'], 'created_by': admin},
        )
        script_objs[s['title']] = obj

    profiles = [
        {
            'client_type': 'doctor', 'title': 'Doctors & Clinics',
            'typical_needs': 'Patient education videos, procedure explainers, clinic promotional reels, and conference/lecture recordings.',
            'package_names': ['Hourly Learning Recording', 'Per-Minute Reels'],
            'script_title': 'First message to a new academic contact',
        },
        {
            'client_type': 'teacher', 'title': 'Teachers',
            'typical_needs': 'Recorded lessons for remote/flipped classrooms, short revision-tip reels for students, and parent-facing update videos.',
            'package_names': ['Hourly Learning Recording', 'Per-Minute Reels'],
            'script_title': 'First message to a new academic contact',
        },
        {
            'client_type': 'professor', 'title': 'Professors',
            'typical_needs': 'Full lecture capture, research explainer videos, and conference presentation recordings.',
            'package_names': ['Hourly Learning Recording'],
            'script_title': 'First message to a new academic contact',
        },
        {
            'client_type': 'lab', 'title': 'Laboratories',
            'typical_needs': 'Facility/process walkthroughs, equipment demonstration videos, and on-site outdoor/promotional shoots for marketing.',
            'package_names': ['Outdoor Shoot', 'Per-Minute Reels'],
            'script_title': 'First message to a new academic contact',
        },
    ]
    for p in profiles:
        obj, _ = ServiceProfile.objects.get_or_create(
            title=p['title'],
            defaults={
                'client_type': p['client_type'],
                'typical_needs': p['typical_needs'],
                'suggested_script': script_objs.get(p['script_title']),
                'created_by': admin,
            },
        )
        matching_packages = Package.objects.filter(name__in=p['package_names'])
        obj.recommended_packages.set(matching_packages)


def main():
    import django
    django.setup()

    from django.core.management import call_command
    from django.contrib.auth import get_user_model

    print('Applying database migrations (first run only takes longer)...', flush=True)
    call_command('migrate', interactive=False, verbosity=1)

    # FIX: this used to only run on the very FIRST launch ("if the
    # staticfiles folder is empty") - which meant every later rebuild
    # (a real one, like this release's performance work, which renamed
    # and split nearly every JS file) left the OLD files sitting in
    # staticfiles/ forever. index.html was fresh and asked for the NEW
    # filenames, none of which existed there - every asset 404'd, React
    # never finished loading, and the app was stuck on the boot loading
    # screen forever. collectstatic is a few seconds even on a slow PC,
    # so it's simplest and safest to just always run it.
    print('Collecting static files...', flush=True)
    call_command('collectstatic', interactive=False, verbosity=0, clear=True)

    User = get_user_model()
    if not User.objects.exists():
        default_password = os.environ.get('SMARTSHOOTS_ADMIN_PASSWORD', 'admin123')
        User.objects.create_superuser(
            username='admin', email='admin@smartshoots.local', password=default_password,
        )
        print(f"Created default admin account -> username 'admin' / password '{default_password}'. "
              "Please change this from Settings after logging in.", flush=True)

    # FIX: several dropdowns across the app (Order -> Package, Expense ->
    # Category, Client -> Tags) were completely empty on a fresh install
    # because the records they list were only ever created by the
    # optional, manual `load_sample_data` command. A brand-new user who
    # never runs that command by hand could never select a package, a
    # category, or a tag - "Add Order"/"Add Expense" looked broken even
    # though the code itself was fine. This reference data (not demo/fake
    # data - real picklist options every install needs) is now seeded
    # automatically, once, on first launch.
    seed_reference_data()

    from waitress import serve
    from config.wsgi import application
    from django.conf import settings as dj_settings

    port = find_free_port(int(os.environ.get('SMARTSHOOTS_PORT', 8000)))
    # Written to the writable data dir (not BASE_DIR, which may be a
    # read-only, temp-extracted PyInstaller bundle) so Electron can read
    # the real port even if 8000 was busy and we fell back to a random one.
    (Path(dj_settings.DATA_DIR) / '.port').write_text(str(port))

    # NEW: bindable via SMARTSHOOTS_HOST, defaulting to 127.0.0.1 (loopback
    # only) which is exactly right for the desktop app - the Electron
    # window and the backend are on the same machine, and there's no
    # reason for anything else on the network to be able to reach it.
    # The cloud/Docker deployment (see Dockerfile, DEPLOY.md) sets this to
    # 0.0.0.0 instead, because there the reverse proxy (Caddy) handling
    # HTTPS runs in a SEPARATE container and can only reach this one over
    # the Docker network, not via loopback. Without this, the container
    # would start, look healthy, and 100% of requests through the proxy
    # would fail to connect - a much harder bug to notice than an
    # immediate crash, since `docker ps` would show everything "Up".
    host = os.environ.get('SMARTSHOOTS_HOST', '127.0.0.1')

    print(f'SMARTSHOOTS_READY port={port}', flush=True)
    serve(application, host=host, port=port, threads=8)


if __name__ == '__main__':
    # FIX: previously an uncaught exception here (e.g. missing migrations,
    # missing frontend/dist, bad env var) just made the process exit
    # silently. Packaged as a windowed .exe with no visible console, that
    # left the desktop app waiting the full 45s with zero clue why. Any
    # crash is now written to a log file in the writable data dir so it
    # can actually be diagnosed.
    data_dir = Path(os.environ.get('SMARTSHOOTS_DATA_DIR', BASE_DIR))
    try:
        data_dir.mkdir(parents=True, exist_ok=True)
    except Exception:
        pass
    try:
        main()
    except Exception:
        error_text = traceback.format_exc()
        print(error_text, file=sys.stderr, flush=True)
        try:
            (data_dir / 'backend_error.log').write_text(error_text, encoding='utf-8')
        except Exception:
            pass
        sys.exit(1)
