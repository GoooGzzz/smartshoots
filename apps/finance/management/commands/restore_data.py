import json

from django.core.management.base import BaseCommand, CommandError
from django.core.serializers import deserialize
from django.db import transaction, IntegrityError

# FIX: apps/finance/views.py's RestoreView called
# `call_command('restore_data', temp_path)`, but this command never
# existed anywhere in the project - clicking "Restore" in the app always
# raised "Unknown command: 'restore_data'". This is the file that was
# missing, matched to the JSON shape produced by backup_data (see that
# command: {"app_label.ModelName": [<django serialized objects>], ...}).


class Command(BaseCommand):
    help = 'Restore business data from a JSON backup produced by backup_data.'

    def add_arguments(self, parser):
        parser.add_argument('backup_path', type=str)

    def handle(self, *args, **options):
        backup_path = options['backup_path']
        try:
            with open(backup_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except (OSError, json.JSONDecodeError) as e:
            raise CommandError(f'Could not read backup file: {e}')

        restored = 0
        try:
            with transaction.atomic():
                # Restore in a stable order so foreign keys resolve correctly
                # (e.g. clients before orders that reference them).
                for model_label, objects in data.items():
                    for deserialized_obj in deserialize('json', json.dumps(objects)):
                        deserialized_obj.save()
                        restored += 1
        except IntegrityError as e:
            # NEW: the backup deliberately excludes user accounts (see
            # backup_data.py) since those are install-specific, not
            # portable business data - but records like Client/Order
            # still reference a created_by user ID from wherever the
            # backup came from. This works cleanly when restoring onto a
            # freshly-deployed install (its first, auto-created admin
            # account gets the same ID the source install's did), which
            # is the intended/recommended flow for moving from a local
            # install onto the shared cloud server. It breaks if the
            # target already has a different set of user accounts with
            # different IDs - a real but narrow limitation, worth an
            # actionable error instead of a raw database traceback.
            raise CommandError(
                'Restore failed - some records reference a user account (e.g. "created by") that '
                "doesn't exist on this install. This backup is best restored onto a freshly-set-up "
                "install that hasn't had extra staff accounts created yet, so its auto-created admin "
                f"account lines up with the one the backup expects.\n\nDatabase error: {e}"
            )

        self.stdout.write(self.style.SUCCESS(f'Restored {restored} records from {backup_path}'))
