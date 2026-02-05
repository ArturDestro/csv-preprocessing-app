from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.responses import FileResponse
import uuid
import os
import shutil
from job_utils import create_job_folder
import json

from redis import Redis
from rq import Queue

app = FastAPI()

redis_conn = Redis(host="localhost", port=6379, decode_responses=True)
QUEUE = "csv_jobs"

@app.get("/ping")
def ping():
    return {"message": "pong"}

@app.get("/jobs/{job_id}")
def get_job_status(job_id: str):
    status = redis_conn.get(f"job:{job_id}:status")

    if status is None:
        raise HTTPException(status_code=404, detail="Job not found")

    response = {
        "job_id": job_id,
        "status": status
    }

    if status == "failed":
        error_path = os.path.join("jobs", job_id, "error.txt")
        if os.path.exists(error_path):
            with open(error_path) as f:
                response["error"] = f.read()

    return response

@app.post("/upload")
def upload_csv(file: UploadFile = File(...), config: str = Form()):
    #try to convert config to dict
    try:
        config_dict = json.loads(config)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid config JSON")

    #jobs id
    job_id = str(uuid.uuid4())
    #create job`s folder
    job_dir = create_job_folder(job_id)

    #path to each jobs input.csv
    file_path = os.path.join(job_dir, "input.csv")
    #path to each jobs config.json
    config_path = os.path.join(job_dir, "config.json")
    
    #pass input.csv to config_dict
    config_dict.setdefault("loader", {})
    config_dict["loader"]["path"] = file_path


    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    with open(config_path, "w") as f:
        json.dump(config_dict, f, indent=2)

    #set job status to queued
    redis_conn.set(f"job:{job_id}:status", "queued")

    job = {
        "job_id": job_id,
        "type": "process_csv",
    }

    #PUSH JOB TO END OF FIFO
    redis_conn.rpush(QUEUE, json.dumps(job))

    return {"job_id": job_id,
            "status": redis_conn.get(f"job:{job_id}:status")}

@app.get("/download_csv/{job_id}")
def download_csv(job_id: str):
    status = redis_conn.get(f"job:{job_id}:status")

    if status != "finished":
        raise HTTPException(409, "Job not done processing")

    output_path = os.path.join("jobs", job_id, "output.csv")

    if not os.path.exists(output_path):
        raise HTTPException(status_code=404, detail="file to download not found")
    
    return FileResponse(
        path=output_path,
        media_type="text/csv",
        filename="resultado.csv"
    )