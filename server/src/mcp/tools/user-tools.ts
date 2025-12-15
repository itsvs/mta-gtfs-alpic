import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { jsonResponse } from "../utils/responses.js";

export function createUserTools(server: McpServer) {
  // Get user saved trips
  server.tool(
    "get_user_saved_trips",
    "Gets a list of trips that user has saved, likely because they make them often",
    {},
    async () => {
      return jsonResponse({
        saved_trips: [
          {
            name: "homebound",
            line: "7",
            start_station: {
              name: "Hudson Yards",
              stop_id: "726",
              platform_id: "726N",
              platform_direction: "Northbound",
            },
            end_station: {
              name: "Grand Central",
              stop_id: "723",
              platform_id: "723N",
              platform_direction: "Northbound",
            },
          },
        ],
      });
    },
  );
}
