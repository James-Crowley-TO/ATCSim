export function evaluateWarnings(scenario, warningIds = new Set()) {
    const required = new Map();
    for (const { aircraftA, aircraftB } of scenario.conflicts) {
        required.set(aircraftA.id, aircraftA);
        required.set(aircraftB.id, aircraftB);
    }
    const missingAircraft = [...required.values()].filter(aircraft => !warningIds.has(aircraft.id));
    return {
        passed: missingAircraft.length === 0,
        requiredCount: required.size,
        markedCount: required.size - missingAircraft.length,
        missingAircraft,
    };
}

