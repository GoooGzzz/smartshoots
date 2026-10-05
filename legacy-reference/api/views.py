from rest_framework.decorators import api_view
from rest_framework.response import Response

@api_view(['GET'])
def health_check(request):
    return Response({"status": "ok", "message": "SMART SHOOTS API is running"})
from django.http import HttpResponse

def home(request):
    return HttpResponse("Welcome to SMART SHOOTS API")