import {
    AIRCRAFT_TYPES,
    CONFLICT_SAMPLE_MINUTES,
    DIFFICULTY_CONFIG,
    FLIGHT_LEVELS,
    HORIZONTAL_SEPARATION_NM,
    OFFSCREEN_MARGIN_RATIO,
    OFFSCREEN_TRAFFIC_CHANCE,
    RADAR_PADDING_PX,
    VERTICAL_SEPARATION_FT,
} from "./constants.js";
import { createAircraft, assignVerticalClearance, generateCallsign } from "./aircraft.js";
import {
    chance,
    altitudeFeetAt,
    bearingDegrees,
    distanceNm,
    isInsideBounds,
    normalizeHeading,
    projectPoint,
    randomBetween,
    randomChoice,
    randomInt,
    randomStep,
    round,
} from "./utils.js";

const PAIR_ATTEMPTS = 300;
const DISTRACTOR_ATTEMPTS = 1200;
const SCENARIO_ATTEMPTS = 30;

export function predictConflict(a, b, lookaheadMinutes) {
    let firstLossTime = null;
    let best = {
        horizontalNm: Infinity,
        verticalFt: Infinity,
        timeMinutes: 0,
    };

    for (let time = 0; time <= lookaheadMinutes + 1e-9; time += CONFLICT_SAMPLE_MINUTES) {
        const pointA = projectPoint(a.x, a.y, a.heading, a.speedKts, time);
        const pointB = projectPoint(b.x, b.y, b.heading, b.speedKts, time);
        const horizontalNm = distanceNm(pointA, pointB);
        const verticalFt = Math.abs(altitudeFeetAt(a, time) - altitudeFeetAt(b, time));

        if (horizontalNm < best.horizontalNm) {
            best = { horizontalNm, verticalFt, timeMinutes: time };
        }

        if (
            firstLossTime === null &&
            horizontalNm < HORIZONTAL_SEPARATION_NM &&
            verticalFt < VERTICAL_SEPARATION_FT
        ) {
            firstLossTime = time;
        }
    }

    return {
        willConflict: firstLossTime !== null,
        firstLossMinutes: firstLossTime === null ? null : round(firstLossTime, 1),
        cpaMinutes: round(best.timeMinutes, 1),
        cpaHorizontalNm: round(best.horizontalNm, 1),
        cpaVerticalFt: Math.round(best.verticalFt / 100) * 100,
    };
}

export function findPredictedConflicts(aircraft, lookaheadMinutes) {
    const conflicts = [];
    for (let i = 0; i < aircraft.length; i += 1) {
        for (let j = i + 1; j < aircraft.length; j += 1) {
            const prediction = predictConflict(aircraft[i], aircraft[j], lookaheadMinutes);
            if (prediction.willConflict) {
                conflicts.push({
                    aircraftA: aircraft[i],
                    aircraftB: aircraft[j],
                    ...prediction,
                });
            }
        }
    }
    return conflicts.sort((a, b) => a.firstLossMinutes - b.firstLossMinutes);
}

function pairKey(a, b) {
    return [a.id, b.id].sort().join("|");
}

function hasConflictWithAny(candidate, existing, lookaheadMinutes) {
    return existing.some((other) => predictConflict(candidate, other, lookaheadMinutes).willConflict);
}

function chooseConflictFlightLevel() {
    // High enough to resemble an en-route display while still allowing regional aircraft.
    return randomChoice(FLIGHT_LEVELS.filter((level) => level >= 240 && level <= 390));
}

function createIntentionalPair(bounds, config, existingAircraft) {
    for (let attempt = 0; attempt < PAIR_ATTEMPTS; attempt += 1) {
        const timeToConflict = randomStep(config.conflictTimeRange[0], config.conflictTimeRange[1], 0.5);
        const headingA = randomBetween(0, 360);
        const crossingAngle = randomBetween(config.crossingAngleRange[0], config.crossingAngleRange[1]);
        const headingB = normalizeHeading(headingA + (chance(0.5) ? crossingAngle : -crossingAngle));
        const flightLevel = chooseConflictFlightLevel();

        const aircraftA = createAircraft(bounds, RADAR_PADDING_PX, {
            flightLevel,
            heading: headingA,
            verticalRateFpm: 0,
        });
        const aircraftB = createAircraft(bounds, RADAR_PADDING_PX, {
            flightLevel,
            heading: headingB,
            verticalRateFpm: 0,
        });

        const conflictPoint = {
            x: randomBetween(RADAR_PADDING_PX + 40, bounds.width - RADAR_PADDING_PX - 40),
            y: randomBetween(RADAR_PADDING_PX + 40, bounds.height - RADAR_PADDING_PX - 40),
        };

        const futureA = projectPoint(0, 0, aircraftA.heading, aircraftA.speedKts, timeToConflict);
        const futureB = projectPoint(0, 0, aircraftB.heading, aircraftB.speedKts, timeToConflict);
        aircraftA.x = conflictPoint.x - futureA.x;
        aircraftA.y = conflictPoint.y - futureA.y;
        aircraftB.x = conflictPoint.x - futureB.x;
        aircraftB.y = conflictPoint.y - futureB.y;

        if (!isInsideBounds(aircraftA, bounds, RADAR_PADDING_PX)) continue;
        if (!isInsideBounds(aircraftB, bounds, RADAR_PADDING_PX)) continue;
        if (distanceNm(aircraftA, aircraftB) < HORIZONTAL_SEPARATION_NM + 2) continue;

        const plannedPrediction = predictConflict(aircraftA, aircraftB, config.lookaheadMinutes);
        if (!plannedPrediction.willConflict) continue;
        if (hasConflictWithAny(aircraftA, existingAircraft, config.lookaheadMinutes)) continue;
        if (hasConflictWithAny(aircraftB, existingAircraft, config.lookaheadMinutes)) continue;

        return [aircraftA, aircraftB];
    }

    throw new Error("Unable to place an intentional conflict pair within the radar bounds");
}

