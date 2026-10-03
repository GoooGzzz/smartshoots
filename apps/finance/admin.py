from django.contrib import admin
from .models import Payment, ExpenseCategory, Expense, Attachment, BusinessSettings

admin.site.register(Payment)
admin.site.register(ExpenseCategory)
admin.site.register(Expense)
admin.site.register(Attachment)
admin.site.register(BusinessSettings)
