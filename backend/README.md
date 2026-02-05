# FastAPI CSV Job Processor

A **FastAPI** backend for asynchronous CSV file processing using **Redis + RQ**.  
The system allows clients to upload a CSV via API, process it outside the HTTP request lifecycle, and download the processed file once the job is completed.

---

## 🚀 Features

- CSV upload via REST API
- Asynchronous job processing with Redis + RQ
- Processing outside the request/response cycle
- Per-job file organization (`jobs/{job_id}/`)
- Job status tracking endpoint
- Processed CSV download endpoint
- Simple and extensible data pipeline architecture

---

## 🧱 Architecture Overview
```text
Client
|
| POST /upload
v
FastAPI
|
| create job + save input.csv
| enqueue job in Redis (RQ)
v
Redis Queue
|
v
Worker (worker.py)
|
| process CSV
| generate output.csv
v
Local Storage (jobs/{job_id}/)
```

---

## 📁 Project Structure

```text
backend/
├── main.py # FastAPI application
├── worker.py # RQ worker (CSV processing)
├── job_utils.py # Job and filesystem helpers
├── jobs/
│ └── <job_id>/
│ ├── input.csv
│ ├── output.csv
│ └── status.json
├── requirements.txt
└── README.md
```


## 🔧 Tech Stack

- Python 3.10+
- FastAPI
- Redis
- RQ (Redis Queue)
- Uvicorn

---

## ▶️ Running the Project

### 1. Create and activate a virtual environment

```bash
python -m venv .venv
source .venv/bin/activate   # Linux/macOS
.venv\Scripts\activate      # Windows
```
### 2. Install dependencies
pip install -r requirements.txt

### 3. Start Redis

Using Docker (recommended):
```bash
docker run -p 6379:6379 redis
```
### 4. Run the API
```bash
uvicorn main:app --reload
```

API available at:
```link
http://localhost:8000
```

Swagger UI:
```link
http://localhost:8000/docs
```


### 5. Run the Worker

In a separate terminal:
```bash
python worker.py
```

The worker listens to the Redis queue and processes jobs in FIFO order.

## 📡 API Endpoints

POST /upload_csv
---
Uploads a CSV file and creates a new job.

Response

{
  "job_id": "job-uuid"
  "status" : status
}

GET /jobs/{job_id}
---
Returns the current job status.

Possible statuses
```text
queued

processing

done

error
```

GET /download_csv/{job_id}/
---
Downloads the processed output.csv file.


## 🧠 Concepts Applied

#### ⚡ Asynchronous processing

#### 📬 Job queues (FIFO)

####  🔀 API vs Worker separation

#### 💾 File I/O outside HTTP requests

#### 📁 Job-scoped storage

#### 🧱 Foundations for data pipelines
