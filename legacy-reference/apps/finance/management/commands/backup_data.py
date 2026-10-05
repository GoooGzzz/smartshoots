import json
from datetime import datetime

from django.apps import apps
from django.conf import settings
from django.core.management.base import BaseCommand
from django.core.serializers import serialize

BACKED_UP_APPS = ['accounts', 'production', 'scheduling', 'finance', 'notifications']

# FIX: SMART SHOOTS uses a custom AUTH_USER_MODEL ('accounts.User' - see
# config/settings.py) that happens to live inside the 'accounts' app
# alongside genuine business data (Client, StaffMember, ...). That means
# a plain "back up every model in these apps" sweep was unintentionally
# including login accounts (with their password hashes) as if they were
# portable business data. Restoring such a backup onto a different
# install (e.g. moving from a local PC to the shared cloud server - see
# DEPLOY.md) would silently overwrite that install's admin account and
# password with whatever the OLD install's admin login was, which is
# confusing at best ("why did my new password stop working?") and a
# real access-control surprise at worst. User accounts are specific to
# an install, not portable data, so they're excluded here the same way
# auth.User/authtoken.Token already were for the built-in auth app.
EXCLUDED_MODELS = {'accounts.user'}


class Command(BaseCommand):
    help = 'Export all business data to JSON.'

    def handle(self, *args, **kwargs):
        data = {}
        for model in apps.get_models():
            if model._meta.app_label in BACKED_UP_APPS and model._meta.label_lower not in EXCLUDED_MODELS:
                data[model._meta.label] = json.loads(serialize('json', model.objects.all()))
        payload = json.dumps(data, indent=2)

        # FIX: this used to ONLY write to a hardcoded relative 'backup.json'
        # path and print a plain success message to stdout. The desktop
        # app's download endpoint (finance/views.py BackupView) captures
        # *stdout* as the file it sends to the browser - so every "backup"
        # anyone downloaded was actually just the text
        # "Backup saved to backup.json", not real data, and the real data
        # went to an unpredictable relative folder that likely wasn't even
        # writable once packaged.
        #
        # Now: the real JSON goes to stdout (so the in-app download button
        # works correctly), AND a timestamped copy is kept in the writable
        # data dir so backups exist on disk even if nobody clicks download.
        self.stdout.write(payload)

        backups_dir = settings.DATA_DIR / 'backups'
        backups_dir.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_path = backups_dir / f'backup_{timestamp}.json'
        backup_path.write_text(payload, encoding='utf-8')
        self.stderr.write(self.style.SUCCESS(f'Backup also saved to {backup_path}'))
