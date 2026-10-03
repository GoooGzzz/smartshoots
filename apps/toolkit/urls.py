from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'scripts', views.ScriptTemplateViewSet)
router.register(r'service-profiles', views.ServiceProfileViewSet)
router.register(r'report-drafts', views.ReportDraftViewSet)

urlpatterns = [
    # Kept under /api/toolkit/ too (in addition to the short /r/<token>/
    # alias in config/urls.py) so an authenticated in-app "Open" button
    # never depends on the root-level alias existing.
    path('report-drafts/<uuid:token>/open/', views.report_draft_public_view, name='report-draft-open'),
    path('', include(router.urls)),
]
