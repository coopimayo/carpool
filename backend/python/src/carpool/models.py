from dataclasses import dataclass, field


@dataclass(frozen=True)
class Location:
    latitude: float
    longitude: float


@dataclass(frozen=True)
class User:
    user_id: str
    name: str
    location: Location


@dataclass(frozen=True)
class Passenger(User):
    seats_required: int = 1


@dataclass(frozen=True)
class Driver(User):
    capacity: int = 4


@dataclass
class Route:
    driver: Driver
    passengers: list[Passenger] = field(default_factory=list)
    pickup_order: list[Passenger] = field(default_factory=list)
    total_distance_km: float = 0.0
    unfilled_seats: int = 0
