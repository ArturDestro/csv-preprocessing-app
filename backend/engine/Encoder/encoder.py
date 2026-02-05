import pandas as pd
import numpy as np

class BaseEncoder:
    def fit(self, config):
        return self
    
    def transform(self, df):
        raise NotImplementedError
    
class OneHotEncoder(BaseEncoder):
    def __init__(self, config):
        self.columns = config["columns"]
        self.categories = {}
        self.fitted = False

    def fit(self, df):
        if self.columns is None:
            self.columns = df.select_dtypes(include="object").columns
        self.categories = {}
        for col in self.columns:
            if col not in df.columns:
                continue
            if df[col].dropna().empty:
                continue
            self.categories[col] = [
                f"{col}_{v}" for v in df[col].dropna().unique()
            ]

        self.fitted = True
        return self
    
    def transform(self, df):
        if self.fitted:
            df_copy = df.copy()
            for col, categories in self.categories.items():
                if col not in df_copy.columns:
                    continue
                #one-hot of current df
                dummies = pd.get_dummies(df_copy[col], prefix=col)

                for cat in categories:
                    if cat not in dummies.columns:
                        dummies[cat] = 0
                #remove categories not seen during fit
                dummies = dummies[categories]


                #drop original column
                df_copy = df_copy.drop(columns=[col])

                #concat one-hot
                df_copy = pd.concat([df_copy, dummies], axis=1)
            
            return df_copy
        
        raise ValueError("Encoder must be fitted before calling transform()")
    
class LabelEncoder(BaseEncoder):
    def __init__(self, config):
        self.columns = config["columns"]
        self.labels = {}
        self.fitted = False

    def fit(self, df):
        if self.columns is None:
            self.columns = df.select_dtypes(include="object").columns
        self.labels = {}
        for col in self.columns:
            values = df[col].dropna().unique()
            #{"A": 0, "B": 1, "C": 2}
            self.labels[col] = {v:i for i, v in enumerate(values)}
        self.fitted = True
        return self

    def transform(self, df):
        if self.fitted:
            df_copy = df.copy()
            for col, mapping in self.labels.items():
                if col not in df_copy.columns:
                    continue
                df_copy[col] = df_copy[col].map(mapping).fillna(-1)
            return df_copy
        raise ValueError("Encoder must be fitted before calling transform()")


class OrdinalEncoder(BaseEncoder):
    def __init__(self, config):
        self.mapping = config["mapping"]
        self.fitted = True

    def transform(self, df):
        if self.fitted:
            df_copy = df.copy()
            for col, mapping in self.mapping.items():
                df_copy[col] = df_copy[col].map(mapping)
            return df_copy
        raise ValueError("Encoder must be fitted before calling transform()")
