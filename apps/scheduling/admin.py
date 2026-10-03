from django.contrib import admin
from .models import Resource, Appointment, ResourceBlock

admin.site.register(Resource)
admin.site.register(Appointment)
admin.site.register(ResourceBlock)
