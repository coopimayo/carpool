import math

from models import Location
from providers.base import DistanceProvider

EARTH_RADIUS_KM = 6371.0
DEFAULT_AVERAGE_SPEED_KMPH = 40.0


class HaversineProvider(DistanceProvider):
    """Haversine formula provider for great-circle distances."""

    def __init__(self, average_speed_kmph: float = DEFAULT_AVERAGE_SPEED_KMPH):
        self.average_speed_kmph = average_speed_kmph

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

    def travel_time_minutes(self, origin: Location, destination: Location) -> float:
        distance_km = self.distance_km(origin, destination)
        if self.average_speed_kmph <= 0:
            return 0.0
        return (distance_km / self.average_speed_kmph) * 60.0

    def matrix_travel_times_minutes(
        self, origins: list[Location], destinations: list[Location]
    ) -> list[list[float]]:
        return [
            [
                self.travel_time_minutes(origin, destination)
                for destination in destinations
            ]
            for origin in origins
        ]
