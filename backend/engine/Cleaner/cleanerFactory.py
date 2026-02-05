from .cleaner import *

class CleanerFactory:
    @staticmethod
    def create(config):
        cleaner_type = config["type"]

        if cleaner_type == "mode":
            return MeanCleaner(config)

        if cleaner_type == "mean":
            return MeanCleaner(config)
        
        if cleaner_type == "median":
            return MedianCleaner(config)

        raise ValueError(f"Cleaner '{cleaner_type}' não suportado")
