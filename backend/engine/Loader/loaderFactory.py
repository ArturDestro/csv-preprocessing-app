from .csv_loader import CSVLoader

class LoaderFactory:
    @staticmethod
    def create(config):
        loader_type = config.get("type")

        if loader_type == "csv":
            return CSVLoader(config)

        raise ValueError(f"Loader inválido: {loader_type}")
