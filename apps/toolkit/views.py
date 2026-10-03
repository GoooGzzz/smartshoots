import re

from django.db import models
from django.http import HttpResponse, Http404
from django.shortcuts import get_object_or_404
from django.utils.html import escape
from rest_framework import viewsets
from django.views.decorators.clickjacking import xframe_options_exempt
from django.views.decorators.http import require_GET
from urllib.parse import quote
from rest_framework.decorators import api_view, permission_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated, AllowAny

from .models import ScriptTemplate, ServiceProfile, ReportDraft
from .serializers import ScriptTemplateSerializer, ServiceProfileSerializer, ReportDraftSerializer


class ScriptTemplateViewSet(viewsets.ModelViewSet):
    queryset = ScriptTemplate.objects.filter(is_active=True)
    serializer_class = ScriptTemplateSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['category']
    search_fields = ['title', 'body']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class ReportDraftViewSet(viewsets.ModelViewSet):
    """
    NEW: "Report Drafts" library - CRUD for the uploaded HTML/Word
    report templates shown in the Tools > Report Drafts gallery.
    Requires login like the rest of the app; the *viewing* side (QR
    scans, sharing a link) goes through the separate, public
    `report_draft_public_view` below instead.
    """
    queryset = ReportDraft.objects.filter(is_active=True)
    serializer_class = ReportDraftSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    filterset_fields = ['category', 'file_type']
    search_fields = ['title', 'description']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class ServiceProfileViewSet(viewsets.ModelViewSet):
    queryset = ServiceProfile.objects.filter(is_active=True).prefetch_related('recommended_packages')
    serializer_class = ServiceProfileSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['client_type']
    search_fields = ['title', 'typical_needs', 'client_type']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


# ---------------------------------------------------------------------------
# Public "Report Drafts" viewer (the QR-code target)
# ---------------------------------------------------------------------------
# NEW: scanning a draft's QR code on a phone must NOT dead-end at the
# dashboard login screen - it needs to work for any visitor, logged in
# or not, and it needs to look right on a phone: full-screen, portrait,
# no MUI dashboard chrome around it. This view (AllowAny, plain Django,
# no DRF serialization of the file itself) is that landing page. It is
# intentionally read-only and only ever exposes a single draft's file by
# its random `token` - never a list of drafts, and never anything else
# in the database.

_VIEWER_CSS = """
:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);}
html,body{margin:0;-webkit-text-size-adjust:100%;}
#__ss_tap_overlay{position:fixed;inset:0;z-index:2147483000;background:linear-gradient(135deg,#0c1e3d 0%,#0369a1 55%,#0ea5e9 100%);
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;color:#fff;
  font-family:'Cairo','Inter',-apple-system,sans-serif;text-align:center;padding:32px;}
#__ss_tap_overlay .__ss_badge{width:64px;height:64px;border-radius:20px;background:rgba(255,255,255,.15);
  display:flex;align-items:center;justify-content:center;font-size:28px;margin-bottom:6px;}
#__ss_tap_overlay h1{font-size:20px;font-weight:900;margin:0;max-width:320px;line-height:1.4;}
#__ss_tap_overlay p{font-size:13px;opacity:.85;margin:0;max-width:280px;}
#__ss_tap_overlay button{background:#fff;color:#0c4a6e;border:0;padding:15px 36px;border-radius:999px;
  font-weight:800;font-size:15px;box-shadow:0 14px 34px -10px rgba(0,0,0,.5);margin-top:6px;cursor:pointer;}
#__ss_exit_fs{position:fixed;top:calc(env(safe-area-inset-top,0px) + 12px);inset-inline-start:12px;z-index:2147483001;
  background:rgba(15,23,42,.55);color:#fff;border:0;width:38px;height:38px;border-radius:50%;display:none;
  align-items:center;justify-content:center;font-size:20px;line-height:1;cursor:pointer;backdrop-filter:blur(4px);}
"""

