from .cleaner import *

class CleanerFactory:

    CLEANER_MAP = {
        "constant": ConstantCleaner,
        "mean": MeanCleaner,
        "median": MedianCleaner,
        "mode": ModeCleaner,
    }

    @staticmethod
    def create(config):
        steps = []

        if config.get("remove_duplicates", False):
            steps.append(DuplicateCleaner(config))
        try:
            cleaner_class = CleanerFactory.CLEANER_MAP[config["type"]]
            steps.append(cleaner_class(config))
        except KeyError:
            raise ValueError(f"Cleaner '{config['type']}' não suportado")
        
        return steps

