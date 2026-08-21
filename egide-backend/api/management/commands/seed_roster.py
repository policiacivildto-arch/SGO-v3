import json

from django.core.management.base import BaseCommand, CommandError

from api.models import RosterPolicial

DEFAULT_SEED_PATH = 'api/seed_data/policiais_roster.json'


class Command(BaseCommand):
    help = (
        "Popula RosterPolicial (matricula/nome/cargo) a partir de um JSON no formato "
        "[{'matricula': ..., 'nome': ..., 'cargo_atual': ...}, ...]. "
        "Usado para o autocompletar de matrícula nos formulários do frontend."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--path',
            default=DEFAULT_SEED_PATH,
            help=f'Caminho do JSON de origem (padrão: {DEFAULT_SEED_PATH}).',
        )

    def handle(self, *args, **options):
        path = options['path']

        try:
            with open(path, encoding='utf-8') as f:
                records = json.load(f)
        except FileNotFoundError:
            raise CommandError(f"Arquivo não encontrado: {path}")
        except json.JSONDecodeError as exc:
            raise CommandError(f"JSON inválido em {path}: {exc}")

        criados = 0
        atualizados = 0
        ignorados = 0

        for item in records:
            matricula = str(item.get('matricula', '')).strip()
            nome = str(item.get('nome', '')).strip()
            cargo = str(item.get('cargo_atual', item.get('cargo', ''))).strip()

            if not matricula or not nome:
                ignorados += 1
                continue

            _, created = RosterPolicial.objects.update_or_create(
                matricula=matricula,
                defaults={'nome': nome, 'cargo': cargo},
            )
            if created:
                criados += 1
            else:
                atualizados += 1

        self.stdout.write(self.style.SUCCESS(
            f"Roster atualizado: {criados} criados, {atualizados} atualizados, "
            f"{ignorados} ignorados (sem matrícula/nome)."
        ))
