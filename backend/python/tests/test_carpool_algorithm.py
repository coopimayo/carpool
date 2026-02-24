from carpool.assignment import assign_passengers_to_drivers
from carpool.distance import haversine_km
from carpool.models import Driver, Location, Passenger
from carpool.tsp import nearest_neighbor_tsp


def test_haversine_distance_between_london_and_paris_is_reasonable() -> None:
    london = Location(latitude=51.5074, longitude=-0.1278)
    paris = Location(latitude=48.8566, longitude=2.3522)

    distance = haversine_km(london, paris)

    assert 330 <= distance <= 350


def test_nearest_neighbor_tsp_orders_points_by_closest_next_stop() -> None:
    start = Location(0.0, 0.0)
    stops = [
        Location(0.0, 2.0),
        Location(0.0, 1.0),
        Location(0.0, 3.0),
    ]

    ordered = nearest_neighbor_tsp(start, stops)

    assert ordered == [
        Location(0.0, 1.0),
        Location(0.0, 2.0),
        Location(0.0, 3.0),
    ]


def test_greedy_assignment_assigns_all_possible_passengers_with_capacity_limits() -> None:
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

    routes, unassigned = assign_passengers_to_drivers(drivers, passengers)

    assert len(routes) == 2
    assert sum(len(route.passengers) for route in routes) == 4
    assert len(unassigned) == 1
    assert unassigned[0].user_id == "p5"
