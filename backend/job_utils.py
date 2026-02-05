import os

BASE_DIR = "jobs"

#util funcion to create a folder linked to a job
def create_job_folder(job_id: str) -> str:
    job_dir = os.path.join(BASE_DIR, job_id)
    
    if os.path.exists(job_dir):
       raise RuntimeError("This jobs id folder has already been created")

    os.makedirs(job_dir)
    return job_dir

