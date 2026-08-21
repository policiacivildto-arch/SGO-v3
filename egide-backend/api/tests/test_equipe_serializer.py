from types import SimpleNamespace

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import serializers

from api.models import Delegacia, Departamento, Equipe, Policial, Vaga
from api.models_security import PerfilPolicial
from api.serializers import EquipeSerializer


class EquipeSerializerWeeklyLimitTests(TestCase):
    def setUp(self):
        self.departamento_unico = Departamento.objects.create(
            nome='Departamento Técnico Operacional',
            sigla='DTO',
        )
        self.delegacia_unica = Delegacia.objects.create(
            nome='DTO',
            departamento=self.departamento_unico,
        )

        self.departamento_multi = Departamento.objects.create(
            nome='Departamento Multi',
            sigla='DMT',
        )
        self.delegacia_multi_a = Delegacia.objects.create(
            nome='Delegacia Multi A',
            departamento=self.departamento_multi,
        )
        self.delegacia_multi_b = Delegacia.objects.create(
            nome='Delegacia Multi B',
            departamento=self.departamento_multi,
        )

        self.departamento_dhpp = Departamento.objects.create(
            nome='Departamento de Homicídios e Proteção à Pessoa',
            sigla='DHPP',
        )
        self.delegacia_dhpp_a = Delegacia.objects.create(
            nome='DHPP A',
            departamento=self.departamento_dhpp,
        )
        self.delegacia_dhpp_b = Delegacia.objects.create(
            nome='DHPP B',
            departamento=self.departamento_dhpp,
        )

        self.policial_user = User.objects.create_user(
            username='policial',
            email='policial@example.com',
        )
        self.policial = Policial.objects.create(
            usuario=self.policial_user,
            matricula='12345678',
            nome='Policial DTO',
            classe='Praça',
            cargo='Policial Civil',
            delegacia=self.delegacia_unica,
            email='policial.dto@example.com',
        )
        PerfilPolicial.objects.create(policial=self.policial, tipo='policial')

        self.admin_user = User.objects.create_user(
            username='admin',
            email='admin@example.com',
        )
        self.admin_policial = Policial.objects.create(
            usuario=self.admin_user,
            matricula='87654321',
            nome='Admin EGIDE',
            classe='Praça',
            cargo='Policial Civil',
            delegacia=self.delegacia_unica,
            email='admin.policial@example.com',
        )
        PerfilPolicial.objects.create(policial=self.admin_policial, tipo='admin')

        self.policial_multi_user = User.objects.create_user(
            username='policial_multi',
            email='policial.multi@example.com',
        )
        self.policial_multi = Policial.objects.create(
            usuario=self.policial_multi_user,
            matricula='11223344',
            nome='Policial Multi',
            classe='Praça',
            cargo='Policial Civil',
            delegacia=self.delegacia_multi_a,
            email='policial.multi.corp@example.com',
        )
        PerfilPolicial.objects.create(policial=self.policial_multi, tipo='policial')

        self.policial_dhpp_user = User.objects.create_user(
            username='policial_dhpp',
            email='policial.dhpp@example.com',
        )
        self.policial_dhpp = Policial.objects.create(
            usuario=self.policial_dhpp_user,
            matricula='22334455',
            nome='Policial DHPP',
            classe='Praça',
            cargo='Policial Civil',
            delegacia=self.delegacia_dhpp_a,
            email='policial.dhpp.corp@example.com',
        )
        PerfilPolicial.objects.create(policial=self.policial_dhpp, tipo='policial')

    def _build_serializer(self, user, data):
        request = SimpleNamespace(user=user)
        return EquipeSerializer(data=data, context={'request': request})

    def _create_vaga(self, delegacia, data, turno='day'):
        return Vaga.objects.create(
            delegacia=delegacia,
            data=data,
            turno=turno,
            posicoes_disponiveis=1,
        )

    def test_bloqueia_segunda_candidatura_na_mesma_semana_para_departamento_com_uma_delegacia(self):
        vaga_inicial = self._create_vaga(self.delegacia_unica, '2026-03-23', 'day')
        vaga_segunda = self._create_vaga(self.delegacia_unica, '2026-03-25', 'night')

        equipe_existente = Equipe.objects.create(vaga=vaga_inicial, chefe=self.policial, status='Em Análise')
        equipe_existente.membros.add(self.policial)

        serializer = self._build_serializer(
            self.policial_user,
            {
                'vaga': vaga_segunda.id,
                'chefe': self.policial.id,
                'membros': [self.policial.id],
                'status': 'Em Análise',
            },
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        with self.assertRaises(serializers.ValidationError) as exc:
            serializer.save()

        self.assertIn('só pode se candidatar uma vez por semana', str(exc.exception))

    def test_permite_escala_manual_quando_requisicao_e_de_admin(self):
        vaga_inicial = self._create_vaga(self.delegacia_unica, '2026-03-23', 'day')
        vaga_segunda = self._create_vaga(self.delegacia_unica, '2026-03-26', 'night')

        equipe_existente = Equipe.objects.create(vaga=vaga_inicial, chefe=self.policial, status='Em Análise')
        equipe_existente.membros.add(self.policial)

        serializer = self._build_serializer(
            self.admin_user,
            {
                'vaga': vaga_segunda.id,
                'chefe': self.policial.id,
                'membros': [self.policial.id],
                'status': 'Aprovada',
            },
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        equipe = serializer.save()

        self.assertEqual(equipe.chefe, self.policial)
        self.assertEqual(equipe.membros.count(), 1)

    def test_nao_bloqueia_departamento_com_mais_de_uma_delegacia(self):
        vaga_inicial = self._create_vaga(self.delegacia_multi_a, '2026-03-23', 'day')
        vaga_segunda = self._create_vaga(self.delegacia_multi_b, '2026-03-27', 'night')

        equipe_existente = Equipe.objects.create(vaga=vaga_inicial, chefe=self.policial_multi, status='Em Análise')
        equipe_existente.membros.add(self.policial_multi)

        serializer = self._build_serializer(
            self.policial_multi_user,
            {
                'vaga': vaga_segunda.id,
                'chefe': self.policial_multi.id,
                'membros': [self.policial_multi.id],
                'status': 'Em Análise',
            },
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        equipe = serializer.save()

        self.assertEqual(equipe.membros.count(), 1)

    def test_bloqueia_segunda_candidatura_na_mesma_semana_para_dhpp_mesmo_com_multiplas_delegacias(self):
        vaga_inicial = self._create_vaga(self.delegacia_dhpp_a, '2026-03-23', 'night')
        vaga_segunda = self._create_vaga(self.delegacia_dhpp_b, '2026-03-25', 'night')

        equipe_existente = Equipe.objects.create(vaga=vaga_inicial, chefe=self.policial_dhpp, status='Em Análise')
        equipe_existente.membros.add(self.policial_dhpp)

        serializer = self._build_serializer(
            self.policial_dhpp_user,
            {
                'vaga': vaga_segunda.id,
                'chefe': self.policial_dhpp.id,
                'membros': [self.policial_dhpp.id],
                'status': 'Em Análise',
            },
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        with self.assertRaises(serializers.ValidationError) as exc:
            serializer.save()

        self.assertIn('só pode se candidatar uma vez por semana', str(exc.exception))

    def test_bloqueia_preenchimento_de_vaga_diurna_por_nao_admin(self):
        vaga_diurna = self._create_vaga(self.delegacia_multi_a, '2026-03-23', 'day')

        serializer = self._build_serializer(
            self.policial_multi_user,
            {
                'vaga': vaga_diurna.id,
                'chefe': self.policial_multi.id,
                'membros': [self.policial_multi.id],
                'status': 'Em Análise',
            },
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        with self.assertRaises(serializers.ValidationError) as exc:
            serializer.save()

        self.assertIn('Vagas diurnas de 12 horas só podem ser preenchidas por administrador', str(exc.exception))

    def test_bloqueia_segunda_candidatura_semanal_quando_policial_foi_apenas_chefe(self):
        vaga_dia_16 = self._create_vaga(self.delegacia_dhpp_a, '2026-03-16', 'night')
        vaga_dia_17 = self._create_vaga(self.delegacia_dhpp_b, '2026-03-17', 'night')

        policial_apoio = Policial.objects.create(
            usuario=User.objects.create_user(username='apoio_dhpp', email='apoio.dhpp@example.com'),
            matricula='33445566',
            nome='Policial Apoio DHPP',
            classe='Praça',
            cargo='Policial Civil',
            delegacia=self.delegacia_dhpp_a,
            email='apoio.dhpp.corp@example.com',
        )
        PerfilPolicial.objects.create(policial=policial_apoio, tipo='policial')

        equipe_existente = Equipe.objects.create(vaga=vaga_dia_16, chefe=self.policial_dhpp, status='Em Análise')
        equipe_existente.membros.add(policial_apoio)

        serializer = self._build_serializer(
            self.policial_dhpp_user,
            {
                'vaga': vaga_dia_17.id,
                'chefe': self.policial_dhpp.id,
                'membros': [policial_apoio.id],
                'status': 'Em Análise',
            },
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        with self.assertRaises(serializers.ValidationError) as exc:
            serializer.save()

        self.assertIn('só pode se candidatar uma vez por semana', str(exc.exception))

    def test_permite_preenchimento_de_vaga_diurna_por_admin(self):
        vaga_diurna = self._create_vaga(self.delegacia_multi_a, '2026-03-23', 'day')

        serializer = self._build_serializer(
            self.admin_user,
            {
                'vaga': vaga_diurna.id,
                'chefe': self.policial_multi.id,
                'membros': [self.policial_multi.id],
                'status': 'Aprovada',
            },
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        equipe = serializer.save()

        self.assertEqual(equipe.chefe, self.policial_multi)
        self.assertEqual(equipe.vaga, vaga_diurna)

    def test_bloqueia_segunda_candidatura_quando_policial_esta_apenas_como_chefe(self):
        vaga_inicial = self._create_vaga(self.delegacia_unica, '2026-03-16', 'night')
        vaga_segunda = self._create_vaga(self.delegacia_unica, '2026-03-17', 'night')

        outro_membro = self.policial_multi

        equipe_existente = Equipe.objects.create(vaga=vaga_inicial, chefe=self.policial, status='Em Análise')
        equipe_existente.membros.add(outro_membro)

        serializer = self._build_serializer(
            self.policial_user,
            {
                'vaga': vaga_segunda.id,
                'chefe': self.policial.id,
                'membros': [outro_membro.id],
                'status': 'Em Análise',
            },
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        with self.assertRaises(serializers.ValidationError) as exc:
            serializer.save()

        self.assertIn('só pode se candidatar uma vez por semana', str(exc.exception))