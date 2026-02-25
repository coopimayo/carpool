from unittest.mock import MagicMock, patch

import pytest
import requests

from carpool.assignment import assign_passengers_to_drivers
from carpool.models import Driver, Location, Passenger
from carpool.providers.haversine import HaversineProvider
from carpool.providers.osrm import OSRMProvider
from carpool.tsp import nearest_neighbor_tsp


class TestHaversineProvider:
    """Test Haversine distance provider."""

    def test_distance_between_london_and_paris_is_reasonable(self) -> None:
        london = Location(latitude=51.5074, longitude=-0.1278)
        paris = Location(latitude=48.8566, longitude=2.3522)

        provider = HaversineProvider()
        distance = provider.distance_km(london, paris)

        assert 330 <= distance <= 350

    def test_distance_same_location_is_zero(self) -> None:
        loc = Location(latitude=40.0, longitude=-74.0)
        provider = HaversineProvider()
        distance = provider.distance_km(loc, loc)

        assert distance == 0.0

    def test_distance_antipodal_points(self) -> None:
        north_pole = Location(latitude=90.0, longitude=0.0)
        south_pole = Location(latitude=-90.0, longitude=0.0)

        provider = HaversineProvider()
        distance = provider.distance_km(north_pole, south_pole)

        assert 20000 <= distance <= 20040

    def test_matrix_distances_2x2(self) -> None:
        origins = [Location(0.0, 0.0), Location(1.0, 1.0)]
        destinations = [Location(0.0, 1.0), Location(1.0, 0.0)]

        provider = HaversineProvider()
        matrix = provider.matrix_distances_km(origins, destinations)

        assert len(matrix) == 2
        assert len(matrix[0]) == 2
        assert len(matrix[1]) == 2
        assert all(isinstance(d, float) for row in matrix for d in row)

    def test_matrix_distances_empty_destinations(self) -> None:
        origins = [Location(0.0, 0.0)]
        destinations: list[Location] = []

        provider = HaversineProvider()
        matrix = provider.matrix_distances_km(origins, destinations)

        assert matrix == [[]]

    def test_matrix_distances_empty_origins(self) -> None:
        origins: list[Location] = []
        destinations = [Location(0.0, 1.0)]

        provider = HaversineProvider()
        matrix = provider.matrix_distances_km(origins, destinations)

        assert matrix == []


