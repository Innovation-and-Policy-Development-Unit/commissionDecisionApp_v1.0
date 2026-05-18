from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0034_psc_form_type'),
    ]

    operations = [
        migrations.AddField(
            model_name='pscformtype',
            name='form_category',
            field=models.ForeignKey(
                blank=True,
                help_text='Category this form belongs to — used to filter PSC forms by selected category.',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='form_types',
                to='tracker.formcategory',
            ),
        ),
    ]
