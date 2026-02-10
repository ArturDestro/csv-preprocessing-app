# CSV Processing App — README (versão 1.0)

**Status:** v1.1

---

## Visão geral

Este repositório contém **frontend e backend** de um processador de arquivos CSV.

* **Frontend**: aplicação web (Next.js / React) responsável por upload do CSV, acompanhamento do status do job e download do resultado.
* **Backend**: API em FastAPI que recebe uploads, cria *jobs*, enfileira no Redis e processa os CSVs via um worker dedicado.

Fluxo geral:

1. Usuário faz upload do CSV pela interface web.
2. Frontend chama a API (`/upload`) e recebe um `job_id`.
3. Backend enfileira o job no Redis.
4. Worker consome a fila, executa o pipeline de processamento e gera `output.csv`.
5. Frontend consulta o status e libera o download quando o job finaliza.

Código relevante:

* Frontend: `src/frontend/`
* Backend: `src/backend/` (arquivos principais: `main.py`, `worker.py`, `job_utils.py`, `engine/`).

---

## Estrutura

**Frontend (Next.js)**

O frontend está em `src/frontend/`. Observações gerais (baseadas na estrutura enviada):

* Stack: **Next.js (React)** — o projeto roda como uma app Next.
* Funções principais da UI: upload de CSV, acompanhamento do status do job (polling ou WebSocket) e download do `output.csv` quando o job terminar.
* Configuração/API: o frontend deve apontar para o backend — verifique `NEXT_PUBLIC_API_BASE_URL` ou uso de proxies (`next.config.js`). As chamadas esperadas ao backend são:

  * `POST /upload` para enviar o CSV (multipart/form-data)
  * `GET /jobs/{job_id}` para checar status
  * `GET /download_csv/{job_id}` para baixar o resultado
* Arquivos estáticos: verifique `public/` para assets, e `src/` (ou `pages/`, `app/`) para as rotas/páginas do front.

**Como rodar o frontend (dev)**

```bash
cd src/csv-preprocessing-app
# instalar dependências
pnpm install   # ou npm install
# rodar em dev
pnpm dev       # ou npm run dev
```

A UI normalmente ficará disponível em `http://localhost:3000`.

---

```
src/backend/
├─ main.py           # FastAPI - endpoints
├─ worker.py         # loop do worker (redis.blpop) + process_csv
├─ job_utils.py      # util para criar pasta de job
├─ jobs/             # exemplo/artefatos de jobs (input.csv / output.csv)
└─ engine/           # pipeline e componentes (Loader, Scaler, Encoder, ...)
```

> Observação: o repositório que você enviou contém um diretório `.venv/` dentro de `src/backend/`. Recomendo remover o virtualenv do repositório (adicionar no `.gitignore`) e manter apenas um `requirements.txt` ou `pyproject.toml`.

---

## Dependências (apontamento prático)

O código usa (observado nos imports):

* `fastapi` (API)
* `uvicorn` (server ASGI)
* `redis` (cliente Redis)
* `rq` (importado em `main.py`, mas note: o enfileiramento atual usa `redis_conn.rpush` e o worker usa `blpop` — `rq` não é realmente necessário a menos que você opte por usar a biblioteca RQ)
* `pandas`, `numpy` (manipulação de CSV / tabelas)
* `chardet` (detecção de encoding)

Exemplo rápido para instalar (sugestão):

```bash
python -m venv .venv
source .venv/bin/activate       # ou .venv\Scripts\activate no Windows
pip install fastapi uvicorn redis rq pandas numpy chardet
```
---

## Como rodar (modo desenvolvimento)

1. Abra um terminal e vá para a pasta do backend:

```bash
cd src/backend
```

2. Crie e ative o venv e instale dependências (veja seção anterior).

3. Rode o servidor FastAPI (API):

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

> Observação: `main.py` importa `job_utils` e lê/escreve em `jobs/<job_id>/`, por isso execute o comando a partir de `src/backend`.

4. Rode o worker (consumidor da fila):

```bash
python worker.py
```

O `worker.py` faz um `blpop` na lista Redis chamada `csv_jobs` e chama `process_csv(job_id)`.

5. Certifique-se de ter uma instância Redis rodando em `localhost:6379` (config hard-coded no código).

---

## Endpoints da API (implementados)

* `GET /ping` — simples healthcheck retornando `{"message":"pong"}`.
* `POST /upload` — recebe multipart/form-data com campo `file` (o CSV).

  * Cria `jobs/<job_id>/` e grava `input.csv` lá.
  * Define `job:{job_id}:status` = `queued` no Redis e faz `rpush(QUEUE, json(job))` para enfileirar.
  * Retorna `{"job_id": "<uuid>", "status": "queued"}`.
* `GET /jobs/{job_id}` — retorna o status (`queued`, `processing`, `finished`, etc.) lido em `job:{job_id}:status` no Redis.
* `GET /download_csv/{job_id}` — baixa `jobs/<job_id>/output.csv` se o status for `finished`.

### Exemplo (curl)

```bash
# upload
curl -F "file=@meuarquivo.csv" http://localhost:8000/upload

# checar status
curl http://localhost:8000/jobs/<job_id>

# baixar resultado (quando status == finished)
curl -O http://localhost:8000/download_csv/<job_id>
```

---

## Engine (onde acontece o processamento)

Local: `src/backend/engine/`

Principais componentes:

* `TypeCaster` (TypeCaster) — Implementa Conversor de Tipos 
* `Loader` (CSVLoader) — lê CSV, detecta separador e encoding quando não fornecidos (usa `chardet`).
* `Scaler` — implementa `standard`, `minmax`, `robust`, `constant` (fit / transform sobre colunas selecionadas).
*  `Cleaner` — implementa `mean`, `mode`, `median`, `duplicates` (fit / transform sobre colunas selecionadas).
* `Encoder` — `onehot`, `ordinal`, `label`.
* `Pipeline` — recebe um `config` dict com ordem (`order`) e opções por etapa; aplica loader -> cleaners -> encoders -> scalers -> etc. e retorna um `DataFrame` final.

---

## Changelog (v1.0)

### v1.0
- Primeira versão funcional do app
- Upload de arquivos CSV pelo frontend
- Processamento assíncrono via backend
- Download do CSV processado

### v1.1 (10/02/2026)
- Funcionalidade: Remover duplicatas
- Funcionalidade: Conversor de Tipos
- Funcionalidade: Preencher valores ausentes por constante
- Otimizações de código
---

