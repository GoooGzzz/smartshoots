from django.contrib import admin
from .models import User, Client, PhoneNumber, StaffMember, StaffEvaluation

admin.site.register(User)
admin.site.register(Client)
admin.site.register(PhoneNumber)
admin.site.register(StaffMember)
admin.site.register(StaffEvaluation)
