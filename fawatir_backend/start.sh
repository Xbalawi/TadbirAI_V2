#!/bin/sh
python manage.py migrate
python manage.py seed_master_admin
gunicorn fawatir_backend.wsgi:application --bind 0.0.0.0:${PORT:-8000}
