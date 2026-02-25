from carpool.assignment import assign_passengers_to_drivers
from carpool.models import Driver, Location, Passenger
from carpool.providers.haversine import HaversineProvider
from carpool.providers.osrm import OSRMProvider


def melbourne_scenario() -> tuple[Location, list[Driver], list[Passenger]]:
    destination = Location(-37.7987, 144.9557)

    drivers = [
        Driver("d1", "Driver A - Flinders Street Station", Location(-37.8183, 144.9671), capacity=4),
        Driver("d2", "Driver B - Southern Cross Station", Location(-37.8184, 144.9526), capacity=4),
        Driver("d3", "Driver C - Queen Victoria Market", Location(-37.8076, 144.9568), capacity=4),
        Driver("d4", "Driver D - Richmond Station", Location(-37.8241, 144.9989), capacity=4),
        Driver("d5", "Driver E - St Kilda Junction", Location(-37.8677, 144.9802), capacity=4),
    ]

    passengers = [
        Passenger("p1", "120 Collins St, Melbourne VIC 3000", Location(-37.8157, 144.9691)),
        Passenger("p2", "200 Bourke St, Melbourne VIC 3000", Location(-37.8127, 144.9654)),
        Passenger("p3", "367 Collins St, Melbourne VIC 3000", Location(-37.8175, 144.9581)),
        Passenger("p4", "330 Collins St, Melbourne VIC 3000", Location(-37.8170, 144.9602)),
        Passenger("p5", "727 Collins St, Docklands VIC 3008", Location(-37.8203, 144.9497)),
        Passenger("p6", "1 Exhibition St, Melbourne VIC 3000", Location(-37.8130, 144.9730)),
        Passenger("p7", "500 Swanston St, Melbourne VIC 3000", Location(-37.8075, 144.9632)),
        Passenger("p8", "234 La Trobe St, Melbourne VIC 3000", Location(-37.8109, 144.9639)),
        Passenger("p9", "8 Nicholson St, East Melbourne VIC 3002", Location(-37.8108, 144.9717)),
        Passenger("p10", "2 Wellington Parade, East Melbourne VIC 3002", Location(-37.8186, 144.9834)),
        Passenger("p11", "252 Flinders St, Melbourne VIC 3000", Location(-37.8177, 144.9691)),
        Passenger("p12", "18 Albert Rd, South Melbourne VIC 3205", Location(-37.8364, 144.9745)),
        Passenger("p13", "10 Chapel St, South Yarra VIC 3141", Location(-37.8505, 144.9932)),
        Passenger("p14", "12 Clarendon St, Southbank VIC 3006", Location(-37.8263, 144.9598)),
        Passenger("p15", "89 A'Beckett St, Melbourne VIC 3000", Location(-37.8100, 144.9555)),
    ]

    return destination, drivers, passengers


def print_routes(label: str, drivers: list[Driver], passengers: list[Passenger], routes: list, unassigned: list[Passenger]) -> None:
    print(f"\n=== {label} ===")
    print(f"Drivers: {len(drivers)}")
    print(f"Passengers: {len(passengers)}")
    print(f"Assigned: {sum(len(route.passengers) for route in routes)}")
    print(f"Unassigned: {len(unassigned)}\n")

    for route in routes:
        ordered_names = [passenger.name for passenger in route.pickup_order]
        print(
            f"Driver={route.driver.name} passengers={len(route.passengers)} "
            f"order={ordered_names} distance_km={route.total_distance_km:.2f} "
            f"travel_time_min={route.total_travel_time_minutes:.1f}"
        )


def validate_with_haversine() -> None:
    destination, drivers, passengers = melbourne_scenario()

    provider = HaversineProvider()
    routes, unassigned = assign_passengers_to_drivers(
        drivers, passengers, destination, provider=provider
    )

    print_routes("HAVERSINE PROVIDER (MELBOURNE)", drivers, passengers, routes, unassigned)


def validate_with_osrm() -> None:
    destination, drivers, passengers = melbourne_scenario()

    provider = OSRMProvider()
    routes, unassigned = assign_passengers_to_drivers(
        drivers, passengers, destination, provider=provider
    )

    print_routes("OSRM PROVIDER (MELBOURNE)", drivers, passengers, routes, unassigned)


if __name__ == "__main__":
    validate_with_haversine()
    try:
        validate_with_osrm()
    except Exception as e:
        print(f"\nOSRM provider error (ensure docker-compose is running): {e}")
