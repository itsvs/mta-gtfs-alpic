import { GTFSService } from "../services/gtfs-service.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jsonResponse, withErrorHandling, notFoundResponse } from "../utils/responses.js";

export function createTripTools(gtfsService: GTFSService, server: McpServer) {
  // Get detailed information about a specific trip
  server.tool(
    "get_trip_info",
    "Gets detailed information about a specific MTA trip including real-time updates and schedule",
    {
      trip_id: z.string().describe("The trip ID (e.g., '1771569')"),
    },
    withErrorHandling("fetching trip information", async ({ trip_id }) => {
      const trip = await gtfsService.getTripInfo(trip_id);

      if (!trip) {
        return notFoundResponse("Trip", trip_id);
      }

      return jsonResponse({
        trip_id: trip.trip_id,
        route_id: trip.route_id,
        route_short_name: trip.route_short_name,
        trip_headsign: trip.trip_headsign,
        direction_id: trip.direction_id,
        service_id: trip.service_id,
        is_active: trip.is_active,
        has_realtime_data: trip.has_realtime_data,
        progress_percentage: trip.progress_percentage,
        current_stop: trip.current_stop,
        next_stop: trip.next_stop,
        delay_seconds: trip.delay_seconds,
        stop_schedule: trip.stop_schedule.map((stop) => ({
          stop_id: stop.stop_id,
          stop_name: stop.stop_name,
          stop_sequence: stop.stop_sequence,
          scheduled_arrival: stop.scheduled_arrival,
          scheduled_departure: stop.scheduled_departure,
          estimated_arrival: stop.estimated_arrival,
          estimated_departure: stop.estimated_departure,
          delay_seconds: stop.delay_seconds,
          has_passed: stop.has_passed,
        })),
      });
    }),
  );

  // Get active trips with real-time data
  server.tool(
    "get_live_trips",
    "Gets currently active MTA trips that have real-time tracking data",
    {
      route_filter: z.string().optional().describe("Optional route short name to filter by (e.g., '1', '2', '3', '7')"),
      limit: z.number().default(10).describe("Maximum number of trips to return (default: 10)"),
    },
    withErrorHandling("fetching live trips", async ({ route_filter, limit }) => {
      const liveTrips = await gtfsService.getLiveTrips(route_filter, limit);

      if (liveTrips.length === 0) {
        const systemInfo = await gtfsService.getSystemInfo();

        return jsonResponse({
          trips: [],
          route_filter,
          realtime_data_available: systemInfo.realtime_data_available,
          realtime_trip_updates: systemInfo.realtime_trip_updates,
          realtime_last_updated: systemInfo.realtime_last_updated,
        });
      }

      return jsonResponse({
        trips: liveTrips.map((trip) => ({
          trip_id: trip.trip_id,
          route_short_name: trip.route_short_name,
          route_id: trip.route_id,
          trip_headsign: trip.trip_headsign,
          delay_seconds: trip.delay_seconds,
          progress_percentage: trip.progress_percentage,
          current_stop: trip.current_stop,
          next_stop: trip.next_stop,
        })),
        route_filter,
        total: liveTrips.length,
      });
    }),
  );

  // Get trip schedule for a specific trip
  server.tool(
    "get_trip_schedule",
    "Gets the detailed stop-by-stop schedule for an MTA trip with real-time updates",
    {
      trip_id: z.string().describe("The trip ID (e.g., '1771569')"),
      show_passed_stops: z
        .boolean()
        .default(true)
        .describe("Include stops that the trip has already passed (default: true)"),
    },
    withErrorHandling("fetching trip schedule", async ({ trip_id, show_passed_stops }) => {
      const trip = await gtfsService.getTripInfo(trip_id);

      if (!trip) {
        return notFoundResponse("Trip", trip_id);
      }

      const schedule = show_passed_stops ? trip.stop_schedule : trip.stop_schedule.filter((stop) => !stop.has_passed);

      return jsonResponse({
        trip_id: trip.trip_id,
        route_short_name: trip.route_short_name,
        route_id: trip.route_id,
        trip_headsign: trip.trip_headsign,
        has_realtime_data: trip.has_realtime_data,
        show_passed_stops,
        schedule: schedule.map((stop) => ({
          stop_id: stop.stop_id,
          stop_name: stop.stop_name,
          stop_sequence: stop.stop_sequence,
          scheduled_arrival: stop.scheduled_arrival,
          scheduled_departure: stop.scheduled_departure,
          estimated_arrival: stop.estimated_arrival,
          estimated_departure: stop.estimated_departure,
          delay_seconds: stop.delay_seconds,
          has_passed: stop.has_passed,
        })),
      });
    }),
  );
}
