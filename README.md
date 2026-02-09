# CSV Processing App — README (versão 1.0)

**Status:** v1.0

---

## Visão geral (curto e direto)

Este repositório contém o **backend** de um processador de CSVs em Python. Não há frontend incluído. O serviço principal oferece:

* endpoint para **upload** de um CSV e criação de um *job*;
* enfileiramento do job em **Redis**;
* um **worker** que consome a fila (blpop) e processa o CSV usando a *engine* interna;
* pipeline modular (Loader, Scaler, Encoder, Cleaner, etc.) que lê `input.csv` e grava `output.csv` na pasta do job.

Código relevante: `src/backend/` (arquivos principais: `main.py`, `worker.py`, `job_utils.py` e a pasta `engine/`).

---

## Estrutura mínima importante (apenas arquivos do projeto, sem o .venv)

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

Você também pode gerar um `requirements.txt` com:

```bash
pip freeze > requirements.txt
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

Principais componentes observados:

* `Loader` (CSVLoader) — lê CSV, detecta separador e encoding quando não fornecidos (usa `chardet`).
* `Scaler` — implementa `standard`, `minmax`, `robust` (fit / transform sobre colunas selecionadas).
* `Encoder` — `onehot`, `ordinal`, `label`.
* `Pipeline` — recebe um `config` dict com ordem (`order`) e opções por etapa; aplica loader -> cleaners -> encoders -> scalers -> etc. e retorna um `DataFrame` final.

> Observação: parte do `worker.py` e `main.py` contém código direto de enfileiramento/usos de Redis. Verifique exatamente como o `config` do pipeline é criado (no repositório enviado há exemplos de `input.csv` e `output.csv` em `jobs/`).


---



## Changelog (v1.0)


---


