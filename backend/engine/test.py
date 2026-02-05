from pipeline import Pipeline

config = {
    "order": ["loader"],
    "loader": {
        "type": "csv",
        "path": "../pandas.tutorial.txt",
        "separator": ","
    }
}

pipeline = Pipeline(config)
df = pipeline.run()

print(df.head())
