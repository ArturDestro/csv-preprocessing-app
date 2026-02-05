from .encoder import *

class EncoderFactory:
    @staticmethod
    def create(config):
        encoder_type = config["type"]

        if encoder_type == "ordinal":
            return OrdinalEncoder(config)

        if encoder_type == "label":
            return LabelEncoder(config)
        
        if encoder_type == "onehot":
            return OneHotEncoder(config)
        

        raise ValueError(f"Encoder '{encoder_type}' não suportado")