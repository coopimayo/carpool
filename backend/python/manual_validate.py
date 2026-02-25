from carpool.assignment import assign_passengers_to_drivers
from carpool.models import Driver, Location, Passenger
from carpool.providers.haversine import HaversineProvider
from carpool.providers.osrm import OSRMProvider


def validate_with_haversine() -> None:
    destination = Location(40.73061, -73.935242)

    drivers = [
        Driver("d1", "Ana", Location(40.7128, -74.0060), capacity=4),
        Driver("d2", "Ben", Location(40.7580, -73.9855), capacity=4),
        Driver("d3", "Cara", Location(40.7300, -73.9900), capacity=4),
        Driver("d4", "Dev", Location(40.7000, -73.9500), capacity=4),
        Driver("d5", "Eli", Location(40.7400, -73.9700), capacity=4),
    ]

    passengers = [
        Passenger("p1", "P1", Location(40.7150, -74.0000)),
        Passenger("p2", "P2", Location(40.7180, -73.9950)),
        Passenger("p3", "P3", Location(40.7210, -73.9900)),
        Passenger("p4", "P4", Location(40.7240, -73.9850)),
        Passenger("p5", "P5", Location(40.7270, -73.9800)),
        Passenger("p6", "P6", Location(40.7300, -73.9750)),
        Passenger("p7", "P7", Location(40.7330, -73.9700)),
        Passenger("p8", "P8", Location(40.7360, -73.9650)),
        Passenger("p9", "P9", Location(40.7390, -73.9600)),
        Passenger("p10", "P10", Location(40.7420, -73.9550)),
        Passenger("p11", "P11", Location(40.7450, -73.9500)),
        Passenger("p12", "P12", Location(40.7480, -73.9450)),
        Passenger("p13", "P13", Location(40.7510, -73.9400)),
        Passenger("p14", "P14", Location(40.7540, -73.9350)),
        Passenger("p15", "P15", Location(40.7570, -73.9300)),
        Passenger("p16", "P16", Location(40.7600, -73.9250)),
        Passenger("p17", "P17", Location(40.7630, -73.9200)),
        Passenger("p18", "P18", Location(40.7660, -73.9150)),
        Passenger("p19", "P19", Location(40.7690, -73.9100)),
        Passenger("p20", "P20", Location(40.7720, -73.9050)),
        Passenger("p21", "P21", Location(40.7750, -73.9000)),
        Passenger("p22", "P22", Location(40.7780, -73.8950)),
    ]

    provider = HaversineProvider()
    routes, unassigned = assign_passengers_to_drivers(
        drivers, passengers, destination, provider=provider
    )

    print("\n=== HAVERSINE PROVIDER ===")
    print(f"Drivers: {len(drivers)}")
    print(f"Passengers: {len(passengers)}")
    print(f"Assigned: {sum(len(route.passengers) for route in routes)}")
    print(f"Unassigned: {len(unassigned)}\n")

    for route in routes:
        ordered_ids = [passenger.user_id for passenger in route.pickup_order]
        print(
            f"Driver={route.driver.user_id} passengers={len(route.passengers)} "
            f"order={ordered_ids} distance_km={route.total_distance_km:.2f} "
            f"travel_time_min={route.total_travel_time_minutes:.1f}"
        )


def validate_with_osrm() -> None:
    destination = Location(40.73061, -73.935242)

    drivers = [
        Driver("d1", "Ana", Location(40.7128, -74.0060), capacity=4),
        Driver("d2", "Ben", Location(40.7580, -73.9855), capacity=4),
        Driver("d3", "Cara", Location(40.7300, -73.9900), capacity=4),
        Driver("d4", "Dev", Location(40.7000, -73.9500), capacity=4),
        Driver("d5", "Eli", Location(40.7400, -73.9700), capacity=4),
    ]

    passengers = [
        Passenger("p1", "P1", Location(40.7150, -74.0000)),
        Passenger("p2", "P2", Location(40.7180, -73.9950)),
        Passenger("p3", "P3", Location(40.7210, -73.9900)),
        Passenger("p4", "P4", Location(40.7240, -73.9850)),
        Passenger("p5", "P5", Location(40.7270, -73.9800)),
        Passenger("p6", "P6", Location(40.7300, -73.9750)),
        Passenger("p7", "P7", Location(40.7330, -73.9700)),
        Passenger("p8", "P8", Location(40.7360, -73.9650)),
        Passenger("p9", "P9", Location(40.7390, -73.9600)),
        Passenger("p10", "P10", Location(40.7420, -73.9550)),
        Passenger("p11", "P11", Location(40.7450, -73.9500)),
        Passenger("p12", "P12", Location(40.7480, -73.9450)),
        Passenger("p13", "P13", Location(40.7510, -73.9400)),
        Passenger("p14", "P14", Location(40.7540, -73.9350)),
        Passenger("p15", "P15", Location(40.7570, -73.9300)),
        Passenger("p16", "P16", Location(40.7600, -73.9250)),
        Passenger("p17", "P17", Location(40.7630, -73.9200)),
        Passenger("p18", "P18", Location(40.7660, -73.9150)),
        Passenger("p19", "P19", Location(40.7690, -73.9100)),
        Passenger("p20", "P20", Location(40.7720, -73.9050)),
        Passenger("p21", "P21", Location(40.7750, -73.9000)),
        Passenger("p22", "P22", Location(40.7780, -73.8950)),
    ]

    provider = OSRMProvider()
    routes, unassigned = assign_passengers_to_drivers(
        drivers, passengers, destination, provider=provider
    )

    print("\n=== OSRM PROVIDER ===")
    print(f"Drivers: {len(drivers)}")
    print(f"Passengers: {len(passengers)}")
    print(f"Assigned: {sum(len(route.passengers) for route in routes)}")
    print(f"Unassigned: {len(unassigned)}\n")

    for route in routes:
        ordered_ids = [passenger.user_id for passenger in route.pickup_order]
        print(
            f"Driver={route.driver.user_id} passengers={len(route.passengers)} "
            f"order={ordered_ids} distance_km={route.total_distance_km:.2f} "
            f"travel_time_min={route.total_travel_time_minutes:.1f}"
        )


if __name__ == "__main__":
    validate_with_haversine()
    try:
        validate_with_osrm()
    except Exception as e:
        print(f"\nOSRM provider error (ensure docker-compose is running): {e}")
