"""
Migration 0054 — Add Decision Register fields to CommissionTask.

Adds:
  - decision_number     (CharField, blank)
  - meeting             (FK → Meeting, nullable)
  - decision_detail     (TextField, blank)
  - decision_outcome    (CharField choices: approved/deferred_next/deferred_info/rejected)
  - action_unit         (CharField choices: CIU/CSU/FHU/HRMU/ODU/OPSC_Secretary/VIPAM_HRDU)
  - implementation_status (CharField choices: with_unit/matters_arising/actioned/now_irrelevant)
  - way_forward         (TextField, blank)

Also makes `submission` nullable (blank=True, null=True) so standalone
decisions that do not link to a tracked submission can still be recorded.
"""
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0052_seed_demo_data'),
    ]

    operations = [
        # ── New Decision Register fields ──────────────────────────────────────
        migrations.AddField(
            model_name='commissiontask',
            name='decision_number',
            field=models.CharField(
                blank=True, max_length=64,
                help_text="e.g. '02-28-2025' (decision#-meeting#-year).",
            ),
        ),
        migrations.AddField(
            model_name='commissiontask',
            name='meeting',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='commission_tasks',
                to='tracker.meeting',
                help_text='Commission sitting that produced this decision.',
            ),
        ),
        migrations.AddField(
            model_name='commissiontask',
            name='decision_detail',
            field=models.TextField(
                blank=True,
                help_text='Full text of what the Commission decided.',
            ),
        ),
        migrations.AddField(
            model_name='commissiontask',
            name='decision_outcome',
            field=models.CharField(
                blank=True, max_length=32,
                choices=[
                    ('approved',      'Approved'),
                    ('deferred_next', 'Deferred To Next Meeting'),
                    ('deferred_info', 'Deferred — Need more information'),
                    ('rejected',      'Rejected'),
                ],
            ),
        ),
        migrations.AddField(
            model_name='commissiontask',
            name='action_unit',
            field=models.CharField(
                blank=True, max_length=32,
                choices=[
                    ('CIU',            'CIU'),
                    ('CSU',            'CSU'),
                    ('FHU',            'FHU'),
                    ('HRMU',           'HRMU'),
                    ('ODU',            'ODU'),
                    ('OPSC_Secretary', 'OPSC Secretary'),
                    ('VIPAM_HRDU',     'VIPAM/HRDU'),
                ],
                help_text='OPSC unit responsible for actioning this decision.',
            ),
        ),
        migrations.AddField(
            model_name='commissiontask',
            name='implementation_status',
            field=models.CharField(
                blank=True, max_length=32,
                default='with_unit',
                choices=[
                    ('with_unit',       'With Unit Responsible'),
                    ('matters_arising', 'Matters Arising'),
                    ('actioned',        'Actioned'),
                    ('now_irrelevant',  'Now Irrelevant'),
                ],
            ),
        ),
        migrations.AddField(
            model_name='commissiontask',
            name='way_forward',
            field=models.TextField(
                blank=True,
                help_text='Notes on next steps or way forward.',
            ),
        ),
        # ── Make submission optional ──────────────────────────────────────────
        migrations.AlterField(
            model_name='commissiontask',
            name='submission',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='commission_tasks',
                to='tracker.submission',
            ),
        ),
    ]
