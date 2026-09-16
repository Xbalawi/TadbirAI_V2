from django.contrib import admin
from django.apps import apps

# Get all models from the 'api' app
app_models = apps.get_app_config('api').get_models()

for model in app_models:
    try:
        # Dynamically create an Admin class to display all fields in the list view
        class CustomModelAdmin(admin.ModelAdmin):
            list_display = [field.name for field in model._meta.fields]
            
        admin.site.register(model, CustomModelAdmin)
    except admin.sites.AlreadyRegistered:
        pass