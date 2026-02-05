from engine.pipeline import Pipeline
import redis
import json
import os
import traceback

#test config

QUEUE = "csv_jobs"
r = redis.Redis(host="localhost", port=6379, decode_responses=True)

def process_csv(job_id):
    try:
        #set jobs as being processed on FIFO
        r.set(f"job:{job_id}:status", "processing")
        job_dir = os.path.join("jobs", job_id)
        output_path = os.path.join(job_dir, "output.csv")
        error_path = os.path.join(job_dir, "error.txt")
        config_path = os.path.join(job_dir, "config.json")

        #load config from job_id/config.json
        with open(config_path) as f:
            config = json.load(f)
    except Exception as e:
        r.set(f"job:{job_id}:status", "failed")

    try:
        pipeline = Pipeline(config)
        df = pipeline.run()
        df.to_csv(output_path, index=False)

        r.set(f"job:{job_id}:status", "finished")
        print(f"✅ Job {job_id} finalizado")

    except Exception as e:
        r.set(f"job:{job_id}:status", "failed")

        with open(error_path, "w") as f:
            #write down error on error.txt 
            f.write(str(e) + "\n\n")
            f.write(traceback.format_exc())
            print(f"❌ Job {job_id} falhou")
def main():
    while True:
        try:
            _, job_data = r.blpop(QUEUE)
            job = json.loads(job_data)

            if job["type"] == "process_csv":
                process_csv(job["job_id"])
        except Exception as e:
            print("error trying to pop queue:", e)


if __name__ == "__main__":
    main()