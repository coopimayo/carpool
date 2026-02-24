import math

from .models import Location

EARTH_RADIUS_KM = 6371.0


def haversine_km(start: Location, end: Location) -> float:
    lat1 = math.radians(start.latitude)
    lon1 = math.radians(start.longitude)
    lat2 = math.radians(end.latitude)
    lon2 = math.radians(end.longitude)

    d_lat = lat2 - lat1
    d_lon = lon2 - lon1

    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(d_lon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return EARTH_RADIUS_KM * c


def route_distance_km(stops: list[Location]) -> float:
    if len(stops) < 2:
        return 0.0

    total = 0.0
    for index in range(len(stops) - 1):
        total += haversine_km(stops[index], stops[index + 1])

    return total
