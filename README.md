# CSV Processing SaaS — README (versão 1.0)

**Status:** v1.0 — Lançamento inicial

---

## Visão geral

Aplicação web para processamento de arquivos CSV: upload, validação, pré-processamento, execução de jobs de transformação/análise e download do resultado. Pensada como um *SaaS* simples (prova de conceito / MVP) com frontend em **Next.js** e backend em **FastAPI**, suporte a jobs de processamento em background e armazenamento local ou S3.

---

## Funcionalidades principais

* Upload de arquivos CSV via UI e API
* Validação de formato e esquema (colunas obrigatórias, tipos básicos)
* Pipeline de pré-processamento (limpeza, normalização, remoção de duplicatas)
* Execução de jobs assíncronos (fila) com status (pendente, em andamento, concluído, falha)
* Download do resultado processado (CSV/ZIP)
* Histórico mínimo de jobs por usuário (MVP)
* Healthcheck e logs básicos

---

## Stack tecnológicos (sugestão / implementação típica)

* Frontend: **Next.js** (React) + Tailwind + TypeScript (ou JavaScript)
* Backend: **FastAPI** (Python 3.10+) com **Uvicorn**
* Fila (opcional para produção): **Redis** + **Celery** ou **RQ**
* Banco (opcional): **PostgreSQL** (ou SQLite para desenvolvimento)
* Armazenamento: sistema de arquivos local (dev) ou **Amazon S3** (produção)
* Containerização: Docker & Docker Compose

---

## Pré-requisitos

* Node.js (v16+ / v18+ recomendado)
* pnpm ou npm
* Python 3.10+
* pip (ou poetry/poetry)
* (opcional) Docker, Docker Compose
* (opcional) Redis, PostgreSQL para execução completa

---

## Estrutura sugerida do repositório

```
/ (repo root)
├─ backend/                # FastAPI app
│  ├─ app/
│  │  ├─ main.py
│  │  ├─ api/
│  │  ├─ services/
│  │  └─ workers/
│  ├─ requirements.txt
│  └─ Dockerfile
├─ frontend/               # Next.js app
│  ├─ package.json
│  └─ src/
├─ docker-compose.yml
└─ README_v1.0.md
```

> Ajuste conforme seu layout real (seu projeto pode ter `src/` na raiz — adeque comandos abaixo ao caminho correto).

---

## Variáveis de ambiente (exemplos)

Configure as variáveis necessárias no backend (arquivo `.env`):

```
# Backend
APP_ENV=development
SECRET_KEY=uma_senha_segura
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname  # opcional
STORAGE_TYPE=local   # local | s3
STORAGE_PATH=./storage
AWS_S3_BUCKET=meu-bucket
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
REDIS_URL=redis://localhost:6379/0   # se usar fila
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
```

No frontend, variáveis públicas (ex: NEXT_PUBLIC_API_BASE_URL):

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api
```

---

## Instalação e execução (desenvolvimento)

### Backend (FastAPI)

1. Entre na pasta do backend:

```bash
cd backend
```

2. Crie e ative um ambiente virtual:

```bash
python -m venv .venv
source .venv/bin/activate  # macOS / Linux
.venv\Scripts\activate     # Windows PowerShell
```

3. Instale dependências:

```bash
pip install -r requirements.txt
```

4. Execute a aplicação (Uvicorn):

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

A API ficará disponível em `http://localhost:8000` e a documentação automática em `http://localhost:8000/docs` (Swagger) ou `/redoc`.

Se usar Celery para jobs em background, rode também o worker:

```bash
celery -A app.workers.celery_app worker --loglevel=info
```

### Frontend (Next.js)

1. Entre na pasta do frontend:

```bash
cd frontend
```

2. Instale dependências e rode em modo dev:

```bash
# com pnpm
pnpm install
pnpm dev

# ou com npm
npm install
npm run dev
```

A UI estará em `http://localhost:3000`.

---

## Execução via Docker (exemplo rápido)

Um `docker-compose.yml` básico pode orquestrar backend, frontend, Redis e Postgres. Exemplo de comando:

```bash
# na raiz do repo
docker compose up --build
```

Ajuste serviços, volumes e variáveis conforme necessidade.

---

## API (endpoints principais - exemplos)

* `POST /api/upload` — upload do CSV (multipart/form-data)
* `POST /api/jobs` — criar job de processamento (referenciando arquivo upload)
* `GET /api/jobs/{job_id}` — status e logs do job
* `GET /api/download/{file_id}` — download do resultado
* `GET /health` — healthcheck

### Exemplo rápido (curl)

```bash
# upload
curl -F "file=@meuarquivo.csv" http://localhost:8000/api/upload

# criar job (JSON com parâmetros do pipeline)
curl -X POST -H "Content-Type: application/json" -d '{"file_id":"<id>", "pipeline": ["clean","normalize"]}' http://localhost:8000/api/jobs

# checar status
curl http://localhost:8000/api/jobs/<job_id>
```

---

## Testes

* Backend: `pytest` (adicionar testes unitários e de integração)
* Frontend: testar componentes com `Jest` + `React Testing Library` (opcional)

Exemplo (backend):

```bash
cd backend
pytest
```

---

## Logs e observabilidade

* Para desenvolvimento, use logs no console (`uvicorn` e `celery`) e arquivos de log rotacionados.
* Em produção, envie logs para um agregador (Elastic, Datadog, Loggly) e use metrics (Prometheus + Grafana) se possível.

---

## Segurança

* Não exponha secrets no repositório. Use arquivos `.env` locais e variáveis de ambiente no deploy.
* Valide esquema/colunas e limites de tamanho do arquivo para evitar DoS.
* Considere autenticação (JWT / OAuth) se houver usuários.

---

## Limitações conhecidas (v1.0)

* Autenticação e controle de acesso mínimos ou inexistentes
* Escalabilidade limitada (fila + storage precisam ser configurados para produção)
* Padronização de esquemas CSV depende de configuração manual

---

## Roadmap (próximos passos sugeridos)

* Autenticação por conta de usuário + planos por assinatura
* Upload em chunk para arquivos grandes
* Integração com S3 e limpeza automática de arquivos antigos
* Dashboard com histórico e métricas de uso
* Webhooks / callbacks quando job finalizar

---

## Como contribuir

1. Fork do repositório
2. Crie branch `feature/my-feature`
3. Faça commits atômicos e descriptivos
4. Abra PR descrevendo a mudança

---

## Licença

MIT — veja o arquivo `LICENSE`.

---

## Contato

Para dúvidas ou suporte: `seu-email@exemplo.com` (substitua pelo contato real do projeto).

---

## Changelog (v1.0)

* Versão inicial (MVP) — upload, validação, processamento em background e download de resultados.

---

> *Observação:* este README foi criado como **versão 1.0** genérica para um app de processamento de CSV com Next.js (frontend) e FastAPI (backend). Se seu projeto tiver uma estrutura ou stack diferente (por exemplo Django, SQLite, ou sem fila), me diga que eu adapto o README para ser exato ao seu repositório.
