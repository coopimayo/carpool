from carpool.assignment import assign_passengers_to_drivers
from carpool.models import Driver, Location, Passenger
from carpool.providers.haversine import HaversineProvider


def test_haversine_distance_between_london_and_paris_is_reasonable() -> None:
    london = Location(latitude=51.5074, longitude=-0.1278)
    paris = Location(latitude=48.8566, longitude=2.3522)

    provider = HaversineProvider()
    distance = provider.distance_km(london, paris)

    assert 330 <= distance <= 350


def test_haversine_matrix_distances() -> None:
    origins = [Location(0.0, 0.0), Location(1.0, 1.0)]
    destinations = [Location(0.0, 1.0), Location(1.0, 0.0)]

    provider = HaversineProvider()
    matrix = provider.matrix_distances_km(origins, destinations)

    assert len(matrix) == 2
    assert len(matrix[0]) == 2
    assert all(isinstance(d, float) for row in matrix for d in row)


def test_greedy_assignment_with_provider() -> None:
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
