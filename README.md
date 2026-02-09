# CSV Processing App — README (versão 1.0)

**Status:** v1.0 — descrição fiel ao código presente (backend apenas).

---

## Visão geral (curto e direto)

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

O `worker.process_csv` constrói/define (ou deveria definir) um `config` onde o `loader.path` é `jobs/<job_id>/input.csv`, chama `Pipeline(config).run()` e grava `output.csv` na pasta do job.

> Observação: parte do `worker.py` e `main.py` contém código direto de enfileiramento/usos de Redis. Verifique exatamente como o `config` do pipeline é criado (no repositório enviado há exemplos de `input.csv` e `output.csv` em `jobs/`).

---

## Observações / problemas encontrados (curto e objetivo)

1. **Virtualenv dentro do repositório** (`src/backend/.venv/`) — remover e adicionar `.venv/` ao `.gitignore`.
2. **Sem `requirements.txt`/`pyproject.toml`** visível — adicione para facilitar instalação reproduzível.
3. `main.py` importa `rq.Queue` mas o fluxo atual usa `redis_conn.rpush` + `blpop` no worker — existe uma inconsistência (ou sobra import). Escolha entre usar `rq`/`RQ` ou usar fila manual via listas Redis; hoje o código usa a lista Redis manualmente.
4. `worker.py` possui `while True: blpop` — ok para POC, mas em produção prefira workers gerenciados (systemd, supervisor, containers) e tratamento de falhas/retries/logs.
5. Segurança: endpoints sem autenticação — se for expor, adicione autenticação/limitação de tamanho de upload, validação de esquema CSV.

---

## Melhorias / roadmap sugerido (rápido)

* Remover `.venv` e adicionar `requirements.txt`.
* Padronizar enfileiramento: use `rq`/`celery` (com Redis) ou mantenha a lista Redis manual, mas remova imports obsoletos.
* Adicionar testes unitários para `engine/` (pandas workflows).
* Adicionar `docker-compose` com `backend` + `redis` para facilitar o desenvolvimento.
* Expor logs e métricas básicas (arquivo de log, ou endpoint `/metrics`).

---

## Como eu posso ajudar agora

Escolha uma das opções e eu faço na hora:

1. Gerar um `requirements.txt` preciso a partir dos imports detectados.
2. Remover `.venv` e criar um `.gitignore` e `docker-compose.yml` (backend + redis).
3. Substituir o `rpush`/`blpop` por uma implementação com `rq` ou `celery` (faço a alteração no código).
4. Gerar um `README.md` final pronto para the repo (versão curta e a versão técnica de desenvolvimento).

Diz qual você quer que eu faça agora e eu executo direto no repositório que você subiu.

---

## Changelog (v1.0)

* README inicializado com descrição fiel ao código encontrado em `src/backend`.

---

> Nota: este README foi escrito diretamente do conteúdo do zip `src.zip` que você enviou. Se quiser, eu já aplico as mudanças no repositório (ex: criar `requirements.txt`, `.gitignore` e `docker-compose.yml`) — só me diga qual das opções acima prefere.
