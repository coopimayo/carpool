import os

import requests

from carpool.models import Location
from carpool.providers.base import DistanceProvider


class OSRMProvider(DistanceProvider):
    """OSRM (Open Source Routing Machine) provider for real-world distances."""

    def __init__(self, base_url: str | None = None, timeout: float = 10.0):
        self.base_url = base_url or os.getenv("OSRM_URL", "http://localhost:5000")
        self.timeout = timeout

    def distance_km(self, origin: Location, destination: Location) -> float:
        """Get distance between two locations via OSRM."""
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
                return distance_m / 1000.0
        except Exception:
            pass
        return 0.0

    def matrix_distances_km(
        self, origins: list[Location], destinations: list[Location]
    ) -> list[list[float]]:
        """Get distance matrix via OSRM."""
        coords = ";".join(
            [f"{loc.longitude},{loc.latitude}" for loc in origins + destinations]
        )
        url = (
            f"{self.base_url}/table/v1/driving/{coords}?"
            f"sources={','.join(str(i) for i in range(len(origins)))}&"
            f"destinations={','.join(str(i) for i in range(len(origins), len(origins) + len(destinations)))}"
        )
        try:
            response = requests.get(url, timeout=self.timeout)
            response.raise_for_status()
            data = response.json()
            if data["code"] == "Ok":
                matrix = data["distances"]
                return [[d / 1000.0 for d in row] for row in matrix]
        except Exception:
            pass
        return [[0.0] * len(destinations) for _ in origins]