class TestOSRMProvider:
    """Test OSRM distance provider with mocked responses."""

    @patch("carpool.providers.osrm.requests.get")
    def test_distance_valid_response(self, mock_get: MagicMock) -> None:
        mock_response = MagicMock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {
            "code": "Ok",
            "routes": [{"distance": 340000}],  # 340 km
        }
        mock_get.return_value = mock_response

        provider = OSRMProvider()
        distance = provider.distance_km(
            Location(51.5074, -0.1278), Location(48.8566, 2.3522)
        )

        assert 339 <= distance <= 341
        assert mock_get.called

    @patch("carpool.providers.osrm.requests.get")
    def test_distance_uses_cache_for_repeated_pair(self, mock_get: MagicMock) -> None:
        mock_response = MagicMock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {
            "code": "Ok",
            "routes": [{"distance": 120000}],
        }
        mock_get.return_value = mock_response

        provider = OSRMProvider()
        origin = Location(0.0, 0.0)
        destination = Location(1.0, 1.0)

        first = provider.distance_km(origin, destination)
        second = provider.distance_km(origin, destination)

        assert first == second == 120.0
        assert mock_get.call_count == 1

    @patch("carpool.providers.osrm.requests.get")
    def test_distance_osrm_no_route_found(self, mock_get: MagicMock) -> None:
        mock_get.return_value.json.return_value = {"code": "NoRoute", "routes": []}

        provider = OSRMProvider()
        distance = provider.distance_km(
            Location(0.0, 0.0), Location(90.0, 180.0)
        )

        assert distance == 0.0

    @patch("carpool.providers.osrm.requests.get")
    def test_distance_connection_error_returns_zero(self, mock_get: MagicMock) -> None:
        mock_get.side_effect = requests.ConnectionError("Connection refused")

        provider = OSRMProvider()
        distance = provider.distance_km(
            Location(0.0, 0.0), Location(1.0, 1.0)
        )

        assert distance == 0.0

    @patch("carpool.providers.osrm.requests.get")
    def test_distance_timeout_returns_zero(self, mock_get: MagicMock) -> None:
        mock_get.side_effect = requests.Timeout("Request timed out")

        provider = OSRMProvider()
        distance = provider.distance_km(
            Location(0.0, 0.0), Location(1.0, 1.0)
        )

        assert distance == 0.0

    @patch("carpool.providers.osrm.requests.get")
    def test_distance_http_error_returns_zero(self, mock_get: MagicMock) -> None:
        mock_get.return_value.raise_for_status.side_effect = requests.HTTPError("500")

        provider = OSRMProvider()
        distance = provider.distance_km(
            Location(0.0, 0.0), Location(1.0, 1.0)
        )

        assert distance == 0.0

    @patch("carpool.providers.osrm.requests.get")
    def test_distance_malformed_json_returns_zero(self, mock_get: MagicMock) -> None:
        mock_get.return_value.json.side_effect = ValueError("Invalid JSON")

        provider = OSRMProvider()
        distance = provider.distance_km(
            Location(0.0, 0.0), Location(1.0, 1.0)
        )

        assert distance == 0.0

    @patch("carpool.providers.osrm.requests.get")
    def test_matrix_distances_connection_error(self, mock_get: MagicMock) -> None:
        mock_get.side_effect = requests.ConnectionError("Connection refused")

        provider = OSRMProvider()
        origins = [Location(0.0, 0.0)]
        destinations = [Location(1.0, 1.0)]
        matrix = provider.matrix_distances_km(origins, destinations)

        assert matrix == [[0.0]]

    @patch("carpool.providers.osrm.requests.get")
    def test_matrix_distances_uses_cache_for_repeated_call(
        self, mock_get: MagicMock
    ) -> None:
        mock_response = MagicMock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {
            "code": "Ok",
            "distances": [[111000, 222000], [333000, 444000]],
        }
        mock_get.return_value = mock_response

        provider = OSRMProvider()
        origins = [Location(0.0, 0.0), Location(1.0, 1.0)]
        destinations = [Location(2.0, 2.0), Location(3.0, 3.0)]

        first = provider.matrix_distances_km(origins, destinations)
        second = provider.matrix_distances_km(origins, destinations)

        assert first == second
        assert first == [[111.0, 222.0], [333.0, 444.0]]
        assert mock_get.call_count == 1

    @patch("carpool.providers.osrm.requests.get")
    def test_matrix_distances_reuses_cached_single_pair(
        self, mock_get: MagicMock
    ) -> None:
        route_response = MagicMock()
        route_response.raise_for_status.return_value = None
        route_response.json.return_value = {
            "code": "Ok",
            "routes": [{"distance": 150000}],
        }

        matrix_response = MagicMock()
        matrix_response.raise_for_status.return_value = None
        matrix_response.json.return_value = {
            "code": "Ok",
            "distances": [[250000]],
        }

        mock_get.side_effect = [route_response, matrix_response]

        provider = OSRMProvider()
        origin_a = Location(0.0, 0.0)
        destination_a = Location(1.0, 1.0)
        destination_b = Location(2.0, 2.0)

        provider.distance_km(origin_a, destination_a)
        matrix = provider.matrix_distances_km([origin_a], [destination_a, destination_b])

        assert matrix == [[150.0, 250.0]]
        assert mock_get.call_count == 2

    @patch("carpool.providers.osrm.requests.get")
    def test_matrix_distances_empty_origins(self, mock_get: MagicMock) -> None:
        provider = OSRMProvider()
        origins: list[Location] = []
        destinations = [Location(1.0, 1.0)]
        matrix = provider.matrix_distances_km(origins, destinations)

        assert matrix == []
        assert not mock_get.called

    @patch("carpool.providers.osrm.requests.get")
    def test_matrix_distances_empty_destinations(self, mock_get: MagicMock) -> None:
        provider = OSRMProvider()
        origins = [Location(0.0, 0.0)]
        destinations: list[Location] = []
        matrix = provider.matrix_distances_km(origins, destinations)

        assert matrix == [[]]
        assert not mock_get.called

    def test_osrm_custom_base_url(self) -> None:
        provider = OSRMProvider(base_url="http://custom-osrm:5000")
        assert provider.base_url == "http://custom-osrm:5000"

    def test_osrm_timeout_configuration(self) -> None:
        provider = OSRMProvider(timeout=30.0)
        assert provider.timeout == 30.0


