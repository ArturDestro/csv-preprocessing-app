import pandas as pd
import os
import chardet
import csv

class CSVLoader:

    def __init__(self, config):
        if "path" not in config:
            raise ValueError("CSVLoader: 'path' can not be absent")
        self.path = config["path"]
        #set separator and encoding if defined, if not set them to None
        self.separator = config.get("separator", None)
        self.encoding = config.get("encoding", None)


    def _verify(self):
        if self._isValid():
            if self.encoding == None:    
                #verify encoding manually
                with open(self.path, 'rb') as f:
                    self.encoding = chardet.detect(f.read())["encoding"]
            if self.separator == None:   
                #verify separator manually
                with open(self.path, "r", encoding=self.encoding) as f:
                    sample = f.read(2048)
                    self.separator = csv.Sniffer().sniff(sample).delimiter

                    #verify separator 
                    if not self._separator_works(self.separator):
                        self._test_others_seps()           
        else:   
            raise FileNotFoundError("File is invalid")
    
    def load(self):
        self._verify()
        #load csv with proper configs and c engine for performance
        df = pd.read_csv(self.path, encoding=self.encoding, sep=self.separator)
        #verify emptyness
        if self._isEmpty(df):
            raise ValueError("file is empty")
        if not self._isTabular(df):
            raise ValueError("file is not tabular")
        return df
    
    def _separator_works(self, sep, min_cols=2):
            try: 
                df = pd.read_csv(
                path=self.path,
                sep=sep,
                encoding=self.encoding,
                engine="python", #python engine for more tolerancy
                nrows=20 #reads a sample
            )
            except Exception:
                return False
            
            #verify if every thing is inside a column (probably wrong)
            if df.shape[1] < min_cols:
                return False
            
            if df.columns.size == 1:
                return False
            
            return True

    def _isValid(self):
        #verify path
        if not os.path.exists(self.path):
            return False
        #empty file
        if os.path.getsize(self.path) == 0:
            return False
        
        return True
    
    def _isEmpty(self, df):
        #no rows
        if df.empty:
            return True
        
        #verify is only NaN inside csv
        if df.dropna(how="all").empty:
            return True
        
        return False
    
    def _test_others_seps(self):
        #commonly used delimiters
        candidates = [",", ";", "\t", "|"]

        for sep in candidates:
            if sep == self.separator:
                continue  # already tested

            if self._separator_works(sep):
                self.separator = sep
                return

        raise ValueError("could not find a validy delimiter for the csv")
    
    def _isTabular(self, df, min_rows=2, min_cols=2):
        # verify if enought rows
        if df.shape[0] < min_rows:
            return False

        # verify if enought columns
        if df.shape[1] < min_cols:
            return False

        # verify if all columns names are digits
        if all(str(c).isdigit() for c in df.columns):
            return False

        # cant be all NaN
        if df.dropna(how="all").empty:
            return False

        # verify not-null ratio
        non_null_ratio = df.notna().sum().sum() / (df.shape[0] * df.shape[1])
        if non_null_ratio < 0.1:
            return False

        return True
