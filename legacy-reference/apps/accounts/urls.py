from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from .views import CustomAuthToken   # <-- add this import

router = DefaultRouter()
router.register(r'clients', views.ClientViewSet)
router.register(r'client-tags', views.ClientTagViewSet)
router.register(r'staff', views.StaffMemberViewSet)
router.register(r'evaluations', views.StaffEvaluationViewSet)

urlpatterns = [
    path('auth/login/', CustomAuthToken.as_view()),   # <-- add this line
    path('', include(router.urls)),
]