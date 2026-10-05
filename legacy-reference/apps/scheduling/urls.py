from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'resources', views.ResourceViewSet)
router.register(r'appointments', views.AppointmentViewSet)
router.register(r'blocks', views.ResourceBlockViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
