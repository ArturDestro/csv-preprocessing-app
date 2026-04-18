import os
from fastapi import HTTPException

BASE_DIR = "jobs"

#util funcion to create a folder linked to a job
def create_job_folder(job_id: str) -> str:
    job_dir = os.path.join(BASE_DIR, job_id)
    
    if os.path.exists(job_dir):
       raise RuntimeError("This jobs id folder has already been created")

    os.makedirs(job_dir)
    return job_dir

def get_dataset_path(job_id: str):
    job_dir = os.path.join("jobs", job_id)

    processed = os.path.join(job_dir, "output.csv")
    raw = os.path.join(job_dir, "input.csv")

    if os.path.exists(processed):
        return processed
    elif os.path.exists(raw):
        return raw
    else:
        raise HTTPException(404, "Dataset not found")