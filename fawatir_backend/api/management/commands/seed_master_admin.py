from django.core.management.base import BaseCommand
from api.models import Organization, Role, User
from django.contrib.auth.hashers import make_password
from django.contrib.auth import get_user_model
import os

class Command(BaseCommand):
    help = 'Seeds the database with the Master Admin account'

    def handle(self, *args, **kwargs):
        admin_email = os.environ.get('MASTER_ADMIN_EMAIL', 'maryamelosmani@gmail.com').strip().lower()
        admin_password = os.environ.get('MASTER_ADMIN_PASSWORD', 'Admin123!').strip()
        
        # Ensure default org exists
        org, _ = Organization.objects.get_or_create(
            name="Tadbir AI Enterprise",
            defaults={"subscription_plan": "Enterprise", "is_active": True}
        )

        # Ensure default Admin role exists
        role, _ = Role.objects.get_or_create(
            organisation=org,
            display_name="Administrateur",
            defaults={"system_name": "administrateur"}
        )

        # Check if user already exists
        if User.objects.filter(email=admin_email).exists():
            self.stdout.write(self.style.SUCCESS(f'Master admin {admin_email} already exists.'))
            return

        # Create the Tenant User
        api_user = User.objects.create(
            organisation=org,
            role=role,
            email=admin_email,
            first_name="Master",
            last_name="Admin",
            password_hash=make_password(admin_password),
            is_active=True,
            email_verified=True,
        )

        # Ensure Django auth user exists
        DjangoUser = get_user_model()
        django_user, created = DjangoUser.objects.get_or_create(
            email=admin_email,
            defaults={
                'username': admin_email,
                'first_name': "Master",
                'last_name': "Admin",
                'is_staff': True,
                'is_superuser': True
            }
        )
        if created:
            django_user.set_password(admin_password)
            django_user.save()
        else:
            django_user.set_password(admin_password)
            django_user.is_staff = True
            django_user.is_superuser = True
            django_user.save()

        self.stdout.write(self.style.SUCCESS(f'Successfully created Master Admin: {admin_email}'))
