"""
NEW: one-time seeder for the "Report Drafts" gallery (Tools > Report
Drafts). Loads the two reference reports (the multi-category
accreditation report and the Alfa Clinic / Plasma Lab report) from
/sample_reports/ at the project root into the library, so the gallery
isn't empty the first time anyone opens the tab and there's an
immediate, real example of what a good uploaded report looks like.

Usage:
    python manage.py seed_report_drafts

Safe to re-run: skips any title that's already in the database instead
of creating duplicates.
"""
from pathlib import Path

from django.core.files import File
from django.core.management.base import BaseCommand

from apps.toolkit.models import ReportDraft

SAMPLES = [
    {
        'filename': 'Multi_Category.html',
        'title': 'Multi-Category Accreditation Report',
        'category': 'multi_category',
        'description': 'Reference report covering a multi-sector accreditation review.',
    },
    {
        'filename': 'Plasma_Lab.html',
        'title': 'Alfa Clinic - Plasma Lab Report',
        'category': 'medical',
        'description': 'Reference clinic/lab report used as a design template for future reports.',
    },
]


class Command(BaseCommand):
    help = 'Seed the Report Drafts gallery with the two reference sample reports.'

    def handle(self, *args, **options):
        base_dir = Path(__file__).resolve().parents[4]  # project root
        samples_dir = base_dir / 'sample_reports'

        for sample in SAMPLES:
            if ReportDraft.objects.filter(title=sample['title']).exists():
                self.stdout.write(self.style.WARNING(f"Skipped (already exists): {sample['title']}"))
                continue

            file_path = samples_dir / sample['filename']
            if not file_path.exists():
                self.stdout.write(self.style.ERROR(f"Missing sample file: {file_path}"))
                continue

            draft = ReportDraft(
                title=sample['title'],
                category=sample['category'],
                description=sample['description'],
            )
            with open(file_path, 'rb') as f:
                draft.file.save(sample['filename'], File(f), save=False)
            draft.save()
            self.stdout.write(self.style.SUCCESS(f"Added: {sample['title']}"))
