from carpool.models import Location
from carpool.providers.base import DistanceProvider
from carpool.providers.haversine import HaversineProvider


def nearest_neighbor_tsp(
    start: Location,
    stops: list[Location],
    provider: DistanceProvider | None = None,
) -> list[Location]:
    if not stops:
        return []

    if provider is None:
        provider = HaversineProvider()

    unvisited = stops.copy()
    ordered: list[Location] = []
    current = start

    while unvisited:
        next_stop = min(
            unvisited, key=lambda stop: provider.travel_time_minutes(current, stop)
        )
        ordered.append(next_stop)
        unvisited.remove(next_stop)
        current = next_stop

    return ordered
