# CSV Preprocessor — README

**Status:** v1.2

---

## Visão geral

Este repositório contém o **frontend** e o **backend** de um processador de arquivos CSV com interface visual para construção de pipelines de pré-processamento de dados.

- **Frontend:** aplicação web em Next.js/React para upload de CSV, montagem visual do pipeline, prévia dos dados, visualização de gráficos e download do resultado.
- **Backend:** API em FastAPI que recebe arquivos, cria *jobs*, persiste configurações, enfileira processamento via Redis e executa o pipeline em um worker dedicado.

Fluxo geral:

1. Usuário faz upload do CSV pela interface web.
2. Frontend chama `POST /upload` e recebe um `job_id`.
3. Usuário monta o pipeline visualmente (etapas, estratégias, colunas).
4. Frontend chama `POST /run_pipeline/{job_id}` com a configuração serializada.
5. Backend salva o `config.json` do job e enfileira no Redis.
6. Worker consome a fila, executa o pipeline e gera `output.csv`.
7. Frontend exibe gráficos via `POST /generate_chart` e libera o download via `GET /download_csv/{job_id}`.

---

## Estrutura do projeto

```
src/
├── backend/
│   ├── main.py           # FastAPI — endpoints da API
│   ├── worker.py         # Worker Redis (blpop + process_csv)
│   ├── job_utils.py      # Utilitários de criação de diretórios de job
│   ├── jobs/             # Artefatos por job (input.csv, config.json, output.csv)
│   ├── requirements.txt
│   ├── Dockerfile
│   └── engine/
│       ├── pipeline.py
│       ├── Loader/       # csv_loader.py, loaderFactory.py
│       ├── Cleaner/      # cleaner.py (5 estratégias), cleanerFactory.py
│       ├── TypeCaster/   # TypeCaster.py, typecasterFactory.py
│       ├── Encoder/      # encoder.py (OneHot, Label, Ordinal), encoderFactory.py
│       └── Scaler/       # scaler.py (Standard, MinMax, Robust), scalerFactory.py
└── frontend/
    ├── app/
    │   ├── page.tsx      # Página principal (Upload → Preview → Pipeline/Charts)
    │   └── layout.tsx
    ├── components/
    │   ├── csv-uploader.tsx       # Drag-and-drop upload
    │   ├── csv-preview.tsx        # Prévia e seleção de colunas
    │   ├── pipeline-panel.tsx     # Builder visual do pipeline
    │   ├── pipeline-block-card.tsx # Card por step (toggle + config)
    │   └── chart-panel.tsx        # Painel de gráficos Plotly
    ├── lib/
    │   ├── pipeline-types.ts      # Tipos e defaults do pipeline
    │   └── utils.ts
    ├── Dockerfile
    └── next.config.mjs
```

> **Atenção:** o diretório `.venv/` está dentro de `src/backend/` no repositório. Adicione-o ao `.gitignore` e mantenha apenas o `requirements.txt`.

---

## Tech stack

| Camada | Tecnologias |
|---|---|
| Frontend | Next.js 14, React, TypeScript, Tailwind CSS, shadcn/ui, Plotly |
| Backend | Python 3.11, FastAPI, Uvicorn |
| Fila | Redis, RQ (blpop manual) |
| Engine | pandas, numpy, chardet |
| Infra | Docker (Dockerfile no backend e no frontend) |

---

## Como rodar (desenvolvimento)

### Pré-requisitos

- Python 3.10+
- Node.js 18+ / pnpm
- Redis rodando em `localhost:6379`

### Backend

```bash
cd src/backend

# Criar e ativar virtualenv
python -m venv .venv
source .venv/bin/activate       # Linux/macOS
.venv\Scripts\activate          # Windows

# Instalar dependências
pip install -r requirements.txt

# Subir o Redis (via Docker)
docker run -p 6379:6379 redis

# Rodar a API
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Em outro terminal: rodar o worker
python worker.py
```

API disponível em `http://localhost:8000`  
Swagger UI em `http://localhost:8000/docs`

### Frontend

```bash
cd src/frontend

# Instalar dependências
pnpm install    # ou npm install

# Configurar a URL do backend
echo "NEXT_PUBLIC_API_BASE=http://localhost:8000" > .env.local

# Rodar em modo dev
pnpm dev        # ou npm run dev
```

UI disponível em `http://localhost:3000`

---

## Endpoints da API

