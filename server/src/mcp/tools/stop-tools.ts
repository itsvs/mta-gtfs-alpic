import { GTFSService } from "../services/gtfs-service.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jsonResponse, withErrorHandling, notFoundResponse } from "../utils/responses.js";

export function createStopTools(gtfsService: GTFSService, server: McpServer) {
  // Search for stops by name or ID
  server.tool(
    "search_stops",
    "Search for MTA stations/stops by name, ID, or code",
    {
      query: z.string().describe("Search term (station name, stop ID, or stop code)"),
      limit: z.number().default(10).describe("Maximum number of results to return (default: 10)"),
    },
    withErrorHandling("searching stops", async ({ query, limit }) => {
      const stops = await gtfsService.searchStops(query, limit);

      if (stops.length === 0) {
        return notFoundResponse(
          "Stop",
          query,
          [],
          'Try searching for station names like "Times Square", "Grand Central", or "Union Square".',
        );
      }

      return jsonResponse({
        query,
        stops: stops.map((stop) => ({
          stop_id: stop.stop_id,
          stop_name: stop.stop_name,
          stop_code: stop.stop_code,
          stop_lat: stop.stop_lat,
          stop_lon: stop.stop_lon,
          platform_code: stop.platform_code,
          parent_station: stop.parent_station,
          upcoming_departures_count: stop.upcoming_departures.length,
        })),
        total: stops.length,
      });
    }),
  );

  // Get detailed information about a specific stop
  server.tool(
    "get_stop_info",
    "Gets detailed information about a specific MTA station/stop including upcoming departures",
    {
      stop_id: z.string().describe("The stop ID (e.g., '726') or stop name"),
      departure_limit: z
        .number()
        .default(10)
        .describe("Maximum number of upcoming departures to include (default: 10)"),
    },
    withErrorHandling("fetching stop information", async ({ stop_id, departure_limit }) => {
      // Try to find stop by ID first, then by name if not found
      let stop = await gtfsService.getStopInfo(stop_id, departure_limit);

      if (!stop) {
        // Try searching by name
        const searchResults = await gtfsService.searchStops(stop_id, 1);
        if (searchResults.length > 0) {
          stop = searchResults[0];
        }
      }

      if (!stop) {
        return notFoundResponse("Stop", stop_id, [], "Try searching for stops first using the search_stops tool.");
      }

      return jsonResponse({
        stop_id: stop.stop_id,
        stop_name: stop.stop_name,
        stop_code: stop.stop_code,
        stop_lat: stop.stop_lat,
        stop_lon: stop.stop_lon,
        platform_code: stop.platform_code,
        parent_station: stop.parent_station,
        upcoming_departures: stop.upcoming_departures.map((departure) => ({
          route_short_name: departure.route_short_name,
          route_color: departure.route_color,
          trip_headsign: departure.trip_headsign,
          trip_id: departure.trip_id,
          scheduled_departure: departure.scheduled_departure,
          estimated_departure: departure.estimated_departure,
          delay_seconds: departure.delay_seconds,
        })),
      });
    }),
  );

  // Get upcoming departures for a specific stop
  server.tool(
    "get_upcoming_departures",
    "Gets upcoming train departures for a specific MTA station with real-time information.",
    {
      stop_id: z.string().describe("The platform ID (e.g., '726N', '726S'), NOT the stop ID (e.g. '726')"),
      limit: z.number().default(5).describe("Maximum number of departures to return (default: 5)"),
      route_filter: z.string().optional().describe("Optional route short name to filter by (e.g., '1', '2', '3', '7')"),
    },
    withErrorHandling("fetching departures", async ({ stop_id, limit, route_filter }) => {
      // Get stop info first
      let stop = await gtfsService.getStopInfo(stop_id, limit * 2); // Get more to allow filtering

      if (!stop) {
        // Try searching by name
        const searchResults = await gtfsService.searchStops(stop_id, 1);
        if (searchResults.length > 0) {
          stop = await gtfsService.getStopInfo(searchResults[0].stop_id, limit * 2);
        }
      }

      if (!stop) {
        return notFoundResponse("Stop", stop_id);
      }

      let departures = stop.upcoming_departures;

      // Apply route filter if specified
      if (route_filter) {
        departures = departures.filter((d) => d.route_short_name.toLowerCase().includes(route_filter.toLowerCase()));
      }

      // Apply limit
      departures = departures.slice(0, limit);

      if (departures.length === 0) {
        return jsonResponse({
          stop_id: stop.stop_id,
          stop_name: stop.stop_name,
          route_filter,
          departures: [],
          message: `No upcoming departures found${route_filter ? ` for route ${route_filter}` : ""}.`,
        });
      }

      return jsonResponse({
        stop_id: stop.stop_id,
        stop_name: stop.stop_name,
        route_filter,
        updated_at: new Date().toLocaleString("en-US", { timeZone: "America/New_York" }),
        timezone: "America/New_York",
        departures: departures.map((departure) => ({
          route_short_name: departure.route_short_name,
          route_color: departure.route_color,
          trip_headsign: departure.trip_headsign,
          trip_id: departure.trip_id,
          scheduled_departure: departure.scheduled_departure,
          estimated_departure: departure.estimated_departure,
          delay_seconds: departure.delay_seconds,
        })),
      });
    }),
  );
}
