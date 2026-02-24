from .distance import haversine_km, route_distance_km
from .models import Driver, Location, Passenger, Route
from .tsp import nearest_neighbor_tsp


def assign_passengers_to_drivers(
    drivers: list[Driver],
    passengers: list[Passenger],
    destination: Location | None = None,
) -> tuple[list[Route], list[Passenger]]:
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
                key=lambda passenger: haversine_km(anchor, passenger.location),
            )
            assigned.append(nearest)
            remaining_passengers.remove(nearest)
            seats_taken += nearest.seats_required
            anchor = nearest.location

        ordered_pickups = nearest_neighbor_tsp(
            driver.location,
            [passenger.location for passenger in assigned],
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

        routes.append(
            Route(
                driver=driver,
                passengers=assigned,
                pickup_order=pickup_order,
                total_distance_km=route_distance_km(route_stops),
                unfilled_seats=driver.capacity - seats_taken,
            )
        )

    return routes, remaining_passengers
