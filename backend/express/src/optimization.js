const { query } = require('./db');

function optimizeAssignments(drivers, passengers) {
  const remainingPassengers = [...passengers];
  const routes = [];

  for (const driver of drivers) {
    const assignedPassengers = [];
    let seatsRemaining = driver.capacity;

    for (let index = 0; index < remainingPassengers.length;) {
      const passenger = remainingPassengers[index];
      if (passenger.seatsRequired <= seatsRemaining) {
        assignedPassengers.push(passenger);
        seatsRemaining -= passenger.seatsRequired;
        remainingPassengers.splice(index, 1);
      } else {
        index += 1;
      }
    }

    routes.push({
      driverId: driver.userId,
      driverName: driver.name,
      passengerIds: assignedPassengers.map((passenger) => passenger.userId),
      unfilledSeats: seatsRemaining,
    });
  }

  return {
    routes,
    unassignedPassengerIds: remainingPassengers.map((passenger) => passenger.userId),
  };
}

function buildOptimizationResult(resultId, assignment) {
  return {
    id: resultId,
    createdAt: new Date().toISOString(),
    status: 'completed',
    ...assignment,
  };
}

async function persistOptimizationResult(result) {
  await query(
    `
      INSERT INTO optimization_results (id, created_at, status, routes, unassigned_passenger_ids)
      VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
    `,
    [
      result.id,
      result.createdAt,
      result.status,
      JSON.stringify(result.routes),
      JSON.stringify(result.unassignedPassengerIds),
    ],
  );
}

module.exports = {
  optimizeAssignments,
  buildOptimizationResult,
  persistOptimizationResult,
};
