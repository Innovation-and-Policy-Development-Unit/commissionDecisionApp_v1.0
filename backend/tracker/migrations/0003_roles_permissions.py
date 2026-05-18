from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0002_otp_password_reset'),
    ]

    operations = [
        # ── SystemPermission ───────────────────────────────────────────────
        migrations.CreateModel(
            name='SystemPermission',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code', models.CharField(max_length=100, unique=True)),
                ('label', models.CharField(max_length=200)),
                ('description', models.TextField(blank=True)),
                ('category', models.CharField(
                    choices=[
                        ('submissions',    'Submissions'),
                        ('workflow',       'Workflow & Transitions'),
                        ('reports',        'Reports & Analytics'),
                        ('secretariat',    'Secretariat Functions'),
                        ('tasks',          'Task Allocation'),
                        ('administration', 'System Administration'),
                    ],
                    default='administration',
                    max_length=50,
                )),
                ('is_builtin', models.BooleanField(default=False)),
            ],
            options={'ordering': ['category', 'code']},
        ),

        # ── RoleDefinition ─────────────────────────────────────────────────
        migrations.CreateModel(
            name='RoleDefinition',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('role', models.CharField(
                    choices=[
                        ('psc_admin',        'PSC Administrator'),
                        ('psc_officer',      'PSC Officer'),
                        ('psc_secretary',    'PSC Secretary'),
                        ('psc_commissioner', 'PSC Commissioner'),
                        ('psc_manager',      'OPSC Manager'),
                        ('principal_officer','Principal Officer'),
                        ('senior_officer',   'Senior Officer'),
                        ('ministry_hr',      'Ministry HR Officer'),
                        ('dept_admin',       'Department Admin Officer'),
                    ],
                    max_length=50,
                    unique=True,
                )),
                ('description', models.TextField(blank=True)),
                ('is_builtin', models.BooleanField(default=True)),
                ('permissions', models.ManyToManyField(
                    blank=True,
                    related_name='role_definitions',
                    to='tracker.systempermission',
                )),
            ],
            options={'ordering': ['role']},
        ),
    ]
