from .scaler import *

class ScalerFactory:
    @staticmethod
    def create(config):
        scaler_type = config["type"]

        if scaler_type == "standard":
            return StandardScaler(config)

        if scaler_type == "minmax":
            return MinMaxScaler(config)
        
        if scaler_type == "robust":
            return RobustScaler(config)

        raise ValueError(f"Scaler '{scaler_type}' não suportado")

       