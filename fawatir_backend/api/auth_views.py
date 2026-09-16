from django.contrib.auth.hashers import make_password, check_password
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from .models import User, Organization, Role


def get_tokens_for_user(user):
    refresh = RefreshToken()
    refresh["user_id"] = str(user.id)
    refresh["email"] = user.email
    return {
        "refresh": str(refresh),
        "access": str(refresh.access_token),
    }


class RegisterView(APIView):
    permission_classes = []

    def post(self, request):
        nom = request.data.get("nom", "")
        email = request.data.get("email")
        password = request.data.get("password")

        if not email or not password:
            return Response({"detail": "Email et mot de passe requis."}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(email=email).exists():
            return Response({"detail": "Un compte existe déjà avec cet email."}, status=status.HTTP_400_BAD_REQUEST)

        org = Organization.objects.create(name=f"{nom or email} - Entreprise")
        role = Role.objects.create(organisation=org, display_name="Admin", system_name="admin")

        user = User.objects.create(
            organisation=org,
            role=role,
            first_name=nom,
            email=email,
            password_hash=make_password(password),
        )

        tokens = get_tokens_for_user(user)
        return Response({
            "user": {
                "id": str(user.id),
                "email": user.email,
                "nom": user.first_name,
                "role": role.display_name,
                "company": str(user.organisation_id),
                "organisation": str(user.organisation_id),
            },
            **tokens,
        }, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = []

    def post(self, request):
        email = request.data.get("email")
        password = request.data.get("password")

        if not email or not password:
            return Response({"detail": "Email et mot de passe requis."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({"detail": "Identifiants invalides."}, status=status.HTTP_401_UNAUTHORIZED)

        if not user.password_hash or not check_password(password, user.password_hash):
            return Response({"detail": "Identifiants invalides."}, status=status.HTTP_401_UNAUTHORIZED)

        tokens = get_tokens_for_user(user)
        return Response({
            "user": {
                "id": str(user.id),
                "email": user.email,
                "nom": user.first_name,
                "role": user.role.display_name if user.role else None,
                "company": str(user.organisation_id) if user.organisation_id else None,
                "organisation": str(user.organisation_id) if user.organisation_id else None,
            },
            **tokens,
        }, status=status.HTTP_200_OK)