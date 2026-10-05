from django.urls import path
from . import views

urlpatterns = [
    path('dashboard/', views.DashboardReportView.as_view(), name='dashboard-report'),
    path('financial/', views.FinancialReportView.as_view(), name='financial-report'),
]


from django.urls import path
from .views import ClientProfitabilityView

urlpatterns += [
    path('client-profitability/', ClientProfitabilityView.as_view(), name='client-profitability'),
]
