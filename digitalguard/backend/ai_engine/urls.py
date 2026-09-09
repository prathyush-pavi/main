from django.urls import path
from . import views

urlpatterns = [
    path('ai/analyze/', views.analyze_text, name='ai-analyze'),
    path('browser/check-url/', views.check_url, name='browser-check-url'),
]
