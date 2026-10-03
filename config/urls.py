from django.conf import settings
from django.conf import settings
from django.contrib import admin
from django.urls import path, include, re_path
from django.views.generic import TemplateView
from django.views.static import serve as serve_static

from apps.toolkit.views import report_draft_public_view
from django.http import FileResponse, Http404
from pathlib import Path


def service_worker_view(request):
    # NEW: the service worker must be served from the site ROOT (/sw.js) to
    # control the whole app, but Vite emits it into the static dir (served
    # under /static/). This serves that file at the root with the header
    # that permits root scope.
    candidates = [Path(d) / 'sw.js' for d in settings.STATICFILES_DIRS] + [Path(settings.STATIC_ROOT) / 'sw.js']
    for f in candidates:
        if f.exists():
            resp = FileResponse(open(f, 'rb'), content_type='application/javascript')
            resp['Service-Worker-Allowed'] = '/'
            resp['Cache-Control'] = 'no-cache'
            return resp
    raise Http404('sw.js not built')

# FIX: root used to redirect straight to /admin/, so the actual React app
# (the whole point of the desktop build) was never shown. It's now served
# as the SPA entry point, with a catch-all so client-side routes like
# /clients/42 or /schedule also load index.html instead of 404-ing.
spa_view = TemplateView.as_view(template_name='index.html')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/accounts/', include('apps.accounts.urls')),
    path('api/production/', include('apps.production.urls')),
    path('api/scheduling/', include('apps.scheduling.urls')),
    path('api/finance/', include('apps.finance.urls')),
    path('api/notifications/', include('apps.notifications.urls')),
    path('api/reports/', include('apps.reports.urls')),
    path('api/assistant/', include('apps.ai_assistant.urls')),
    path('api/toolkit/', include('apps.toolkit.urls')),
    # FIX: Django only auto-serves MEDIA_URL when DEBUG=True. The packaged
    # desktop app always runs with DEBUG=False, so uploaded attachments/
    # photos saved fine but could never be viewed or downloaded again -
    # every request for a media file 404'd. This is a single-user local
    # app (no public internet exposure), so serving media directly here
    # is safe and simplest - no separate file server needed.
    re_path(r'^media/(?P<path>.*)$', serve_static, {'document_root': settings.MEDIA_ROOT}),
    # NEW: short, QR-friendly public link for a single Report Draft -
    # e.g. https://your-server/r/3f2a1c9e-.../ - deliberately OUTSIDE
    # /api/ and the SPA catch-all below, so a phone scanning the QR code
    # (no login session, may not even have the app installed) lands
    # directly on the full-screen report viewer instead of the React
    # dashboard/login page.
    path('r/<uuid:token>/', report_draft_public_view, name='report-draft-short'),
    path('sw.js', service_worker_view, name='service-worker'),
    path('', spa_view, name='home'),
    # Any other non-api/non-admin/non-r path -> hand back to the React router.
    re_path(r'^(?!api/|admin/|static/|media/|r/).*$', spa_view),
]