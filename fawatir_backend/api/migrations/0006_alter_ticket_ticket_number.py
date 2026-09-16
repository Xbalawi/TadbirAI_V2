# Generated for ticket_number alter field
from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('api', '0005_rename_organization_activitylog_organisation_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='ticket',
            name='ticket_number',
            field=models.CharField(max_length=100, unique=True),
        ),
    ]
