#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'egide_backend.settings')
django.setup()

from django.contrib.auth import authenticate

# Testa o login
username = 'front'
password = 'front'

print(f'\n🔐 Testando login...')
print(f'   Username: {username}')
print(f'   Senha: {password}\n')

user = authenticate(username=username, password=password)

if user:
    print(f'✅ Login SUCESSO!')
    print(f'   User: {user.username}')
    print(f'   Email: {user.email}')
    print(f'   Ativo: {user.is_active}')
else:
    print(f'❌ Login FALHOU!')
    print(f'   Credenciais inválidas')
    
    # Tenta resetar a senha
    from django.contrib.auth import get_user_model
    User = get_user_model()
    try:
        user = User.objects.get(username=username)
        user.set_password(password)
        user.save()
        print(f'\n🔄 Senha resetada! Testando novamente...')
        
        user = authenticate(username=username, password=password)
        if user:
            print(f'✅ Login SUCESSO após reset!')
        else:
            print(f'❌ Login ainda falhou')
    except User.DoesNotExist:
        print(f'❌ Usuário não existe')
