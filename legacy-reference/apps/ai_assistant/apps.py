from django.apps import AppConfig


class AiAssistantConfig(AppConfig):
    # FIX: must match the dotted path used in INSTALLED_APPS
    # ('apps.ai_assistant'), otherwise Django refuses to start with
    # "AiAssistantConfig.name must be 'apps.ai_assistant'".
    name = 'apps.ai_assistant'
