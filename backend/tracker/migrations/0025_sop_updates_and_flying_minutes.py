from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings

class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0024_disable_2fa_for_all'),
    ]

    operations = [
        # Submission updates
        migrations.AddField(
            model_name='submission',
            name='classification',
            field=models.CharField(choices=[('confidential', 'Confidential'), ('unclassified', 'Unclassified'), ('restricted', 'Restricted')], default='confidential', help_text='All submissions are Confidential by default per SOP Section 4.', max_length=24),
        ),
        migrations.AddField(
            model_name='submission',
            name='dg_endorsed_at',
            field=models.DateTimeField(blank=True, help_text='When the Head of Agency endorsed this submission.', null=True),
        ),
        migrations.AddField(
            model_name='submission',
            name='dg_endorsed_by',
            field=models.ForeignKey(blank=True, help_text='Director General / Head of Agency who endorsed this submission.', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='endorsed_submissions', to=settings.AUTH_USER_MODEL),
        ),
        # Meeting updates
        migrations.AddField(
            model_name='meeting',
            name='agenda_status',
            field=models.CharField(choices=[('draft', 'Draft'), ('with_chairman', 'With Chairman for Approval'), ('chairman_approved', 'Chairman Approved'), ('circulated', 'Circulated to Members')], default='draft', help_text='Tracking: draft → with Chairman → Chairman approved → circulated.', max_length=24),
        ),
        migrations.AddField(
            model_name='meeting',
            name='agenda_approved_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='meeting',
            name='agenda_approved_by',
            field=models.ForeignKey(blank=True, help_text='Chairperson who reviewed and approved the agenda.', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='agendas_approved', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AlterField(
            model_name='meeting',
            name='type',
            field=models.CharField(choices=[('ordinary', 'Ordinary Sitting'), ('special', 'Special Sitting'), ('flying_minute', 'Flying Minute'), ('emergency', 'Emergency Sitting')], default='ordinary', max_length=16),
        ),
        # FlyingMinuteSignature model
        migrations.CreateModel(
            name='FlyingMinuteSignature',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('decision', models.CharField(choices=[('approve', 'Approve'), ('reject', 'Reject'), ('abstain', 'Abstain')], max_length=16)),
                ('signed_at', models.DateTimeField(auto_now_add=True)),
                ('remarks', models.TextField(blank=True, help_text="Optional remarks or conditions attached to this member's decision.")),
                ('meeting', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='flying_minute_signatures', to='tracker.meeting')),
                ('member', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='flying_minute_signatures', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Flying Minute Signature',
                'verbose_name_plural': 'Flying Minute Signatures',
                'ordering': ['signed_at'],
                'unique_together': {('meeting', 'member')},
            },
        ),
        # Role choices updates
        migrations.AlterField(
            model_name='profile',
            name='role',
            field=models.CharField(choices=[('psc_admin', 'PSC Administrator'), ('psc_officer', 'PSC Officer'), ('psc_secretary', 'PSC Secretary'), ('senior_admin_officer', 'Senior Administration Officer'), ('psc_commissioner', 'PSC Commissioner'), ('chairperson', 'Chairperson, PSC'), ('psc_manager', 'OPSC Manager'), ('principal_officer', 'Principal Officer'), ('senior_officer', 'Senior Officer'), ('head_of_agency', 'Head of Agency (DG/Director)'), ('ministry_hr', 'Ministry HR Officer'), ('dept_admin', 'Department Admin Officer'), ('vipam_manager', 'VIPAM Manager'), ('hr_unit_manager', 'HR Unit Manager'), ('odu_manager', 'ODU Manager'), ('compliance_manager', 'Compliance Manager')], max_length=32),
        ),
        migrations.AlterField(
            model_name='roledefinition',
            name='role',
            field=models.CharField(choices=[('psc_admin', 'PSC Administrator'), ('psc_officer', 'PSC Officer'), ('psc_secretary', 'PSC Secretary'), ('senior_admin_officer', 'Senior Administration Officer'), ('psc_commissioner', 'PSC Commissioner'), ('chairperson', 'Chairperson, PSC'), ('psc_manager', 'OPSC Manager'), ('principal_officer', 'Principal Officer'), ('senior_officer', 'Senior Officer'), ('head_of_agency', 'Head of Agency (DG/Director)'), ('ministry_hr', 'Ministry HR Officer'), ('dept_admin', 'Department Admin Officer'), ('vipam_manager', 'VIPAM Manager'), ('hr_unit_manager', 'HR Unit Manager'), ('odu_manager', 'ODU Manager'), ('compliance_manager', 'Compliance Manager')], max_length=50, unique=True),
        ),
    ]
