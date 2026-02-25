from abc import ABC, abstractmethod

from carpool.models import Location


class DistanceProvider(ABC):
    """Abstract base for distance calculation providers."""

    @abstractmethod
    def distance_km(self, origin: Location, destination: Location) -> float:
        """Calculate distance between two locations in km."""
        pass

    @abstractmethod
    def matrix_distances_km(
        self, origins: list[Location], destinations: list[Location]
    ) -> list[list[float]]:
        """Calculate distance matrix for multiple origins and destinations."""
        pass

    @abstractmethod
    def travel_time_minutes(self, origin: Location, destination: Location) -> float:
        """Calculate travel time between two locations in minutes."""
        pass

    @abstractmethod
    def matrix_travel_times_minutes(
        self, origins: list[Location], destinations: list[Location]
    ) -> list[list[float]]:
        """Calculate travel time matrix for multiple origins and destinations."""
        pass
