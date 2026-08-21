#!/usr/bin/env python
"""
Script para testar a validação da vaga restrita de terça-feira.

Testa:
1. Usuário NORMAL criando equipe em vaga ABERTA → DEVE FUNCIONAR
2. Usuário NORMAL criando equipe em vaga RESTRITA → DEVE FALHAR
3. Usuário ADMIN criando equipe em vaga RESTRITA → DEVE FUNCIONAR
"""

import os
import sys
import django
from datetime import date

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'egide_backend.settings')
django.setup()

from django.contrib.auth.models import User
from api.models import Vaga, Delegacia, Policial, Equipe
from api.serializers import EquipeSerializer
from rest_framework.test import APIRequestFactory
from unittest.mock import Mock

print("\n" + "="*60)
print("🧪 TESTE: Validação de Vagas Restritas em Terça-feira")
print("="*60)

# 1. Preparar dados
delegacia = Delegacia.objects.filter(ativo=True).first()
terça = date(2026, 5, 5)

# Buscar vagas criadas
vaga_aberta = Vaga.objects.filter(
    data=terça, turno='day', restrito_adm_cadastra=False
).first()
vaga_restrita = Vaga.objects.filter(
    data=terça, turno='day', restrito_adm_cadastra=True
).first()

if not vaga_aberta or not vaga_restrita:
    print("❌ Vagas não encontradas! Execute criar_vagas_terca.py primeiro.")
    sys.exit(1)

print(f"\n📋 Dados preparados:")
print(f"   Delegacia: {delegacia.nome}")
print(f"   Data: {terça} (terça-feira)")
print(f"   Vaga Aberta: {vaga_aberta.id} (7 posições)")
print(f"   Vaga Restrita: {vaga_restrita.id} (1 posição)")

# 2. Criar usuários de teste

policial_user, _ = User.objects.get_or_create(
    username='policial_teste_123',
    defaults={
        'email': 'policial_teste_123@test.local',
        'first_name': 'Policial',
        'is_active': True,
        'is_staff': False,
    }
)

admin_user, _ = User.objects.get_or_create(
    username='admin_teste_456',
    defaults={
        'email': 'admin_teste_456@test.local',
        'first_name': 'Admin',
        'is_active': True,
        'is_staff': True,
    }
)
# Certificar que existem dados de policial
# Tentar buscar um policial existente, ou criar um novo
policial = Policial.objects.filter(usuario=policial_user).first()
if not policial:
    policial = Policial.objects.create(
        usuario=policial_user,
        matricula='11111111',
        nome='Policial Teste',
        classe='Praça',
        cargo='Policial Civil',
        delegacia=delegacia,
        email='policial_teste_123@test.local',
    )

admin_policial = Policial.objects.filter(usuario=admin_user).first()
if not admin_policial:
    admin_policial = Policial.objects.create(
        usuario=admin_user,
        matricula='22222222',
        nome='Admin Teste',
        classe='Delegado',
        cargo='Delegado',
        delegacia=delegacia,
        email='admin_teste_456@test.local',
    )

print(f"\n👥 Usuários preparados:")
print(f"   Policial: {policial.nome} (is_staff={policial_user.is_staff})")
print(f"   Admin: {admin_policial.nome} (is_staff={admin_user.is_staff})")

# Helper para criar request
factory = APIRequestFactory()

def test_equipe_creation(user, vaga, descricao):
    """Testa criação de equipe com um usuário específico"""
    request = factory.post('/equipes/')
    request.user = user
    
    data = {
        'vaga': vaga.id,
        'membros': [policial.id],
        'chefe': policial.id,
        'viatura': None,
        'status': 'Em Análise',
    }
    
    serializer = EquipeSerializer(data=data, context={'request': request})
    
    print(f"\n   {descricao}")
    print(f"   └─ Usuário: {user.get_full_name()} (staff={user.is_staff})")
    print(f"   └─ Vaga: {'Aberta' if not vaga.restrito_adm_cadastra else 'Restrita'}")
    
    if serializer.is_valid():
        print(f"   ✅ SUCESSO - Equipe criada!")
        equipe = serializer.save()
        return True, equipe
    else:
        erros = serializer.errors
        if 'non_field_errors' in erros:
            print(f"   ❌ FALHOU - {erros['non_field_errors'][0]}")
        else:
            print(f"   ❌ FALHOU - Erros: {erros}")
        return False, None

# 3. TESTE 1: Policial em vaga ABERTA
print("\n" + "─"*60)
print("📝 TESTE 1: Policial criando equipe em vaga ABERTA")
print("─"*60)
sucesso1, equipe1 = test_equipe_creation(
    policial_user, 
    vaga_aberta,
    "Policial normal tentando se candidatar a vaga aberta (7 posições)"
)

# 4. TESTE 2: Policial em vaga RESTRITA
print("\n" + "─"*60)
print("📝 TESTE 2: Policial criando equipe em vaga RESTRITA")
print("─"*60)
sucesso2, equipe2 = test_equipe_creation(
    policial_user,
    vaga_restrita,
    "Policial normal tentando se candidatar a vaga restrita (ADM only)"
)

# 5. TESTE 3: Admin em vaga RESTRITA
print("\n" + "─"*60)
print("📝 TESTE 3: Admin criando equipe em vaga RESTRITA")
print("─"*60)
sucesso3, equipe3 = test_equipe_creation(
    admin_user,
    vaga_restrita,
    "Admin tentando cadastrar equipe na vaga restrita"
)

# 6. Resumo
print("\n" + "="*60)
print("📊 RESUMO DOS TESTES")
print("="*60)

resultados = [
    ("Policial → Vaga ABERTA", sucesso1, True),
    ("Policial → Vaga RESTRITA", sucesso2, False),
    ("Admin → Vaga RESTRITA", sucesso3, True),
]

todos_ok = True
for teste, resultado, esperado in resultados:
    status = "✅" if resultado == esperado else "❌"
    esperado_txt = "SUCESSO" if esperado else "FALHA"
    resultado_txt = "SUCESSO" if resultado else "FALHA"
    todos_ok = todos_ok and (resultado == esperado)
    print(f"{status} {teste}")
    print(f"   Esperado: {esperado_txt} | Obtido: {resultado_txt}")

print("="*60)
if todos_ok:
    print("✅ TODOS OS TESTES PASSARAM!")
else:
    print("❌ ALGUNS TESTES FALHARAM!")
print("="*60 + "\n")

sys.exit(0 if todos_ok else 1)
