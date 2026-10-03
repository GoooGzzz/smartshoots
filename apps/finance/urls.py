from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'payments', views.PaymentViewSet)
router.register(r'expense-categories', views.ExpenseCategoryViewSet)
router.register(r'expenses', views.ExpenseViewSet)
router.register(r'attachments', views.AttachmentViewSet)
router.register(r'settings', views.BusinessSettingsViewSet)

urlpatterns = [
    path('backup/', views.BackupView.as_view(), name='backup'),
    path('restore/', views.RestoreView.as_view(), name='restore'),
    path('', include(router.urls)),
]
