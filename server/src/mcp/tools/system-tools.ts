import { GTFSService } from "../services/gtfs-service.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { jsonResponse, withErrorHandling } from "../utils/responses.js";

export function createSystemTools(gtfsService: GTFSService, server: McpServer) {
  // Get general system information
  server.tool(
    "get_system_info",
    "Gets general information about the MTA GTFS system including data freshness and statistics",
    {},
    withErrorHandling("fetching system information", async () => {
      const systemInfo = await gtfsService.getSystemInfo();

      return jsonResponse({
        agency_name: systemInfo.agency_name,
        agency_url: systemInfo.agency_url,
        total_routes: systemInfo.total_routes,
        total_stops: systemInfo.total_stops,
        total_trips: systemInfo.total_trips,
        active_routes_today: systemInfo.active_routes_today,
        active_trips_today: systemInfo.active_trips_today,
        realtime_data_available: systemInfo.realtime_data_available,
        realtime_last_updated: systemInfo.realtime_last_updated,
        realtime_trip_updates: systemInfo.realtime_trip_updates,
      });
    }),
  );

  // Get service status and health check
  server.tool(
    "get_service_status",
    "Gets the current service status and health of the MTA GTFS data system",
    {},
    withErrorHandling("checking service status", async () => {
      const systemInfo = await gtfsService.getSystemInfo();
      const now = new Date();

      let realtimeHealth = "unavailable";
      let minutesSinceUpdate = null;

      if (systemInfo.realtime_data_available) {
        const lastUpdate = new Date(systemInfo.realtime_last_updated!);
        minutesSinceUpdate = Math.floor((now.getTime() - lastUpdate.getTime()) / 60000);

        if (minutesSinceUpdate < 2) {
          realtimeHealth = "healthy";
        } else if (minutesSinceUpdate < 10) {
          realtimeHealth = "delayed";
        } else {
          realtimeHealth = "stale";
        }
      }

      const servicePercentage = Math.round((systemInfo.active_routes_today / systemInfo.total_routes) * 100);

      return jsonResponse({
        current_time: now.toISOString(),
        timezone: "America/New_York",
        realtime_data_available: systemInfo.realtime_data_available,
        realtime_health: realtimeHealth,
        realtime_last_updated: systemInfo.realtime_last_updated,
        minutes_since_realtime_update: minutesSinceUpdate,
        realtime_trip_updates: systemInfo.realtime_trip_updates,
        active_routes_today: systemInfo.active_routes_today,
        total_routes: systemInfo.total_routes,
        service_percentage: servicePercentage,
        active_trips_today: systemInfo.active_trips_today,
        total_stops: systemInfo.total_stops,
      });
    }),
  );

  // Get help information about available tools
  server.tool("get_help", "Gets help information about available MTA GTFS tools and how to use them", {}, async () => {
    return jsonResponse({
      server_description:
        "MCP server for NYC MTA subway data including routes, stops, trips, and real-time information",
      tools: {
        route_tools: [
          {
            name: "get_active_routes_today",
            description: "List all active MTA routes today",
          },
          {
            name: "get_route_info",
            description: "Get detailed information about a specific route",
          },
          {
            name: "list_all_routes",
            description: "List all routes (active and inactive)",
          },
        ],
        stop_tools: [
          {
            name: "search_stops",
            description: "Search for stations by name or ID",
          },
          {
            name: "get_stop_info",
            description: "Get detailed station info with upcoming departures",
          },
          {
            name: "get_upcoming_departures",
            description: "Get upcoming trains at a specific station",
          },
        ],
        trip_tools: [
          {
            name: "get_trip_info",
            description: "Get detailed information about a specific trip",
          },
          {
            name: "get_live_trips",
            description: "Get currently active trips with real-time data",
          },
          {
            name: "get_trip_schedule",
            description: "Get stop-by-stop schedule for a trip",
          },
        ],
        system_tools: [
          {
            name: "get_system_info",
            description: "Get general system information and statistics",
          },
          {
            name: "get_service_status",
            description: "Get current service status and health check",
          },
          {
            name: "get_help",
            description: "Show this help information",
          },
        ],
      },
      data_sources: {
        static_gtfs: "Schedule, route, and stop information",
        gtfs_realtime: "Live trip updates, delays, and vehicle positions from MTA API",
      },
    });
  });
}