### `GET /ping`
Health check. Retorna `{"message": "pong"}`.

### `POST /upload`
Recebe um CSV via `multipart/form-data` (campo `file`).

- Cria `jobs/<job_id>/` e grava `input.csv`.
- Define `job:{job_id}:status = uploaded` no Redis.
- Retorna `{"job_id": "<uuid>", "status": "uploaded"}`.

### `POST /run_pipeline/{job_id}`
Recebe a configuração do pipeline como JSON no body.

- Salva `config.json` no diretório do job.
- Enfileira o job na lista Redis `csv_jobs`.
- Define `job:{job_id}:status = queued`.
- Retorna `{"job_id": "<uuid>", "status": "queued"}`.

Exemplo de payload:

```json
{
  "order": ["loader", "cleaner", "encoder", "scaler"],
  "loader": { "type": "csv", "separator": "," },
  "cleaner": { "type": "mean", "remove_duplicates": true, "columns": ["age", "salary"] },
  "encoder": { "type": "onehot", "columns": ["gender"] },
  "scaler":  { "type": "standard", "columns": ["age", "salary"] }
}
```

### `GET /jobs/{job_id}`
Retorna o status atual do job. Se houver falha, inclui o campo `error` com o conteúdo de `error.txt`.

```json
{ "job_id": "...", "status": "finished" }
{ "job_id": "...", "status": "failed", "error": "..." }
```

Status possíveis: `uploaded` → `queued` → `processing` → `finished` / `failed`.

### `POST /generate_chart`
Recebe `job_id` e `chart` (tipo, eixo x, eixo y) e retorna dados no formato Plotly.

```json
{
  "job_id": "...",
  "chart": { "type": "scatter", "x": "age", "y": "salary" }
}
```

### `GET /download_csv/{job_id}`
Baixa o `output.csv` processado. Retorna 409 se o job não estiver com status `finished`.

### Exemplo via curl

```bash
# 1. Upload
curl -F "file=@dados.csv" http://localhost:8000/upload

# 2. Rodar pipeline
curl -X POST http://localhost:8000/run_pipeline/<job_id> \
  -H "Content-Type: application/json" \
  -d '{"order":["loader","scaler"],"scaler":{"type":"minmax","columns":["price"]}}'

# 3. Checar status
curl http://localhost:8000/jobs/<job_id>

# 4. Baixar resultado
curl -O http://localhost:8000/download_csv/<job_id>
```

---

## Engine — referência de configuração

### Loader

```json
{ "type": "csv", "separator": "," }
```

### Cleaner

```json
{
  "type": "mean",          // "mean" | "median" | "mode" | "constant"
  "remove_duplicates": true,
  "columns": ["col1", "col2"],
  "value": 0               // apenas para type "constant"
}
```

### TypeCaster

```json
{
  "schema": {
    "age": "int",
    "score": "float",
    "active": "bool"
  }
}
```

Tipos suportados: `int`, `float`, `string`, `bool`, `datetime`.

### Encoder

```json
{
  "type": "onehot",        // "onehot" | "label" | "ordinal"
  "columns": ["gender"],
  "mapping": {             // apenas para type "ordinal"
    "size": { "S": 0, "M": 1, "L": 2 }
  }
}
```

### Scaler

```json
{
  "type": "standard",      // "standard" | "minmax" | "robust"
  "columns": ["age", "salary"]
}
```

---

## Changelog

### v1.2

- Exportação do CSV processado
- Exportação do pipeline em JSON
- Adição de um switch que possibilita ver preview do CSV processado

### v1.1

- Frontend completo em Next.js com upload drag-and-drop, prévia de colunas e pipeline builder visual.
- Painel de gráficos integrado (Plotly) com seleção de eixos.
- Separação entre upload (`POST /upload`) e execução do pipeline (`POST /run_pipeline/{job_id}`).
- Novo endpoint `POST /generate_chart`.
- Novo step **TypeCaster** no pipeline.
- **Cleaner** agora suporta cinco estratégias: `duplicate`, `constant`, `mode`, `mean`, `median`.
- **Encoder** adiciona `LabelEncoder` e `OrdinalEncoder`.
- **Scaler** adiciona `RobustScaler`.
- Status de erro com detalhes do traceback via `error.txt` no diretório do job.

### v1.0

- Primeira versão funcional do app.
- Upload de arquivos CSV pelo frontend.
- Processamento assíncrono via backend (Redis + RQ).
- Download do CSV processado.