class TestTSPWithProviders:
    """Test TSP solver with different providers."""

    def test_nearest_neighbor_tsp_with_haversine(self) -> None:
        start = Location(0.0, 0.0)
        stops = [
            Location(0.0, 2.0),
            Location(0.0, 1.0),
            Location(0.0, 3.0),
        ]

        provider = HaversineProvider()
        ordered = nearest_neighbor_tsp(start, stops, provider=provider)

        assert ordered == [
            Location(0.0, 1.0),
            Location(0.0, 2.0),
            Location(0.0, 3.0),
        ]

    def test_nearest_neighbor_tsp_empty_stops(self) -> None:
        start = Location(0.0, 0.0)
        stops: list[Location] = []

        provider = HaversineProvider()
        ordered = nearest_neighbor_tsp(start, stops, provider=provider)

        assert ordered == []

    def test_nearest_neighbor_tsp_single_stop(self) -> None:
        start = Location(0.0, 0.0)
        stops = [Location(1.0, 1.0)]

        provider = HaversineProvider()
        ordered = nearest_neighbor_tsp(start, stops, provider=provider)

        assert ordered == [Location(1.0, 1.0)]

    @patch("carpool.providers.osrm.requests.get")
    def test_nearest_neighbor_tsp_with_osrm(self, mock_get: MagicMock) -> None:
        mock_get.side_effect = [
            MagicMock(json=lambda: {"code": "Ok", "routes": [{"distance": 111000}]}),
            MagicMock(json=lambda: {"code": "Ok", "routes": [{"distance": 111000}]}),
            MagicMock(json=lambda: {"code": "Ok", "routes": [{"distance": 222000}]}),
        ]

        start = Location(0.0, 0.0)
        stops = [Location(1.0, 1.0), Location(2.0, 2.0)]

        provider = OSRMProvider()
        ordered = nearest_neighbor_tsp(start, stops, provider=provider)

        assert len(ordered) == 2


class TestAssignmentWithProviders:
    """Test passenger assignment with different providers."""

    def test_greedy_assignment_with_haversine(self) -> None:
        drivers = [
            Driver("d1", "Driver A", Location(0.0, 0.0), capacity=2),
            Driver("d2", "Driver B", Location(1.0, 1.0), capacity=2),
        ]
        passengers = [
            Passenger("p1", "P1", Location(0.0, 0.1)),
            Passenger("p2", "P2", Location(0.0, 0.2)),
            Passenger("p3", "P3", Location(1.1, 1.0)),
            Passenger("p4", "P4", Location(1.2, 1.0)),
            Passenger("p5", "P5", Location(8.0, 8.0)),
        ]

        provider = HaversineProvider()
        routes, unassigned = assign_passengers_to_drivers(
            drivers, passengers, provider=provider
        )

        assert len(routes) == 2
        assert sum(len(route.passengers) for route in routes) == 4
        assert len(unassigned) == 1

    def test_greedy_assignment_no_drivers(self) -> None:
        drivers: list[Driver] = []
        passengers = [Passenger("p1", "P1", Location(0.0, 0.1))]

        provider = HaversineProvider()
        routes, unassigned = assign_passengers_to_drivers(
            drivers, passengers, provider=provider
        )

        assert len(routes) == 0
        assert len(unassigned) == 1

    def test_greedy_assignment_no_passengers(self) -> None:
        drivers = [Driver("d1", "Driver A", Location(0.0, 0.0), capacity=4)]
        passengers: list[Passenger] = []

        provider = HaversineProvider()
        routes, unassigned = assign_passengers_to_drivers(
            drivers, passengers, provider=provider
        )

        assert len(routes) == 1
        assert len(routes[0].passengers) == 0
        assert len(unassigned) == 0

    def test_greedy_assignment_passenger_needs_multiple_seats(self) -> None:
        drivers = [
            Driver("d1", "Driver A", Location(0.0, 0.0), capacity=4),
        ]
        passengers = [
            Passenger("p1", "P1", Location(0.0, 0.1), seats_required=2),
            Passenger("p2", "P2", Location(0.0, 0.2), seats_required=2),
            Passenger("p3", "P3", Location(0.0, 0.3), seats_required=1),
        ]

        provider = HaversineProvider()
        routes, unassigned = assign_passengers_to_drivers(
            drivers, passengers, provider=provider
        )

        assert len(routes) == 1
        assert len(routes[0].passengers) == 2
        assert len(unassigned) == 1

    def test_greedy_assignment_with_destination(self) -> None:
        drivers = [Driver("d1", "Driver A", Location(0.0, 0.0), capacity=4)]
        passengers = [Passenger("p1", "P1", Location(0.1, 0.1))]
        destination = Location(1.0, 1.0)

        provider = HaversineProvider()
        routes, unassigned = assign_passengers_to_drivers(
            drivers, passengers, destination=destination, provider=provider
        )

        assert len(routes) == 1
        assert routes[0].total_distance_km > 0

    def test_greedy_assignment_unfilled_seats_tracked(self) -> None:
        drivers = [
            Driver("d1", "Driver A", Location(0.0, 0.0), capacity=4),
        ]
        passengers = [
            Passenger("p1", "P1", Location(0.0, 0.1)),
        ]

        provider = HaversineProvider()
        routes, _ = assign_passengers_to_drivers(drivers, passengers, provider=provider)

        assert len(routes) == 1
        assert routes[0].unfilled_seats == 3