_VIEWER_SCRIPT = """
function __ssOpenFullscreen(){
  var el = document.documentElement;
  var req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
  try { if (req) req.call(el); } catch(e) {}
  try {
    if (screen.orientation && screen.orientation.lock) { screen.orientation.lock('portrait').catch(function(){}); }
  } catch(e) {}
  var ov = document.getElementById('__ss_tap_overlay'); if (ov) ov.style.display = 'none';
  var ex = document.getElementById('__ss_exit_fs'); if (ex) ex.style.display = 'flex';
  try { window.scrollTo(0,0); } catch(e) {}
}
function __ssExitFullscreen(){
  var exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
  try { if (exit) exit.call(document); } catch(e) {}
  try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch(e) {}
  var ex = document.getElementById('__ss_exit_fs'); if (ex) ex.style.display = 'none';
}
document.addEventListener('fullscreenchange', function(){
  if (!document.fullscreenElement) { var ex = document.getElementById('__ss_exit_fs'); if (ex) ex.style.display = 'none'; }
});
"""


def _viewer_overlay_html(title):
    safe_title = escape(title)
    return (
        f'<div id="__ss_tap_overlay"><div class="__ss_badge">&#128241;</div>'
        f'<h1>{safe_title}</h1>'
        f'<p>For the clearest view on your phone, open this report full screen in portrait mode.</p>'
        f'<button onclick="__ssOpenFullscreen()">Open Report</button></div>'
        f'<button id="__ss_exit_fs" onclick="__ssExitFullscreen()">&times;</button>'
    )


