**Issue:** The Django backend is throwing a 404 error on the root URL (`http://localhost:8000/`) because there is no URL pattern defined for the empty path (`""`).

**File to Update:**
`fawatir_backend/urls.py` (the main project URL configuration file).

**Requested Fix:**
Please update this file to handle the root route. You can do this in one of two ways. Please choose whichever fits our architecture best:

#### Option 1: Redirect to the API Docs (Recommended)

Automatically redirect anyone who visits the root URL to the Swagger UI.

**In `fawatir_backend/urls.py`:**

1. **At the top of the file**, add this import:
```python
from django.views.generic import RedirectView

```


2. **Inside the `urlpatterns` list**, add this line at the very top:
```python
urlpatterns = [
    path('', RedirectView.as_view(url='/api/docs/', permanent=False), name='index'),

    # ... your existing admin and api routes ...
    path('admin/', admin.site.urls),
    # ...
]

```



#### Option 2: Add a Simple JSON Health Check

Return a simple status response so the frontend and Docker health checks know the server is awake.

**In `fawatir_backend/urls.py`:**

1. **At the top of the file**, add this import and function:
```python
from django.http import JsonResponse

def health_check(request):
    return JsonResponse({"status": "healthy", "service": "Fawatir Backend"})

```


2. **Inside the `urlpatterns` list**, add this line at the very top:
```python
urlpatterns = [
    path('', health_check, name='health_check'),

    # ... your existing admin and api routes ...
    path('admin/', admin.site.urls),
    # ...
]

```
