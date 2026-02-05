import pandas as pd

class BaseScaler():
    def fit(self, config):
        raise NotImplementedError
    
    def transform(self, df):
        raise NotImplementedError
    
class StandardScaler(BaseScaler):
    def __init__(self, config):
        self.columns = config["columns"]
        self.mean = {}
        self.sd = {}
        self.fitted = False

    def fit(self, df):
        if self.columns is None:
            self.columns = df.select_dtypes(include='number').columns
        self.mean = {}
        self.sd = {}
        for col in self.columns:
            if col not in df.columns:
                continue
            if df[col].dropna().empty:
                continue
            self.mean[col] = df[col].mean()
            self.sd[col] = df[col].std()
        
        self.fitted = True
        return self
    def transform(self, df):
        if self.fitted:
            df_copy = df.copy()
            for col in self.columns:
                if col not in df_copy.columns:
                    continue
                if self.sd[col] == 0:
                    continue
                df_copy[col] = (df_copy[col] - self.mean[col]) / self.sd[col]
            return df_copy
        raise ValueError("Scaler must be fitted before calling transform()")

class MinMaxScaler(BaseScaler):
    def __init__(self, config):
        self.columns = config["columns"]
        self.min = {}
        self.max = {}
        self.fitted = False

    def fit(self, df):
        if self.columns is None:
            self.columns = df.select_dtypes(include='number').columns
        self.min = {}
        self.max = {}
        for col in self.columns:
            if col not in df.columns:
                continue
            if df[col].dropna().empty:
                continue
            self.min[col] = df[col].min()
            self.max[col] = df[col].max()
        
        self.fitted = True
        return self
    
    def transform(self, df):
        if self.fitted:
            df_copy = df.copy()
            for col in self.columns:
                if col not in df_copy.columns:
                    continue
                if self.min[col] == self.max[col]:
                    continue
                df_copy[col] = (df_copy[col] - self.min[col]) / (self.max[col] - self.min[col])
            return df_copy
        raise ValueError("Scaler must be fitted before calling transform()")

class RobustScaler(BaseScaler):
    def __init__(self, config):
        self.columns = config["columns"]
        self.median = {}
        self.iqr = {}
        self.fitted = False

    def fit(self, df):
        if self.columns is None:
            self.columns = df.select_dtypes(include='number').columns
        self.median = {}
        self.iqr = {}
        for col in self.columns:
            if col not in df.columns:
                continue
            if df[col].dropna().empty:
                continue
            self.iqr[col] = df[col].quantile(0.75) -  df[col].quantile(0.25)
            self.median[col] = df[col].median()
        
        self.fitted = True
        return self
    
    def transform(self, df):
        if self.fitted:
            df_copy = df.copy()
            for col in self.columns:
                if col not in df_copy.columns:
                    continue
                if self.iqr[col] == 0:
                    continue
                df_copy[col] = (df_copy[col] - self.median[col]) / self.iqr[col]
            return df_copy
        raise ValueError("Scaler must be fitted before calling transform()")
