import { GTFSService } from "../services/gtfs-service.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jsonResponse, withErrorHandling, notFoundResponse } from "../utils/responses.js";

export function createRouteTools(gtfsService: GTFSService, server: McpServer) {
  // Get all active routes for today
  server.tool(
    "get_active_routes_today",
    "Gets a list of MTA routes that are active today with service information",
    {
      include_inactive: z
        .boolean()
        .default(false)
        .describe("Include routes that are not active today (default: false)"),
    },
    withErrorHandling("fetching active routes", async ({ include_inactive }) => {
      const routes = await gtfsService.getActiveRoutesToday();
      const filteredRoutes = include_inactive ? routes : routes.filter((r) => r.is_active);

      return jsonResponse({
        routes: filteredRoutes.map((route) => ({
          route_id: route.route_id,
          route_short_name: route.route_short_name,
          route_long_name: route.route_long_name,
          route_type: route.route_type,
          route_color: route.route_color,
          route_text_color: route.route_text_color,
          is_active: route.is_active,
          stop_count: route.stop_count,
          trip_count: route.trip_count,
        })),
        total: filteredRoutes.length,
      });
    }),
  );

  // Get detailed information about a specific route
  server.tool(
    "get_route_info",
    "Gets detailed information about a specific MTA route",
    {
      route_id: z.string().describe("The route ID (e.g., '1', '2', '3', '7')"),
    },
    withErrorHandling("fetching route information", async ({ route_id }) => {
      // Try to find route by ID first, then by short name
      const allRoutes = await gtfsService.getActiveRoutesToday();
      let route = allRoutes.find((r) => r.route_id === route_id);

      if (!route) {
        route = allRoutes.find((r) => r.route_short_name.toLowerCase() === route_id.toLowerCase());
      }

      if (!route) {
        const availableRoutes = allRoutes.map((r) => `${r.route_id} (${r.route_short_name})`);
        return notFoundResponse("Route", route_id, availableRoutes);
      }

      return jsonResponse({
        route_id: route.route_id,
        route_short_name: route.route_short_name,
        route_long_name: route.route_long_name,
        route_type: route.route_type,
        route_color: route.route_color,
        route_text_color: route.route_text_color,
        is_active: route.is_active,
        stop_count: route.stop_count,
        trip_count: route.trip_count,
      });
    }),
  );

  // List all routes (active and inactive) with basic info
  server.tool(
    "list_all_routes",
    "Lists all MTA routes with basic information, including inactive routes",
    {},
    withErrorHandling("fetching routes", async () => {
      const routes = await gtfsService.getActiveRoutesToday();

      const activeRoutes = routes.filter((r) => r.is_active);
      const inactiveRoutes = routes.filter((r) => !r.is_active);

      return jsonResponse({
        active_routes: activeRoutes.map((route) => ({
          route_id: route.route_id,
          route_short_name: route.route_short_name,
          route_long_name: route.route_long_name,
          stop_count: route.stop_count,
          trip_count: route.trip_count,
        })),
        inactive_routes: inactiveRoutes.map((route) => ({
          route_id: route.route_id,
          route_short_name: route.route_short_name,
          route_long_name: route.route_long_name,
          stop_count: route.stop_count,
          trip_count: route.trip_count,
        })),
        total: routes.length,
        active_count: activeRoutes.length,
        inactive_count: inactiveRoutes.length,
      });
    }),
  );

  const WIDGET_VERSION = "v0.3";

  server.registerResource("route-map", `ui://widget/${WIDGET_VERSION}/route-map.html`, {}, async () => ({
    contents: [
      {
        uri: `ui://widget/${WIDGET_VERSION}/route-map.html`,
        mimeType: "text/html+skybridge",
        text: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Route Map</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
        crossorigin=""/>
  <style>
    html, body, #map-root {
      margin: 0;
      padding: 0;
      height: 100%;
      width: 100%;
    }
  </style>
</head>
<body>
  <div id="map-root"></div>
  <script type="module" src="https://mta.vanshaj.dev/map.js"></script>
</body>
</html>
          `.trim(),
      },
    ],
  }));

  // Get route shape for mapping
  server.registerTool(
    "get_route_shape",
    {
      title: "Get Route Shape",
      description:
        "Gets the geographic shape (coordinates) of an MTA route for mapping, optionally marking start and end stations. Consider using this when someone asks about a train trip, as it'll help visualize their trip.",
      _meta: {
        "openai/outputTemplate": `ui://widget/${WIDGET_VERSION}/route-map.html`,
        "openai/toolInvocation/invoking": "Displaying the map",
        "openai/toolInvocation/invoked": "Displayed the map",
        "openai/widgetAccessible": true,
      },
      inputSchema: {
        route_id: z.string().describe("The route ID (e.g., '1', '2', '3')"),
        start_stop_id: z
          .string()
          .optional()
          .describe("Optional: Stop ID where the route segment should start (e.g., '726')"),
        end_stop_id: z
          .string()
          .optional()
          .describe("Optional: Stop ID where the route segment should end (e.g., '423')"),
      },
    },
    withErrorHandling("fetching route shape", async ({ route_id, start_stop_id, end_stop_id }) => {
      const shapeData = await gtfsService.getRouteShape(route_id, start_stop_id, end_stop_id);

      if (!shapeData) {
        const allRoutes = await gtfsService.getActiveRoutesToday();
        const availableRoutes = allRoutes.map((r) => `${r.route_id} (${r.route_short_name})`);
        return notFoundResponse("Route shape", route_id, availableRoutes);
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                route_name: shapeData.routeName,
                color: shapeData.color,
                coordinates: shapeData.coordinates,
                filtered_segment: shapeData.filteredSegment,
                point_count: shapeData.coordinates.length,
                start_marker: shapeData.startMarker,
                end_marker: shapeData.endMarker,
              },
              null,
              2,
            ),
          },
        ],
        structuredContent: {
          routeShape: {
            routeName: shapeData.routeName,
            coordinates: shapeData.coordinates,
            color: shapeData.color,
            filteredSegment: shapeData.filteredSegment,
            pointCount: shapeData.coordinates.length,
            startMarker: shapeData.startMarker,
            endMarker: shapeData.endMarker,
          },
        },
      };
    }),
  );
}
