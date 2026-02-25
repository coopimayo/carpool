import os

import requests

from carpool.models import Location
from carpool.providers.base import DistanceProvider


class OSRMProvider(DistanceProvider):
    """OSRM (Open Source Routing Machine) provider for real-world distances."""

    def __init__(self, base_url: str | None = None, timeout: float = 10.0):
        self.base_url = base_url or os.getenv("OSRM_URL", "http://localhost:5000")
        self.timeout = timeout
        self._distance_cache: dict[tuple[Location, Location], float] = {}

    def _cache_key(self, origin: Location, destination: Location) -> tuple[Location, Location]:
        return (origin, destination)

    def distance_km(self, origin: Location, destination: Location) -> float:
        """Get distance between two locations via OSRM."""
        cache_key = self._cache_key(origin, destination)
        cached_distance = self._distance_cache.get(cache_key)
        if cached_distance is not None:
            return cached_distance

        url = (
            f"{self.base_url}/route/v1/driving/"
            f"{origin.longitude},{origin.latitude};"
            f"{destination.longitude},{destination.latitude}"
        )
        try:
            response = requests.get(url, timeout=self.timeout)
            response.raise_for_status()
            data = response.json()
            if data["code"] == "Ok" and data["routes"]:
                distance_m = data["routes"][0]["distance"]
                distance_km = distance_m / 1000.0
                self._distance_cache[cache_key] = distance_km
                return distance_km
        except Exception:
            pass
        return 0.0

    def matrix_distances_km(
        self, origins: list[Location], destinations: list[Location]
    ) -> list[list[float]]:
        """Get distance matrix via OSRM."""
        if not origins:
            return []

        if not destinations:
            return [[] for _ in origins]

        missing_pairs: list[tuple[Location, Location]] = []
        for origin in origins:
            for destination in destinations:
                if self._cache_key(origin, destination) not in self._distance_cache:
                    missing_pairs.append((origin, destination))

        if missing_pairs:
            source_locs: list[Location] = []
            destination_locs: list[Location] = []
            source_seen: set[Location] = set()
            destination_seen: set[Location] = set()

            for origin, destination in missing_pairs:
                if origin not in source_seen:
                    source_seen.add(origin)
                    source_locs.append(origin)
                if destination not in destination_seen:
                    destination_seen.add(destination)
                    destination_locs.append(destination)

            coordinate_locs: list[Location] = []
            coordinate_indexes: dict[Location, int] = {}
            for location in [*source_locs, *destination_locs]:
                if location not in coordinate_indexes:
                    coordinate_indexes[location] = len(coordinate_locs)
                    coordinate_locs.append(location)

            coords = ";".join(
                f"{loc.longitude},{loc.latitude}" for loc in coordinate_locs
            )
            source_indexes = ",".join(
                str(coordinate_indexes[location]) for location in source_locs
            )
            destination_indexes = ",".join(
                str(coordinate_indexes[location]) for location in destination_locs
            )
            url = (
                f"{self.base_url}/table/v1/driving/{coords}?"
                f"sources={source_indexes}&"
                f"destinations={destination_indexes}"
            )

            try:
                response = requests.get(url, timeout=self.timeout)
                response.raise_for_status()
                data = response.json()
                if data["code"] == "Ok":
                    matrix = data["distances"]
                    for row_index, source in enumerate(source_locs):
                        for column_index, destination in enumerate(destination_locs):
                            distance_meters = matrix[row_index][column_index]
                            distance_km = distance_meters / 1000.0
                            self._distance_cache[
                                self._cache_key(source, destination)
                            ] = distance_km
            except Exception:
                pass

        return [
            [
                self._distance_cache.get(self._cache_key(origin, destination), 0.0)
                for destination in destinations
            ]
            for origin in origins
        ]
