from django.db import models
import uuid


class ScriptTemplate(models.Model):
    """
    NEW: a library of ready-to-use, copy-paste outreach drafts (the
    "Tools page" request) - covers the whole outreach funnel, not just
    a single cold-intro message, and supports {placeholder} variables
    that the frontend fills in from a real selected client/package
    before copying, so what you paste is already personalized.
    """
    CATEGORY_CHOICES = [
        ('cold_outreach', 'Cold Outreach'),
        ('follow_up', 'Follow-Up'),
        ('quote_pricing', 'Quote / Pricing'),
        ('objection_handling', 'Objection Handling'),
        ('renewal', 'Renewal / Retention'),
        ('referral', 'Referral Ask'),
        ('social_caption', 'Social Media Caption'),
    ]
    template_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES)
    title = models.CharField(max_length=150)
    # Body supports plain-text {placeholders} like {client_name},
    # {package_name}, {price}, {business_name} - substituted client-side.
    body = models.TextField()
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['category', 'title']

    def __str__(self):
        return self.title


class ReportDraft(models.Model):
    """
    NEW: "Report Drafts" library - lets the user upload their own
    polished, client-facing report/proposal files (.html, .doc, .docx) -
    the same kind of rich report as the reference examples they already
    use (multi-category accreditation report, clinic report) - store
    them centrally, and reopen them either inline (HTML, rendered
    full-screen) or as a download (Word).

    Each draft gets a stable, unguessable `token` so a printed/shared QR
    code keeps working even after a login session expires - scanning it
    hits the PUBLIC viewer route (AllowAny, see views.report_draft_public_view)
    which forces a phone-optimized, portrait, full-screen layout, instead
    of dropping the visitor into the desktop dashboard/login screen.
    """
    CATEGORY_CHOICES = [
        ('medical', 'Medical / Clinic'),
        ('multi_category', 'Multi-Category Accreditation'),
        ('business', 'Business Proposal'),
        ('education', 'Education'),
        ('custom', 'Custom'),
    ]
    FILE_TYPE_CHOICES = [('html', 'HTML'), ('doc', 'Word (.doc)'), ('docx', 'Word (.docx)')]

    token = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    title = models.CharField(max_length=200)
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES, default='custom')
    description = models.CharField(max_length=300, blank=True)
    file = models.FileField(upload_to='report_drafts/%Y/%m/')
    file_type = models.CharField(max_length=10, choices=FILE_TYPE_CHOICES, editable=False, blank=True)
    is_active = models.BooleanField(default=True)
    view_count = models.PositiveIntegerField(default=0)
    created_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        # Derive file_type from the real extension rather than trusting
        # the client - the public viewer branches its whole rendering
        # strategy (inline HTML vs. download-only Word) on this field.
        if self.file:
            ext = self.file.name.rsplit('.', 1)[-1].lower() if '.' in self.file.name else ''
            self.file_type = ext if ext in ('html', 'htm', 'doc', 'docx') else 'html'
            if self.file_type == 'htm':
                self.file_type = 'html'
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title


class ServiceProfile(models.Model):
    """
    NEW: "academic profiles" / service catalogue - one entry per client
    category (Doctor, Teacher, Professor, Laboratory, ...) describing
    what that category typically needs and which real packages/services
    the business can offer them. Recommended packages link to the actual
    Package catalogue (not hardcoded text) so pricing/names never drift
    out of sync with what Orders actually uses.
    """
    profile_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    # Deliberately NOT a strict FK to Client.CLIENT_TYPES choices - a
    # profile is a marketing/reference concept and a business may want
    # one for a category that isn't (yet) an actual Client.type value,
    # or several profiles for one type (e.g. "Doctor - Private Clinic"
    # vs "Doctor - Hospital Department").
    client_type = models.CharField(max_length=30, help_text="e.g. doctor, teacher, professor, lab")
    title = models.CharField(max_length=150)
    typical_needs = models.TextField(help_text="What this category usually needs, in plain language.")
    recommended_packages = models.ManyToManyField('production.Package', blank=True, related_name='service_profiles')
    suggested_script = models.ForeignKey(ScriptTemplate, on_delete=models.SET_NULL, null=True, blank=True, related_name='suggested_for_profiles')
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['client_type', 'title']

    def __str__(self):
        return self.title
