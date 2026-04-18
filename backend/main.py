from fastapi import FastAPI, UploadFile, File, HTTPException, Form, Response
from fastapi.responses import FileResponse, JSONResponse
import uuid
import os
import shutil
from job_utils import create_job_folder, get_dataset_path
import json
import pandas as pd
import numpy as np

from redis import Redis
from rq import Queue

app = FastAPI()

#allow access through all sites
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


redis_conn = Redis(host="redis", port=6379, decode_responses=True)
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
def upload_csv(file: UploadFile = File(...)):
     #jobs id       
    job_id = str(uuid.uuid4())
    #create job`s folder
    job_dir = create_job_folder(job_id)

    #path to each jobs input.csv
    file_path = os.path.join(job_dir, "input.csv")

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    #set job status to uploaded
    redis_conn.set(f"job:{job_id}:status", "uploaded")

    return {"job_id": job_id,
            "status": redis_conn.get(f"job:{job_id}:status")}

@app.post("/run_pipeline/{job_id}")
def run_pipeline(job_id: str, config: dict):
    #create job`s folder
    job_dir = os.path.join("jobs", job_id)      

    #path to each jobs input.csv
    file_path = os.path.join(job_dir, "input.csv")
    #path to each jobs config.json
    config_path = os.path.join(job_dir, "config.json")
    
    #pass input.csv to config_dict
    config.setdefault("loader", {})
    config["loader"]["path"] = file_path

    with open(config_path, "w") as f:
        json.dump(config, f, indent=2)

    job = {
        "job_id": job_id,
        "type": "process_csv",
    }

    #PUSH JOB TO END OF FIFO
    redis_conn.rpush(QUEUE, json.dumps(job))

    #set job status to queued
    redis_conn.set(f"job:{job_id}:status", "queued")

    return {"job_id": job_id,
            "status": redis_conn.get(f"job:{job_id}:status")}

@app.post("/generate_chart")
def generate_chart(config: dict):
    job_id     = config.get("job_id")
    chart_type = config.get("type")
    chart_x    = config.get("x")
    chart_y    = config.get("y")

    if not job_id:
        raise HTTPException(400, "job_id is required")

    dataset_path = get_dataset_path(job_id)
    df = pd.read_csv(dataset_path)

    # ── Validations ───────────────────────────────────────────────────────────

    VALID_TYPES = {"line", "bar", "scatter", "area", "histogram", "pie"}
    if not chart_type or chart_type not in VALID_TYPES:
        raise HTTPException(400, f"Invalid chart type. Choose from: {VALID_TYPES}")

    if not chart_x:
        raise HTTPException(400, "Invalid chart config: 'x' column is required")

    if chart_x not in df.columns:
        raise HTTPException(400, f"Column '{chart_x}' not found in dataset")

    if chart_y and chart_y not in df.columns:
        raise HTTPException(400, f"Column '{chart_y}' not found in dataset")

    # ── Chart-specific validation ─────────────────────────────────────────────

    # Charts that require a numeric X
    if chart_type in {"scatter", "histogram"}:
        if not pd.api.types.is_numeric_dtype(df[chart_x]):
            raise HTTPException(400, f"Chart type '{chart_type}' requires a numeric X column")

    # Charts that require a numeric Y
    if chart_type in {"line", "bar", "scatter", "area"} and chart_y:
        if not pd.api.types.is_numeric_dtype(df[chart_y]):
            raise HTTPException(400, f"Chart type '{chart_type}' requires a numeric Y column")

    # ── Data generation ───────────────────────────────────────────────────────

    if chart_type in {"line", "area"}:
        # Sort by X for a clean line
        out = (
            df[[chart_x, chart_y]]
            .dropna()
            .sort_values(chart_x)
            .rename(columns={chart_x: chart_x, chart_y: chart_y})
            .to_dict(orient="records")
        )

    elif chart_type == "bar":
        if chart_y:
            # Mean of Y grouped by X
            out = (
                df.groupby(chart_x)[chart_y]
                .mean()
                .reset_index()
                .rename(columns={chart_y: chart_y})
                .to_dict(orient="records")
            )
        else:
            # Count of each X value
            out = (
                df[chart_x].value_counts()
                .reset_index()
                .rename(columns={"index": chart_x, chart_x: "count"})
                .to_dict(orient="records")
            )

    elif chart_type == "scatter":
        out = (
            df[[chart_x, chart_y]]
            .dropna()
            .to_dict(orient="records")
        )

    elif chart_type == "histogram":
        # Bin the numeric column and return counts per bin
        series = df[chart_x].dropna()
        counts, bin_edges = np.histogram(series, bins=10)
        out = [
            {
                "bin": f"{bin_edges[i]:.1f}–{bin_edges[i+1]:.1f}",
                "count": int(counts[i]),
            }
            for i in range(len(counts))
        ]

    elif chart_type == "pie":
        counts = df[chart_x].value_counts().reset_index()
        counts.columns = ["name", "value"]  # força os nomes independente da versão do pandas
        out = [{"name": str(row["name"]), "value": int(row["value"])}
            for _, row in counts.iterrows()]

    else:
        raise HTTPException(400, "Invalid chart type")

    return JSONResponse(content=out)

'''@app.post("/upload")
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
            "status": redis_conn.get(f"job:{job_id}:status")}'''

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