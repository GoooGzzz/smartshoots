from django.contrib import admin
from .models import ScriptTemplate, ServiceProfile, ReportDraft

admin.site.register(ScriptTemplate)
admin.site.register(ServiceProfile)


@admin.register(ReportDraft)
class ReportDraftAdmin(admin.ModelAdmin):
    list_display = ['title', 'category', 'file_type', 'view_count', 'is_active', 'created_at']
    list_filter = ['category', 'file_type', 'is_active']
    search_fields = ['title', 'description']
    readonly_fields = ['token', 'file_type', 'view_count', 'created_at', 'updated_at']
