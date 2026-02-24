import math

from carpool.models import Location
from carpool.providers.base import DistanceProvider

EARTH_RADIUS_KM = 6371.0


class HaversineProvider(DistanceProvider):
    """Haversine formula provider for great-circle distances."""

    def distance_km(self, origin: Location, destination: Location) -> float:
        lat1 = math.radians(origin.latitude)
        lon1 = math.radians(origin.longitude)
        lat2 = math.radians(destination.latitude)
        lon2 = math.radians(destination.longitude)

        d_lat = lat2 - lat1
        d_lon = lon2 - lon1

        a = (
            math.sin(d_lat / 2) ** 2
            + math.cos(lat1) * math.cos(lat2) * math.sin(d_lon / 2) ** 2
        )
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

        return EARTH_RADIUS_KM * c

    def matrix_distances_km(
        self, origins: list[Location], destinations: list[Location]
    ) -> list[list[float]]:
        return [
            [self.distance_km(origin, destination) for destination in destinations]
            for origin in origins
        ]
