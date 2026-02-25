from carpool.models import Driver, Location, Passenger, Route
from carpool.providers.base import DistanceProvider
from carpool.providers.haversine import HaversineProvider
from carpool.tsp import nearest_neighbor_tsp


def route_metrics(
    stops: list[Location], provider: DistanceProvider
) -> tuple[float, float]:
    if len(stops) < 2:
        return 0.0, 0.0

    total_distance_km = 0.0
    total_travel_time_minutes = 0.0
    for index in range(len(stops) - 1):
        origin = stops[index]
        destination = stops[index + 1]
        total_distance_km += provider.distance_km(origin, destination)
        total_travel_time_minutes += provider.travel_time_minutes(origin, destination)

    return total_distance_km, total_travel_time_minutes


def assign_passengers_to_drivers(
    drivers: list[Driver],
    passengers: list[Passenger],
    destination: Location | None = None,
    provider: DistanceProvider | None = None,
) -> tuple[list[Route], list[Passenger]]:
    if provider is None:
        provider = HaversineProvider()

    remaining_passengers = passengers.copy()
    routes: list[Route] = []

    for driver in sorted(drivers, key=lambda item: item.capacity, reverse=True):
        assigned: list[Passenger] = []
        seats_taken = 0
        anchor = driver.location

        while remaining_passengers and seats_taken < driver.capacity:
            fitting_passengers = [
                passenger
                for passenger in remaining_passengers
                if seats_taken + passenger.seats_required <= driver.capacity
            ]
            if not fitting_passengers:
                break

            nearest = min(
                fitting_passengers,
                key=lambda passenger: provider.travel_time_minutes(
                    anchor, passenger.location
                ),
            )
            assigned.append(nearest)
            remaining_passengers.remove(nearest)
            seats_taken += nearest.seats_required
            anchor = nearest.location

        ordered_pickups = nearest_neighbor_tsp(
            driver.location,
            [passenger.location for passenger in assigned],
            provider=provider,
        )

        pickup_order: list[Passenger] = []
        unmatched = assigned.copy()
        for location in ordered_pickups:
            for passenger in unmatched:
                if passenger.location == location:
                    pickup_order.append(passenger)
                    unmatched.remove(passenger)
                    break

        route_stops = [driver.location, *[p.location for p in pickup_order]]
        if destination:
            route_stops.append(destination)

        total_distance_km, total_travel_time_minutes = route_metrics(
            route_stops, provider
        )

        routes.append(
            Route(
                driver=driver,
                passengers=assigned,
                pickup_order=pickup_order,
                total_distance_km=total_distance_km,
                total_travel_time_minutes=total_travel_time_minutes,
                unfilled_seats=driver.capacity - seats_taken,
            )
        )

    return routes, remaining_passengers
