import os
import time
from typing import Any

import requests

from carpool.models import Location
from carpool.providers.base import DistanceProvider


class OSRMProvider(DistanceProvider):
    """OSRM (Open Source Routing Machine) provider for real-world distances."""

    def __init__(
        self,
        base_url: str | None = None,
        timeout: float = 10.0,
        requests_per_second: float = 10.0,
        max_retries: int = 2,
        retry_backoff_seconds: float = 0.2,
    ):
        self.base_url = base_url or os.getenv("OSRM_URL", "http://localhost:5000")
        self.timeout = max(timeout, 0.0)
        self.requests_per_second = max(requests_per_second, 0.0)
        self.max_retries = max(max_retries, 0)
        self.retry_backoff_seconds = max(retry_backoff_seconds, 0.0)
        self._min_request_interval_seconds = (
            0.0 if self.requests_per_second == 0 else 1.0 / self.requests_per_second
        )
        self._last_request_timestamp = 0.0
        self._distance_cache: dict[tuple[Location, Location], float] = {}
        self._travel_time_cache: dict[tuple[Location, Location], float] = {}

    def _cache_key(self, origin: Location, destination: Location) -> tuple[Location, Location]:
        return (origin, destination)

    def _throttle_requests(self) -> None:
        if self._min_request_interval_seconds <= 0.0:
            return

        now = time.monotonic()
        elapsed = now - self._last_request_timestamp
        remaining = self._min_request_interval_seconds - elapsed
        if remaining > 0:
            time.sleep(remaining)

    def _safe_positive_float(self, value: Any) -> float:
        if value is None:
            return 0.0

        try:
            parsed = float(value)
        except (TypeError, ValueError):
            return 0.0

        return parsed if parsed > 0.0 else 0.0

    def _request_json(self, url: str) -> dict[str, Any] | None:
        for attempt in range(self.max_retries + 1):
            self._throttle_requests()
            self._last_request_timestamp = time.monotonic()

            try:
                response = requests.get(url, timeout=self.timeout)
                status_code_raw = getattr(response, "status_code", 200)
                status_code = (
                    status_code_raw
                    if isinstance(status_code_raw, int)
                    else 200
                )

                if status_code == 429 or status_code >= 500:
                    if attempt < self.max_retries:
                        backoff = self.retry_backoff_seconds * (2**attempt)
                        if backoff > 0.0:
                            time.sleep(backoff)
                        continue

                    return None

                response.raise_for_status()
                payload = response.json()
                if isinstance(payload, dict):
                    return payload
                return None
            except (requests.Timeout, requests.ConnectionError):
                if attempt < self.max_retries:
                    backoff = self.retry_backoff_seconds * (2**attempt)
                    if backoff > 0.0:
                        time.sleep(backoff)
                    continue
                return None
            except requests.RequestException:
                return None
            except ValueError:
                return None

        return None

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
        data = self._request_json(url)
        if not data:
            return

        if data.get("code") != "Ok":
            return

        routes = data.get("routes")
        if not isinstance(routes, list) or not routes:
            return

        first_route = routes[0]
        if not isinstance(first_route, dict):
            return

        distance_km = self._safe_positive_float(first_route.get("distance")) / 1000.0
        travel_time_minutes = (
            self._safe_positive_float(first_route.get("duration")) / 60.0
        )
        self._distance_cache[cache_key] = distance_km
        self._travel_time_cache[cache_key] = travel_time_minutes

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

        data = self._request_json(url)
        if not data:
            return

        if data.get("code") != "Ok":
            return

        distance_matrix = data.get("distances")
        duration_matrix = data.get("durations")

        for row_index, source in enumerate(source_locs):
            distance_row = (
                distance_matrix[row_index]
                if isinstance(distance_matrix, list)
                and row_index < len(distance_matrix)
                and isinstance(distance_matrix[row_index], list)
                else []
            )
            duration_row = (
                duration_matrix[row_index]
                if isinstance(duration_matrix, list)
                and row_index < len(duration_matrix)
                and isinstance(duration_matrix[row_index], list)
                else []
            )

            for column_index, destination in enumerate(destination_locs):
                cache_key = self._cache_key(source, destination)

                distance_meters = (
                    distance_row[column_index]
                    if column_index < len(distance_row)
                    else None
                )
                duration_seconds = (
                    duration_row[column_index]
                    if column_index < len(duration_row)
                    else None
                )

                self._distance_cache[cache_key] = (
                    self._safe_positive_float(distance_meters) / 1000.0
                )
                self._travel_time_cache[cache_key] = (
                    self._safe_positive_float(duration_seconds) / 60.0
                )
