// Scenario generation functions
import {
  createAircraftInstance,
  isTooClose,
} from "./aircraft.js";
import { 
  nmToPx, 
  biasedRandom 
} from "./utils.js";

export function scenarioRandom(n, radarRangePx, currentScenario, addAircraftToScene) {
  const pad = 50;
  let placed = 0;

  for (let i = 0; i < n; i++) {
    let aircraft;
    let safe;
    let attempts = 0;

    do {
      aircraft = createAircraftInstance(radarRangePx, pad);
      safe =
        currentScenario.aircraft.length === 0 ||
        currentScenario.aircraft.every(
          (a) => !isTooClose(a.aircraftIn, aircraft)
        );
      attempts++;
      if (attempts > 100) {
        console.warn(
          `Could not place aircraft ${i + 1} safely in random scenario`
        );
        return placed;
      }
    } while (!safe);

    addAircraftToScene(aircraft);
    placed++;
  }

  return placed;
}

export function scenarioConflict(n, radarRangePx, addAircraftToScene) {
  const pad = 50;
  let placed = 0;

  while (true) {
    try {
      for (let i = 0; i < n; i++) {

        // Time until conflict in minutes
        const timeOfConflict = Math.random() * 5 + 1; 

        // Pick a random place for the conflict in pxls
        const conflictLon = Math.round(biasedRandom() * radarRangePx);
        const conflictLat = Math.round(biasedRandom() * radarRangePx);

        // Generate both aircraft's bearing, heading and speed
        const bearing_A = Math.round(Math.random() * 360);
        let bearing_B = Math.round(Math.random() * 180 + (bearing_A > 180 ? 180 : 0));
        
        // Place them in trail if within 15 degrees
        if (Math.abs(bearing_B - bearing_A) < 15) {
          bearing_B = bearing_A;
        } 
        
        const heading_A = (bearing_A + 180) % 360;
        const heading_B = (bearing_B + 180) % 360;

        // Speed in 10's of knts
        const speed_A = Math.round(Math.random() * 20 + 25);
        const speed_B = Math.round(Math.random() * 20 + 25);

        // Generate the effective speed of B given 5nm constraint
        const c = 
          (30/timeOfConflict)**2 - (speed_A * Math.sin(Math.PI / 180 * (bearing_A - bearing_B))) ** 2;
        const L = speed_A * Math.cos(Math.PI / 180 * (bearing_A - bearing_B)) - Math.sqrt(c);
        const U = L + 2 * Math.sqrt(c);

        const speed_B_eff = c > 0 ? ((speed_B < L || speed_B > U) ? speed_B : Math.ceil(U)) : speed_B;

        // The distance of each plane to the conflict in pxls
        const distance_A = Math.round(nmToPx(speed_A / 6  * timeOfConflict));
        const distance_B = Math.round(nmToPx(speed_B_eff / 6  * timeOfConflict));

        const toScreenRad = (deg) => (deg - 90) * Math.PI / 180

        // The lat/lon of each plane in pxls (range*bearing from conflict point + location of conflict point)
        const lon_A = conflictLon + distance_A * Math.cos(toScreenRad(bearing_A));
        const lat_A = conflictLat + distance_A * Math.sin(toScreenRad(bearing_A));
        const lon_B = conflictLon + distance_B * Math.cos(toScreenRad(bearing_B));
        const lat_B = conflictLat + distance_B * Math.sin(toScreenRad(bearing_B));

        // Check if within bounds
        if (
          lon_A < pad ||
          lon_A > radarRangePx - pad ||
          lat_A < pad ||
          lat_A > radarRangePx - pad ||
          lon_B < pad ||
          lon_B > radarRangePx - pad ||
          lat_B < pad ||
          lat_B > radarRangePx - pad
        ) {
          throw new Error(`Conflicting aircraft would be out of bounds`);
        }

        const aircraftAIn = createAircraftInstance(radarRangePx, pad, {
          longitude: lon_A,
          latitude: lat_A,
          heading: heading_A,
          speed: speed_A,
        });

        const aircraftBIn = createAircraftInstance(radarRangePx, pad, {
          longitude: lon_B,
          latitude: lat_B,
          heading: heading_B,
          speed: speed_B_eff,
          altitude: aircraftAIn.altitude,
        });

        addAircraftToScene(aircraftAIn);
        addAircraftToScene(aircraftBIn);
        placed += 2;
        console.log(placed)
        return placed;
      }
    } catch(err) {
      console.warn("Retrying");
    }
  }
}