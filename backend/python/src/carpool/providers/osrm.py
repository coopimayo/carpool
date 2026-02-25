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
        self._travel_time_cache: dict[tuple[Location, Location], float] = {}

    def _cache_key(self, origin: Location, destination: Location) -> tuple[Location, Location]:
        return (origin, destination)

    def distance_km(self, origin: Location, destination: Location) -> float:
        """Get distance between two locations via OSRM."""
        cache_key = self._cache_key(origin, destination)
        cached_distance = self._distance_cache.get(cache_key)
        if cached_distance is not None:
            return cached_distance

        self._fetch_route_metrics(origin, destination)
        return self._distance_cache.get(cache_key, 0.0)

    def travel_time_minutes(self, origin: Location, destination: Location) -> float:
        """Get travel time between two locations via OSRM."""
        cache_key = self._cache_key(origin, destination)
        cached_travel_time = self._travel_time_cache.get(cache_key)
        if cached_travel_time is not None:
            return cached_travel_time

        self._fetch_route_metrics(origin, destination)
        return self._travel_time_cache.get(cache_key, 0.0)

    def _fetch_route_metrics(self, origin: Location, destination: Location) -> None:
        cache_key = self._cache_key(origin, destination)

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
                route_data = data["routes"][0]
                distance_km = route_data.get("distance", 0.0) / 1000.0
                travel_time_minutes = route_data.get("duration", 0.0) / 60.0
                self._distance_cache[cache_key] = distance_km
                self._travel_time_cache[cache_key] = travel_time_minutes
        except Exception:
            pass

    def matrix_distances_km(
        self, origins: list[Location], destinations: list[Location]
    ) -> list[list[float]]:
        """Get distance matrix via OSRM."""
        self._fetch_missing_matrix_metrics(origins, destinations)

        return [
            [
                self._distance_cache.get(self._cache_key(origin, destination), 0.0)
                for destination in destinations
            ]
            for origin in origins
        ]

    def matrix_travel_times_minutes(
        self, origins: list[Location], destinations: list[Location]
    ) -> list[list[float]]:
        """Get travel time matrix via OSRM."""
        self._fetch_missing_matrix_metrics(origins, destinations)

        return [
            [
                self._travel_time_cache.get(self._cache_key(origin, destination), 0.0)
                for destination in destinations
            ]
            for origin in origins
        ]

    def _fetch_missing_matrix_metrics(
        self, origins: list[Location], destinations: list[Location]
    ) -> None:
        if not origins:
            return

        if not destinations:
            return

        missing_pairs: list[tuple[Location, Location]] = []
        for origin in origins:
            for destination in destinations:
                cache_key = self._cache_key(origin, destination)
                if (
                    cache_key not in self._distance_cache
                    or cache_key not in self._travel_time_cache
                ):
                    missing_pairs.append((origin, destination))

        if not missing_pairs:
            return

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

        coords = ";".join(f"{loc.longitude},{loc.latitude}" for loc in coordinate_locs)
        source_indexes = ",".join(
            str(coordinate_indexes[location]) for location in source_locs
        )
        destination_indexes = ",".join(
            str(coordinate_indexes[location]) for location in destination_locs
        )
        url = (
            f"{self.base_url}/table/v1/driving/{coords}?"
            f"sources={source_indexes}&"
            f"destinations={destination_indexes}&"
            "annotations=distance,duration"
        )

        try:
            response = requests.get(url, timeout=self.timeout)
            response.raise_for_status()
            data = response.json()
            if data["code"] == "Ok":
                distance_matrix = data.get("distances") or []
                duration_matrix = data.get("durations") or []
                for row_index, source in enumerate(source_locs):
                    for column_index, destination in enumerate(destination_locs):
                        cache_key = self._cache_key(source, destination)

                        distance_meters = distance_matrix[row_index][column_index]
                        distance_km = 0.0 if distance_meters is None else distance_meters / 1000.0
                        self._distance_cache[cache_key] = distance_km

                        duration_seconds = duration_matrix[row_index][column_index]
                        travel_time_minutes = (
                            0.0 if duration_seconds is None else duration_seconds / 60.0
                        )
                        self._travel_time_cache[cache_key] = travel_time_minutes
        except Exception:
            pass
