from rest_framework import serializers
from .models import User, Client, ClientTag, PhoneNumber, StaffMember, StaffEvaluation

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'phone', 'language_preference', 'theme_preference']
        read_only_fields = ['id']

class ClientTagSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClientTag
        fields = ['id', 'name', 'color']

class ClientSerializer(serializers.ModelSerializer):
    # FIX: these were plain IntegerField/DecimalField declarations, which
    # made DRF look for actual model ATTRIBUTES named 'session_count' /
    # 'total_revenue' / 'outstanding_balance' on the Client instance.
    # Those don't exist - only the get_session_count() / get_total_revenue()
    # / get_outstanding_balance() METHODS do - so every field silently
    # failed to resolve and (because read_only implies not required) was
    # just dropped from the response instead of raising an error. Pages
    # like Progress relied on this data and always got nothing.
    # SerializerMethodField is the correct way to expose a model method's
    # return value, and it does use the get_<field_name> methods below.
    session_count = serializers.SerializerMethodField()
    total_revenue = serializers.SerializerMethodField()
    outstanding_balance = serializers.SerializerMethodField()
    tags = ClientTagSerializer(many=True, read_only=True)
    tags_input = serializers.ListField(child=serializers.CharField(), write_only=True, required=False)

    class Meta:
        model = Client
        fields = '__all__'
        # FIX: created_by is a required FK on the model with no default.
        # It wasn't read-only, so DRF treated it as a required INPUT field
        # - but the frontend's Add Client form (correctly) never sends it,
        # since it should be set automatically from the logged-in user.
        # Every create request failed validation ("This field is
        # required") before a client was ever saved. It's now set in
        # ClientViewSet.perform_create() instead of being user input.
        read_only_fields = ['client_id', 'created_at', 'updated_at', 'created_by']

    def get_session_count(self, obj):
        return obj.get_session_count()

    def get_total_revenue(self, obj):
        return obj.get_total_revenue()

    def get_outstanding_balance(self, obj):
        return obj.get_outstanding_balance()

    def create(self, validated_data):
        tags_data = validated_data.pop('tags_input', [])
        client = Client.objects.create(**validated_data)
        for tag_name in tags_data:
            tag, _ = ClientTag.objects.get_or_create(name=tag_name.strip())
            client.tags.add(tag)
        return client

    def update(self, instance, validated_data):
        tags_data = validated_data.pop('tags_input', [])
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if tags_data:
            instance.tags.clear()
            for tag_name in tags_data:
                tag, _ = ClientTag.objects.get_or_create(name=tag_name.strip())
                instance.tags.add(tag)
        return instance

class PhoneNumberSerializer(serializers.ModelSerializer):
    class Meta:
        model = PhoneNumber
        fields = '__all__'

class StaffMemberSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = StaffMember
        fields = '__all__'

class StaffEvaluationSerializer(serializers.ModelSerializer):
    staff_name = serializers.CharField(source='staff.user.get_full_name', read_only=True)

    class Meta:
        model = StaffEvaluation
        fields = '__all__'
        # FIX: same bug class as Client.created_by - required FK, not
        # user input, has to be set from the logged-in user instead.
        read_only_fields = ['created_by']