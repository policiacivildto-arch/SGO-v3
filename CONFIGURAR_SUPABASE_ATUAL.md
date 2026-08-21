# 🔧 CONFIGURAR SEU PROJETO SUPABASE

> ⚠️ **Projeto antigo desativado.** Este guia apontava para o projeto
> `urjluzeuifwjpwfjvkva` (região `us-west-2`, EUA), que está **inativo**
> e não deve ser usado. O projeto atual do SGO-v3 é o `lwunytjedcwcttkujctl`,
> hospedado em São Paulo (`sa-east-1`) — mais adequado para dados
> operacionais da Polícia Civil do Ceará.

## 📍 Seu Projeto:
```
ID: lwunytjedcwcttkujctl
Região: sa-east-1 (São Paulo)
URL: https://supabase.com/dashboard/project/lwunytjedcwcttkujctl
```

---

## 📋 PASSO 1: Obter DATABASE_URL

1. **Acesse seu projeto Supabase**
   - https://supabase.com/dashboard/project/lwunytjedcwcttkujctl

2. **Vá para Settings (⚙️)**
   - Menu esquerdo → **Settings**

3. **Clique em Database**
   - Você verá: `Connection pooling` e `Direct connection`

4. **Escolha: Connection pooling (Transaction mode)**
   - Modo: **Transaction**
   - Copy a URL que aparece

5. **Você verá duas formas de conectar — use o pooler nas duas, não a "Direct connection" pura:**

   **Pooler, modo transação (porta 6543) — para a aplicação em runtime:**
   ```
   postgresql://postgres.lwunytjedcwcttkujctl:[SENHA]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
   ```

   **Pooler, modo sessão (porta 5432) — para rodar `migrate`:**
   ```
   postgresql://postgres.lwunytjedcwcttkujctl:[SENHA]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
   ```

   ⚠️ **Substitua `[SENHA]` pela senha do seu banco!**
   ⚠️ **Confira o host exato em Settings → Database no dashboard** —
   o padrão `aws-0-sa-east-1.pooler.supabase.com` é o esperado para a
   região São Paulo, mas o Supabase pode ajustar isso por projeto.
   ⚠️ **Não use a "Direct connection" pura** (`db.lwunytjedcwcttkujctl.supabase.co`,
   sem passar pelo pooler) — esse host só resolve em IPv6, e nem todo
   ambiente (Codespaces, VPS, esta própria sessão do Claude Code) tem
   saída IPv6. Testado em 21/08/2026: essa sessão do Claude Code não
   conseguiu nem resolver a conexão direta (sem IPv6) nem alcançar o
   pooler nas portas 5432/6543 — a sandbox só libera saída HTTPS. Um
   Codespace ou VPS normal deve conseguir se conectar no pooler sem
   esse problema.

---

## 🔐 ENCONTRAR A SENHA

1. Na mesma página de **Settings > Database**
2. Procure por **Database Password**
3. Clique em **Reset password** se não souber
4. Copie a senha

---

## 📝 COPIAR ESSAS INFORMAÇÕES:

**Você precisará para o Render/Railway/Codespaces:**

```
# URL com pooling - para a aplicação rodar
DATABASE_URL=postgresql://postgres.lwunytjedcwcttkujctl:[SENHA]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true

# URL direta - para executar migrações
DIRECT_URL=postgresql://postgres.lwunytjedcwcttkujctl:[SENHA]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres

SECRET_KEY=[Gere em https://djecrety.ir/]

DEBUG=False

ALLOWED_HOSTS=.onrender.com
```

**📌 Importante:**
- `DATABASE_URL` usa porta **6543**, pooler em modo transação (melhor performance para a aplicação)
- `DIRECT_URL` usa porta **5432**, pooler em modo sessão (necessária para `python manage.py migrate`) — apesar do nome, não é a conexão direta pura (ver aviso acima sobre IPv6)
- **Nunca** commite esses valores no repositório — configure-os como
  variável/secret do ambiente de deploy (Render, Railway, Codespaces
  Secrets etc.), nunca em um arquivo versionado.

---

## 🖥️ RODAR AS MIGRATIONS A PARTIR DO CODESPACES (ou VPS)

Pendência em aberto em 21/08/2026: as tabelas do Django ainda não foram
criadas no Postgres do Supabase — só existem localmente (SQLite). Assim
que o Codespace (ou VPS) estiver no ar, rode isto uma vez para criar o
schema real:

1. **Configure os secrets do ambiente** (Codespaces: repositório →
   Settings → Secrets and variables → Codespaces; VPS: variável de
   ambiente do processo):
   ```
   DATABASE_URL=postgresql://postgres.lwunytjedcwcttkujctl:[SENHA]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
   USE_REMOTE_DB_IN_DEBUG=True
   ```
   O `USE_REMOTE_DB_IN_DEBUG=True` é necessário porque em desenvolvimento
   (`DEBUG=True`, o padrão) o Django ignora `DATABASE_URL` e usa SQLite
   local a menos que essa flag esteja ligada — ver `egide_backend/settings.py`.

2. **Rode as migrations:**
   ```bash
   cd egide-backend
   pip install -r requirements.txt
   python manage.py migrate
   ```

3. **(Opcional) Popule o autocompletar de matrícula**, apontando para um
   JSON com os dados do efetivo mantido **fora do git** (nunca comite
   esse arquivo — ver `.gitignore`):
   ```bash
   python manage.py seed_roster --path /caminho/local/policiais.json
   ```

4. **Crie um superusuário** para acessar `/admin/`:
   ```bash
   python manage.py createsuperuser
   ```

5. **Confirme:** `GET /api/` deve responder, e `django_migrations` deve
   ter ~35 linhas (`python manage.py showmigrations`).

---

## 🚀 PRÓXIMO: FAZER DEPLOY NO RENDER

1. **Crie repositório Git** (se não tiver)
   ```powershell
   git init
   git add .
   git commit -m "Pronto para deploy"
   git remote add origin https://github.com/SEU-USUARIO/egide-app.git
   git push -u origin main
   ```

2. **Vá para https://render.com**
   - Login com GitHub

3. **Create New +** → **Web Service**
   - Conecte seu repositório `egide-app`
   - Root Directory: `egide-backend`
   - Build Command: `./build.sh`
   - Start Command: `gunicorn egide_backend.wsgi:application`

4. **Adicione Environment Variables:**
   ```
   DATABASE_URL = postgresql://postgres.lwunytjedcwcttkujctl:[SENHA]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
   DIRECT_URL = postgresql://postgres.lwunytjedcwcttkujctl:[SENHA]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
   SECRET_KEY = [Gere em https://djecrety.ir/]
   DEBUG = False
   ALLOWED_HOSTS = .onrender.com
   ```

5. **Deploy!**

---

## ✅ VERIFICAR SE FUNCIONOU

Após 5 minutos:

1. Acesse: `https://egide-backend.onrender.com/api/`
2. Você verá a API do Django funcionando
3. Admin em: `https://egide-backend.onrender.com/admin/`

---

## 🆘 PROBLEMAS?

### Erro: "relation does not exist"
```powershell
# No Shell do Render, execute:
python manage.py migrate
```

### Erro: "CORS policy"
```
Adicione em CORS_ALLOWED_ORIGINS no Render:
CORS_ALLOWED_ORIGINS=https://seu-frontend.com
```

### Tudo OK? Crie superusuário:
```bash
# No Shell do Render:
python manage.py createsuperuser
```

---

**Status**: 🎯 Pronto para conectar Supabase + Render
