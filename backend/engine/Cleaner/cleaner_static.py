import pandas as pd

class Cleaner:
    @staticmethod
    def drop_rows_if_any_na(df):
        return df.dropna()
    @staticmethod
    def drop_col_if_any_na(df):
        return df.dropna(axis=1)
    @staticmethod
    def drop_rows_if_all_na(df):
        return df.dropna(how="all")
    @staticmethod
    def drop_col_if_all_na(df):
        return df.dropna(axis=1, how="all")
    @staticmethod
    def fill_na_with_zero(df):
        return df.fillna(0)
    @staticmethod
    def fill_na_with_mean(df):
        df_copy = df.copy()
        numeric_cols = df_copy.select_dtypes(include="numbers").columns
        df_copy[numeric_cols] = df_copy.fillna(df_copy[numeric_cols].mean())
        return df_copy
    
    @staticmethod
    def fill_na_with_median(df):
        df_copy = df.copy()
        numeric_cols = df_copy.select_dtypes(include="numbers").columns
        df_copy[numeric_cols] = df_copy[numeric_cols].fillna(df_copy[numeric_cols].median())
        return df_copy
    
    @staticmethod
    #categorical columns
    def fill_na_with_mode(df, columns=None):
        df_copy = df.copy()

        #if no colum speficied select object types as default
        if columns is None:
            columns = df_copy.select_dtypes(include="object").columns


        for column in columns:
            #skip col if not in columns
            if column not in df_copy.columns:
                continue
            #skip col if empty
            if df_copy[column].dropna().empty:
                continue

            #[0] at the end is because .mode() can return a series, so it gets the first one
            df_copy[column] = df_copy[column].fillna(df_copy[column].mode()[0])

        return df_copy()