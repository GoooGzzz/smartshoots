from django.contrib import admin
from .models import Package, ProductionOrder, ProductionAssignment, Delivery

admin.site.register(Package)
admin.site.register(ProductionOrder)
admin.site.register(ProductionAssignment)
admin.site.register(Delivery)