function createDistractor(bounds, config, existingAircraft) {
    for (let attempt = 0; attempt < DISTRACTOR_ATTEMPTS; attempt += 1) {
        const aircraft = createAircraft(bounds, RADAR_PADDING_PX, { verticalRateFpm: 0 });

        if (!existingAircraft.some(a => !isInsideBounds(a, bounds)) && chance(OFFSCREEN_TRAFFIC_CHANCE)) {
            const marginX = bounds.width * OFFSCREEN_MARGIN_RATIO;
            const marginY = bounds.height * OFFSCREEN_MARGIN_RATIO;
            const side = randomInt(0, 3);
            if (side === 0) aircraft.x = randomBetween(-marginX, -RADAR_PADDING_PX);
            if (side === 1) aircraft.x = randomBetween(bounds.width + RADAR_PADDING_PX, bounds.width + marginX);
            if (side === 2) aircraft.y = randomBetween(-marginY, -RADAR_PADDING_PX);
            if (side === 3) aircraft.y = randomBetween(bounds.height + RADAR_PADDING_PX, bounds.height + marginY);
            aircraft.heading = bearingDegrees(aircraft, { x: bounds.width / 2, y: bounds.height / 2 });
        }

        if (chance(config.verticalTrafficChance)) {
            const direction = chance(0.5) ? -1 : 1;
            const maxRate = AIRCRAFT_TYPES[aircraft.aircraftType].maxVerticalRateFpm;
            const rates = [500, 1000, 1500].filter((rate) => rate <= maxRate);
            assignVerticalClearance(aircraft, direction * randomChoice(rates));
        } else {
            aircraft.verticalRateFpm = 0;
        }

        const tooCloseNow = existingAircraft.some(
            (other) => distanceNm(aircraft, other) < HORIZONTAL_SEPARATION_NM + 1 &&
                Math.abs(aircraft.flightLevel - other.flightLevel) < 10
        );
        if (tooCloseNow) continue;
        if (hasConflictWithAny(aircraft, existingAircraft, config.lookaheadMinutes)) continue;

        return aircraft;
    }

    throw new Error("Unable to place non-conflicting background traffic");
}

function validateScenario(aircraft, intentionalPairs, config) {
    const predicted = findPredictedConflicts(aircraft, config.lookaheadMinutes);
    if (predicted.length !== intentionalPairs.length) return null;

    const predictedKeys = new Set(predicted.map((conflict) => pairKey(conflict.aircraftA, conflict.aircraftB)));
    const intentionalKeys = intentionalPairs.map(([a, b]) => pairKey(a, b));
    if (!intentionalKeys.every((key) => predictedKeys.has(key))) return null;
    return predicted;
}

export function generateScenario(difficulty, bounds) {
    const config = DIFFICULTY_CONFIG[difficulty];
    if (!config) throw new Error(`Unsupported difficulty: ${difficulty}`);
    if (bounds.width <= RADAR_PADDING_PX * 2 || bounds.height <= RADAR_PADDING_PX * 2) {
        throw new Error("Radar display is too small to generate a scenario");
    }

    for (let scenarioAttempt = 0; scenarioAttempt < SCENARIO_ATTEMPTS; scenarioAttempt += 1) {
        try {
            const aircraft = [];
            const intentionalPairs = [];

            for (let i = 0; i < config.conflictPairs; i += 1) {
                const pair = createIntentionalPair(bounds, config, aircraft);
                aircraft.push(...pair);
                intentionalPairs.push(pair);
            }

            const targetAircraft = randomInt(config.aircraftRange[0], config.aircraftRange[1]);
            while (aircraft.length < targetAircraft) {
                aircraft.push(createDistractor(bounds, config, aircraft));
            }

            const conflicts = validateScenario(aircraft, intentionalPairs, config);
            if (!conflicts) continue;

            const callsigns = new Set();
            for (const plane of aircraft) {
                for (let retry = 0; callsigns.has(plane.callsign) && retry < 100; retry += 1) plane.callsign = generateCallsign();
                if (callsigns.has(plane.callsign)) throw new Error("Unable to generate unique callsigns");
                callsigns.add(plane.callsign);
            }

            return {
                difficulty,
                startUtcSeconds: randomInt(0, 1439) * 60,
                aircraft,
                conflicts,
                lookaheadMinutes: config.lookaheadMinutes,
                separation: {
                    horizontalNm: HORIZONTAL_SEPARATION_NM,
                    verticalFt: VERTICAL_SEPARATION_FT,
                },
            };
        } catch {
            // Retry the whole scene. All retry loops are bounded, so generation cannot hang.
        }
    }

    throw new Error(`Could not generate a valid ${difficulty} scenario after ${SCENARIO_ATTEMPTS} attempts`);
}