_FRAGMENT_SHELL = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0c4a6e">
<title>{title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/js/all.min.js" crossorigin="anonymous"></script>
<style>{css}</style>
</head>
<body style="margin:0;background:#f8fafc;">
{overlay}
<div id="__ss_content">
{content}
</div>
<script>{script}</script>
</body>
</html>"""


def _build_fragment_page(title, content, bare=False):
    # `bare=True` is used for the small live iframe thumbnail in the
    # gallery (Tools > Report Drafts) - same Tailwind/fonts/CSS so the
    # preview looks exactly like the real thing, but WITHOUT the
    # tap-to-fullscreen overlay, which would otherwise cover the whole
    # thumbnail with the gradient "Open Report" screen.
    return _FRAGMENT_SHELL.format(
        title=escape(title), css=_VIEWER_CSS,
        overlay='' if bare else _viewer_overlay_html(title),
        content=content, script='' if bare else _VIEWER_SCRIPT,
    )


def _build_full_doc_page(title, raw_html, bare=False):
    # The uploaded file already ships its own <html>/<head>/<body> - don't
    # duplicate a second shell around it. Instead, inject just the
    # overlay/exit-button markup right after <body ...> and the
    # fullscreen/orientation script + safe-area CSS right before </head>,
    # so an uploaded, already-complete report gets the same "tap to open
    # full screen, portrait" behavior with no visual double-wrapping.
    style_tag = f'<style>{_VIEWER_CSS}</style>'
    if re.search(r'</head>', raw_html, flags=re.IGNORECASE):
        raw_html = re.sub(r'</head>', style_tag + '</head>', raw_html, count=1, flags=re.IGNORECASE)
    else:
        raw_html = style_tag + raw_html

    if not re.search(r'<meta[^>]+viewport', raw_html, flags=re.IGNORECASE):
        viewport_tag = '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">'
        raw_html = re.sub(r'<head[^>]*>', lambda m: m.group(0) + viewport_tag, raw_html, count=1, flags=re.IGNORECASE)

    if bare:
        return raw_html

    injected = _viewer_overlay_html(title) + f'<script>{_VIEWER_SCRIPT}</script>'
    body_match = re.search(r'<body[^>]*>', raw_html, flags=re.IGNORECASE)
    if body_match:
        idx = body_match.end()
        raw_html = raw_html[:idx] + injected + raw_html[idx:]
    else:
        raw_html = raw_html + injected
    return raw_html


_DOC_DOWNLOAD_PAGE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0c4a6e">
<title>{title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;800;900&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<script src="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/js/all.min.js" crossorigin="anonymous"></script>
<style>
:root{{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);}}
html,body{{margin:0;height:100%;font-family:'Cairo','Inter',sans-serif;
  background:linear-gradient(135deg,#0c1e3d 0%,#0369a1 55%,#0ea5e9 100%);color:#fff;}}
.wrap{{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:32px;text-align:center;}}
.badge{{width:76px;height:76px;border-radius:22px;background:rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;font-size:34px;}}
h1{{font-size:21px;font-weight:900;margin:4px 0 0;max-width:320px;line-height:1.4;}}
p{{font-size:13px;opacity:.85;max-width:280px;margin:0;}}
a.dl{{background:#fff;color:#0c4a6e;text-decoration:none;padding:16px 40px;border-radius:999px;font-weight:800;font-size:15px;
  box-shadow:0 14px 34px -10px rgba(0,0,0,.5);margin-top:8px;}}
</style>
</head>
<body>
<div class="wrap">
<div class="badge"><i class="fa-solid fa-file-word"></i></div>
<h1>{title}</h1>
<p>This is a Word document. Tap below to download it, then open it with Word, Google Docs, or any office app on your phone.</p>
<a class="dl" href="{file_url}" download><i class="fa-solid fa-download"></i>&nbsp; Download Report</a>
</div>
</body>
</html>"""


def _decode_html(data: bytes) -> str:
    # FIX: the old code opened the file in text mode, which on Windows uses
    # the system code page (cp1252) - Arabic UTF-8 reports crashed with a
    # UnicodeDecodeError (a 500 error page inside the gallery preview).
    for enc in ('utf-8-sig', 'cp1256', 'latin-1'):
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            continue
    return data.decode('utf-8', errors='replace')


# FIX: Django sends "X-Frame-Options: DENY" on every page by default, which
# made the browser refuse to show this page inside the gallery's preview
# frame ("refused to connect"). This page is public, read-only content, so
# framing it is safe.
@xframe_options_exempt
@require_GET
def report_draft_public_view(request, token):
    """
    The QR-code / share-link target: GET /r/<token>/ (aliased in
    config/urls.py) and GET /api/toolkit/report-drafts/<token>/open/.
    No authentication required - a draft's token is the access control.
    """
    draft = get_object_or_404(ReportDraft, token=token, is_active=True)
    # `?preview=1` is used only for the gallery's own live iframe
    # thumbnail - it renders the same styled content but skips the
    # tap-to-fullscreen overlay, and (being an internal implementation
    # detail, not an actual "someone viewed this report") does not
    # bump view_count.
    is_preview = request.GET.get('preview') == '1'
    if not is_preview:
        ReportDraft.objects.filter(pk=draft.pk).update(view_count=models.F('view_count') + 1)

    if draft.file_type in ('doc', 'docx'):
        if is_preview:
            return HttpResponse('')  # no meaningful inline preview for Word files
        html = _DOC_DOWNLOAD_PAGE.format(title=escape(draft.title), file_url=draft.file.url)
        return HttpResponse(html, content_type='text/html; charset=utf-8')

    try:
        with draft.file.open('rb') as f:
            raw = _decode_html(f.read())
    except (FileNotFoundError, ValueError):
        raise Http404('Report file is missing.')

    # ?download=1 -> a complete, self-contained .html file (styling
    # libraries linked in) instead of the raw uploaded fragment, which
    # opened unstyled/broken when saved and double-clicked.
    if request.GET.get('download') == '1':
        if re.search(r'<html[\s>]', raw, flags=re.IGNORECASE):
            page = raw
        else:
            page = _build_fragment_page(draft.title, raw, bare=True)
        resp = HttpResponse(page, content_type='text/html; charset=utf-8')
        resp['Content-Disposition'] = "attachment; filename*=UTF-8''" + quote(f'{draft.title}.html')
        return resp

    if re.search(r'<html[\s>]', raw, flags=re.IGNORECASE):
        html = _build_full_doc_page(draft.title, raw, bare=is_preview)
    else:
        html = _build_fragment_page(draft.title, raw, bare=is_preview)
    return HttpResponse(html, content_type='text/html; charset=utf-8')
