**ÉGIDE  Frontend (React) + Backend (Django)**

Resumo rápido
- Frontend: React (desenvolvimento) disponível em `http://localhost:3001`
- Backend: Django REST API disponível em `http://localhost:8000/api/`
- Banco: SQLite (arquivo em `egide-backend/db.sqlite3`)

Pré-requisitos
- Node.js (versão compatível com Create React App)
- Python 3.11+ e virtualenv (ou venv)
- Dependências instaladas em `egide-backend/venv` e no diretório raiz (`npm install`)

Quick start (desenvolvimento)

1) Instalar dependências frontend

```powershell
npm install
``` 

2) Iniciar frontend (porta 3001)

```powershell
$env:PORT=3001; npm start
```

3) Preparar e iniciar backend

```powershell
cd egide-backend
venv\Scripts\activate
pip install -r requirements.txt
venv\Scripts\python manage.py migrate
venv\Scripts\python manage.py createsuperuser  # opcional
venv\Scripts\python manage.py runserver
```

Variáveis de ambiente
- Frontend: copie `.env.local.example`  `.env.local` (se não existir) e configure:

```
REACT_APP_DJANGO_API_URL=http://localhost:8000/api
```

Pontos importantes sobre integração
- O frontend faz login com Firebase. O backend Django usa JWT (Simple JWT). Atualmente o flow automático para obter o JWT Django após o login Firebase não está implementado.
- O serviço `src/services/djangoApi.js` procura por `localStorage.getItem('django_token')` e envia `Authorization: Bearer <token>` nas requisições se existir.
- Durante desenvolvimento, as permissões do Django podem ser temporariamente configuradas para permitir requisições sem token (`AllowAny`).

Testando o fluxo "Cadastro Rápido"

1. Abra o frontend: `http://localhost:3001`
2. Faça login com sua conta (Firebase)
3. No menu Admin (usuário com `role: 'admin'`), abra **Cadastro Rápido**
4. Teste criar um Departamento (ex.: Sigla `DPC`, Nome `Departamento de Polícia Civil`)
5. Verifique o Django Admin: `http://localhost:8000/admin/` para ver o registro criado

Troubleshooting (erros comuns)

- 401 Unauthorized ao enviar formulários
  - Causa provável: ViewSets definem `permission_classes = [IsAuthenticated]` localmente, ou o frontend não enviou token.
  - Solução temporária: usar `AllowAny` em `egide_backend/settings.py` (somente em dev). Solução correta: implementar o fluxo para obter JWT Django após login Firebase ou autenticar via Django.

- Erros CORS
  - Confirme `CORS_ALLOWED_ORIGINS` em `egide_backend/settings.py` contém `http://localhost:3001` e variantes `127.0.0.1`.

- Página do Django em `http://localhost:8000/` retorna 404
  - Comportamento esperado: o Django expõe somente a API e o admin. Use o frontend React para UI.

Autenticação recomendada (próximo passo)
- Opções:
  1. Após login no Firebase, chamar um endpoint Django `/api/auth/token/` (ou custom) que valide o token Firebase e retorne um JWT Django. Salvar em `localStorage` como `django_token`.
  2. Migrar autenticação do frontend para usar Django (trocar Firebase por Django auth)  refatoração maior.

Recomendações antes de produção
- Reverter `DEFAULT_PERMISSION_CLASSES` para `IsAuthenticated` em `egide_backend/settings.py`.
- Implementar e testar integração segura (Firebase  Django JWT) ou usar apenas Django para autenticação.
- **Purgar `policiais.json`/`policiais_roster.json` do histórico do git** (`git filter-repo` ou BFG + force-push). Decisão consciente em 21/08/2026: adiada por ora (repo privado, só 2 colaboradores), mas deve ser feita antes do lançamento efetivo do sistema — o histórico ainda contém matrícula+nome de 4.398 policiais mesmo após os dados terem sido removidos do código em uso. Avisar todos os colaboradores para re-clonarem após a reescrita.

Admin
- URL: `http://localhost:8000/admin/`
- Crie um superuser com `manage.py createsuperuser` se necessário.

Como contribuir / desenvolvimento
- Para desenvolver componentes frontend, rode `npm start` e edite `src/`.
- Para mudar a API, edite `egide-backend/api/` e reinicie o servidor Django (ele recarrega automaticamente quando encontrar mudanças durante o runserver).

Contato / Observações finais
- Se o `Cadastro Rápido` retornar 401, abra o Console do navegador (F12)  aba Network  encontre a requisição POST e cole o corpo e a resposta aqui para eu ajudar.

---
Atualizado em: 2025-12-08  Instruções para rodar, troubleshooting CORS/401 e notas sobre autenticação
