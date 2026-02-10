from .TypeCaster import TypeCaster

class TypeCasterFactory:
    @staticmethod
    def create(config):
        return TypeCaster(config)