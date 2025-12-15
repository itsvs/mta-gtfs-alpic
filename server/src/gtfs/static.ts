import Papa from "papaparse";
import { Agency, Route, Stop, Trip, StopTime, Calendar, Shape, GTFSData } from "./types.js";
import { readFileSync } from "fs";

// Field mappings for each type - only the fields we actually use
const fieldMappings: Record<string, string[]> = {
  "agency.txt": ["agency_name", "agency_url"],
  "routes.txt": ["route_id", "route_short_name", "route_long_name", "route_type", "route_color", "route_text_color"],
  "stops.txt": ["stop_id", "stop_code", "stop_name", "stop_lat", "stop_lon", "parent_station", "platform_code"],
  "trips.txt": ["route_id", "service_id", "trip_id", "trip_headsign", "direction_id", "shape_id"],
  "stop_times.txt": [
    "trip_id",
    "arrival_time",
    "departure_time",
    "stop_id",
    "stop_sequence",
    "shape_distance_traveled",
  ],
  "calendar.txt": [
    "service_id",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
    "start_date",
    "end_date",
  ],
  "shapes.txt": ["shape_id", "shape_pt_lat", "shape_pt_lon", "shape_pt_sequence", "shape_dist_traveled"],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pickFields<T>(obj: any, fields: string[]): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = {};
  for (const field of fields) {
    if (obj[field] !== undefined) {
      result[field] = obj[field];
    }
  }
  return result as T;
}

export async function parseCSVFile<T>(filename: string): Promise<T[]> {
  // const fileModule = await import("../data/" + filename);
  // const fileContent = fileModule.default;

  const fileContent = readFileSync(`src/data/${filename}`, "utf8");
  const allowedFields = fieldMappings[filename] || [];

  return new Promise((resolve, reject) => {
    Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          reject(new Error(`Error parsing ${filename}: ${results.errors[0].message}`));
        } else {
          // Filter to only include the fields we care about
          const filteredData = allowedFields.length
            ? results.data.map((row) => pickFields<T>(row, allowedFields))
            : (results.data as T[]);
          resolve(filteredData);
        }
      },
      error: (error: any) => reject(error),
    });
  });
}

export async function loadGTFSData(): Promise<GTFSData> {
  try {
    const [agencies, routes, stops, trips, stopTimes, calendar, shapes] = await Promise.all([
      parseCSVFile<Agency>("agency.txt"),
      parseCSVFile<Route>("routes.txt"),
      parseCSVFile<Stop>("stops.txt"),
      parseCSVFile<Trip>("trips.txt"),
      parseCSVFile<StopTime>("stop_times.txt"),
      parseCSVFile<Calendar>("calendar.txt"),
      parseCSVFile<Shape>("shapes.txt"),
    ]);

    return {
      agencies,
      routes,
      stops,
      trips,
      stopTimes,
      calendar,
      shapes,
    };
  } catch (error) {
    console.error("Error loading GTFS data:", error);
    throw error;
  }
}
