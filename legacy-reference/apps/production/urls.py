from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'packages', views.PackageViewSet)
router.register(r'orders', views.ProductionOrderViewSet)
router.register(r'assignments', views.ProductionAssignmentViewSet)
router.register(r'deliveries', views.DeliveryViewSet)

urlpatterns = [
    path('', include(router.urls)),
]

router.register(r'time-logs', views.TimeLogViewSet)
