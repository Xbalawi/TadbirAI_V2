FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies: Tesseract OCR, Arabic/French/English packages, and C compilers for Python libs
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-fra \
    tesseract-ocr-ara \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt-get/lists/*

# Install Python requirements using pre-compiled binaries
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

COPY . /app/

EXPOSE 8000

CMD ["sh", "-c", "python manage.py migrate && python manage.py runserver 0.0.0.0:8000"]

# FROM node:18-alpine AS deps
# WORKDIR /app
# Use wildcard matching so package-lock.json is optional if missing
# COPY package*.json ./
# RUN npm install

# FROM node:18-alpine AS builder
# WORKDIR /app
# COPY --from=deps /app/node_modules ./node_modules
# COPY . .
# ENV NEXT_TELEMETRY_DISABLED=1
# RUN npm run build

# FROM node:18-alpine AS runner
