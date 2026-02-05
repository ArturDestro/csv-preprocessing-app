class Pipeline:
    def __init__(self, config: dict):
        self.config = config
        self.order = config.get("order", [])

    def run(self):
        df = None

        for step in self.order:

            if step not in self.config:
                continue

            if step != "loader" and df is None:
                raise RuntimeError("Pipeline: loader deve rodar antes das outras etapas")

            step_config = self.config[step]

            if step == "loader":
                from engine.Loader.loaderFactory import LoaderFactory
                loader = LoaderFactory.create(step_config)
                df = loader.load()
                continue

            if step == "cleaner":
                from engine.Cleaner.cleanerFactory import CleanerFactory
                cleaner = CleanerFactory.create(step_config)
                cleaner.fit(df)
                df = cleaner.transform(df)
                continue

            if step == "encoder":
                from engine.Encoder.encoderFactory import EncoderFactory
                encoder = EncoderFactory.create(step_config)
                encoder.fit(df)
                df = encoder.transform(df)
                continue

            if step == "scaler":
                from engine.Scaler.scalerFactory import ScalerFactory
                scaler = ScalerFactory.create(step_config)
                scaler.fit(df)
                df = scaler.transform(df)
                continue

        return df
