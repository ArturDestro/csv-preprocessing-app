import pandas as pd

class BaseCleaner:
    def fit (self, config):
        raise NotImplementedError
    
    def transform(self, df):
        raise NotImplementedError
    
class ModeCleaner(BaseCleaner):
    def __init__(self, config):
        self.columns = config["columns"]
        self.mode = {} #mode of each column
        self.fitted = False

    def fit(self, df):
        if self.columns is None:
            self.columns = df.select_dtypes(include="object").columns
        #reset dict in case of concurrency
        self.mode = {}
        for col in self.columns:
            if col not in df.columns:
                continue
            if df[col].dropna().empty:
                continue
            self.mode[col] = df[col].mode()[0]

        self.fitted = True
        return self
    
    def transform(self, df):
        if self.fitted:
            df_copy = df.copy()
            for col, value in self.mode.items():
                df_copy[col] = df_copy[col].fillna(value)
            return df_copy
        raise ValueError("Cleaner must be fitted before calling transform()")

class MeanCleaner(BaseCleaner):
    def __init__(self, config):
        self.columns = config["columns"]
        self.mean = {} #mean of each column
        self.fitted = False

    def fit(self, df):
        if self.columns is None:
            self.columns = df.select_dtypes(include='number').columns
        #reset dict in case of concurrency
        self.mean = {}
        for col in self.columns:
            if col not in df.columns:
                continue
            if df[col].dropna().empty:
                continue
            self.mean[col] = df[col].mean()

        self.fitted = True
        return self
    
    def transform(self, df):
        if self.fitted:
            df_copy = df.copy()
            for col, value in self.mean.items():
                df_copy[col] = df_copy[col].fillna(value)
            return df_copy
        raise ValueError("Cleaner must be fitted before calling transform()")

class MedianCleaner(BaseCleaner):
    def __init__(self, config):
        self.columns = config["columns"]
        self.median = {} #median of each column
        self.fitted = False

    def fit(self, df):
        if self.columns is None:
            self.columns = df.select_dtypes(include='number').columns
        #reset dict in case of concurrency
        self.median = {}
        for col in self.columns:
            if col not in df.columns:
                continue
            if df[col].dropna().empty:
                continue
            self.median[col] = df[col].median()

        self.fitted = True
        return self
    
    def transform(self, df):
        if self.fitted:
            df_copy = df.copy()
            for col, value in self.median.items():
                df_copy[col] = df_copy[col].fillna(value)
            return df_copy
        raise ValueError("Cleaner must be fitted before calling transform()")   