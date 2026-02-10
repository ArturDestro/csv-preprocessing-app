import pandas as pd

class TypeCaster:
    def __init__(self, config):
        self.schema = config["schema"]
    def fit(self):
        return self
    def transform(self, df):
        df_copy = df.copy()
        for col, dtype in self.schema.items():
            df_copy[col] = df_copy[col].astype(dtype)
        return df_copy