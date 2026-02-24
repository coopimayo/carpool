from .distance import haversine_km
from .models import Location


def nearest_neighbor_tsp(start: Location, stops: list[Location]) -> list[Location]:
    if not stops:
        return []

    unvisited = stops.copy()
    ordered: list[Location] = []
    current = start

    while unvisited:
        next_stop = min(unvisited, key=lambda stop: haversine_km(current, stop))
        ordered.append(next_stop)
        unvisited.remove(next_stop)
        current = next_stop

    return ordered
