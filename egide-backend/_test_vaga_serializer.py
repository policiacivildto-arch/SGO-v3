#!/usr/bin/env python
"""Script para testar VagaSerializer"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'egide_backend.settings')
django.setup()

from api.serializers import VagaSerializer
from api.models import Delegacia, Vaga
from datetime import date

delegacia = Delegacia.objects.first()
print(f"✅ Delegacia: {delegacia}")

# Primeiro limpa vagas de teste existentes
Vaga.objects.filter(data=date(2026, 2, 16), delegacia=delegacia).delete()
print(f"🗑️  Vagas de teste limpas")

# Testa criação de vaga
data_vaga = {
    'data': date(2026, 2, 16),
    'turno': 'day',
    'delegacia': delegacia.id,
    'posicoes_disponiveis': 1,
    'status': 'Disponível',
    'descricao': 'Teste'
}
print(f"\n📝 Testando com dados: {data_vaga}")

serializer = VagaSerializer(data=data_vaga)
print(f"Valid: {serializer.is_valid()}")

if not serializer.is_valid():
    print(f"❌ Erros de validação:")
    for field, errors in serializer.errors.items():
        print(f"   {field}: {errors}")
else:
    vaga = serializer.save()
    print(f"✅ Vaga criada com sucesso: {vaga}")
    
    # Tenta criar duplicada
    print(f"\n📝 Testando duplicata...")
    serializer2 = VagaSerializer(data=data_vaga)
    print(f"Valid: {serializer2.is_valid()}")
    if not serializer2.is_valid():
        print(f"✅ Erro detectado corretamente:")
        for field, errors in serializer2.errors.items():
            print(f"   {field}: {errors}")
