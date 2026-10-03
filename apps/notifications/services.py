from django.conf import settings

# FIX: `twilio` was imported at module level, but it's not in
# requirements.txt and Twilio credentials are blank by default (this is an
# optional feature). That made ANY import of this module - including the
# whole send_reminders command - crash with ModuleNotFoundError on a
# machine that hasn't separately `pip install twilio`d.
# The import is now deferred until someone actually has Twilio configured
# and calls one of these functions, so the app works fully offline/without
# WhatsApp-SMS reminders unless you opt in.


def _get_twilio_client():
    from twilio.rest import Client  # requires: pip install twilio
    return Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)


def send_whatsapp(to_phone, message):
    if not settings.TWILIO_ACCOUNT_SID:
        return  # Twilio not configured - silently skip instead of crashing
    client = _get_twilio_client()
    client.messages.create(
        from_=f'whatsapp:{settings.TWILIO_WHATSAPP_NUMBER}',
        body=message,
        to=f'whatsapp:{to_phone}'
    )


def send_sms(to_phone, message):
    if not settings.TWILIO_ACCOUNT_SID:
        return
    client = _get_twilio_client()
    client.messages.create(
        from_=settings.TWILIO_WHATSAPP_NUMBER,  # use a Twilio phone number for SMS
        body=message,
        to=to_phone
    )