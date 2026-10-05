from django.urls import path
from .views import AssistantQueryView

urlpatterns = [
    path('query/', AssistantQueryView.as_view(), name='assistant-query'),
]