import os
import re
import socket
from urllib.parse import urlsplit, urlunsplit

from django.conf import settings
from rest_framework import serializers
from .models import ScriptTemplate, ServiceProfile, ReportDraft

_PRIVATE_IP_RE = re.compile(r'^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)')


def _manual_lan_override():
    # NEW: escape hatch for when auto-detection (below) picks the wrong
    # network adapter, or a firewall/VPN blocks the UDP trick entirely -
    # set SMARTSHOOTS_PUBLIC_HOST to force every report's QR/link to use
    # that exact host (e.g. SMARTSHOOTS_PUBLIC_HOST=192.168.1.20), no
    # detection involved at all.
    return (os.environ.get('SMARTSHOOTS_PUBLIC_HOST') or '').strip() or None


def _detect_lan_ip():
    # FIX: a report's QR code must point at an address a PHONE on the same
    # Wi-Fi can reach - but the desktop app often talks to this very
    # backend over 127.0.0.1 (its own loopback), and Django's normal
    # request.build_absolute_uri() just echoes back whatever Host header
    # the request happened to arrive on. That baked "http://127.0.0.1:8000"
    # or "http://localhost:8000" straight into every report link, which
    # means "this phone" to whatever device scans it - never the PC. This
    # asks the OS for this machine's actual LAN-facing IP instead (no
    # packet is sent; connecting a UDP socket just makes the OS resolve
    # which local interface/address would be used for outbound traffic),
    # the same technique the existing "Connect your phone" screen already
    # uses on the Electron side (desktop-app/main.js, get-lan-address).
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            s.connect(('8.8.8.8', 80))
            return s.getsockname()[0]
        finally:
            s.close()
    except OSError:
        return None


class ScriptTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScriptTemplate
        fields = '__all__'
        read_only_fields = ['template_id', 'created_by', 'created_at', 'updated_at']


class ServiceProfileSerializer(serializers.ModelSerializer):
    # Read-friendly extras so the frontend doesn't need a second request
    # per profile just to show package names/prices and the suggested
    # script's text.
    recommended_packages_detail = serializers.SerializerMethodField()
    suggested_script_detail = ScriptTemplateSerializer(source='suggested_script', read_only=True)

    class Meta:
        model = ServiceProfile
        fields = '__all__'
        read_only_fields = ['profile_id', 'created_by', 'created_at', 'updated_at']

    def get_recommended_packages_detail(self, obj):
        return [
            {'id': p.id, 'name': p.name, 'type': p.type, 'default_rate': p.default_rate, 'unit': p.unit}
            for p in obj.recommended_packages.all()
        ]


class ReportDraftSerializer(serializers.ModelSerializer):
    """
    NEW: "Report Drafts" library serializer.

    `file_url` is the raw uploaded file (used for direct download and
    for the live iframe thumbnail in the gallery). `public_view_url` and
    `qr_value` point at the AllowAny viewer route (views.report_draft_public_view)
    - that's the URL that actually gets encoded into the QR code, since
    it works for any phone that scans it, logged in or not.
    """
    file_url = serializers.SerializerMethodField()
    public_view_url = serializers.SerializerMethodField()
    qr_value = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ReportDraft
        fields = [
            'id', 'token', 'title', 'category', 'description', 'file', 'file_url', 'file_type',
            'is_active', 'view_count', 'created_by', 'created_by_name', 'created_at', 'updated_at',
            'public_view_url', 'qr_value',
        ]
        read_only_fields = ['token', 'file_type', 'is_active', 'view_count', 'created_by', 'created_at', 'updated_at']
        extra_kwargs = {'file': {'write_only': True}}

    def _absolute(self, request, path):
        return request.build_absolute_uri(path) if request else path

    def _report_base_url(self, request):
        # Root used for public_view_url/qr_value ONLY - file_url is left
        # alone (it's fetched by the same device/app session that's
        # already talking to whichever address got it this far, so the
        # Host header is correct for that one). This one is specifically
        # for links meant to be opened on a DIFFERENT device (the phone
        # that scans the QR code), so it must be LAN-reachable.
        if not request:
            return ''
        root = request.build_absolute_uri('/')
        parts = urlsplit(root)
        hostname = (parts.hostname or '').lower()

        # FIX: only override the host when it's actually a LOOPBACK
        # address (127.0.0.1 / localhost / ::1) - that's the one case
        # that is GUARANTEED unreachable from any other device, so it's
        # always safe to replace. If the request already arrived over a
        # real LAN address (the phone/APK hit the server directly, or a
        # browser opened it via the PC's LAN IP), that address is proof
        # positive it's reachable - keep it as-is rather than guessing,
        # since a machine with more than one active network adapter
        # (Wi-Fi + Ethernet, or a VPN) could otherwise have this pick a
        # DIFFERENT interface than the one that actually works.
        if hostname not in ('127.0.0.1', 'localhost', '::1'):
            return root.rstrip('/')

        lan_ip = _manual_lan_override() or _detect_lan_ip()
        if lan_ip and (_manual_lan_override() or _PRIVATE_IP_RE.match(lan_ip)):
            netloc = f'{lan_ip}:{parts.port}' if parts.port else lan_ip
            return urlunsplit((parts.scheme, netloc, '', '', '')).rstrip('/')
        return root.rstrip('/')

    def get_file_url(self, obj):
        request = self.context.get('request')
        if not obj.file:
            return None
        return self._absolute(request, obj.file.url)

    def get_public_view_url(self, obj):
        request = self.context.get('request')
        base = self._report_base_url(request)
        return f'{base}/r/{obj.token}/' if base else f'/r/{obj.token}/'

    def get_qr_value(self, obj):
        # Same URL as public_view_url - split out as its own field so the
        # frontend never has to guess/derive it and QR + "open" always
        # point at the exact same place.
        return self.get_public_view_url(obj)

    def get_created_by_name(self, obj):
        return getattr(obj.created_by, 'username', None) if obj.created_by else None

    def validate_file(self, value):
        ext = value.name.rsplit('.', 1)[-1].lower() if '.' in value.name else ''
        if ext not in ('html', 'htm', 'doc', 'docx'):
            raise serializers.ValidationError('Only .html, .doc or .docx files can be uploaded here.')
        max_mb = 25
        if value.size > max_mb * 1024 * 1024:
            raise serializers.ValidationError(f'File is too large (max {max_mb}MB).')
        return value
