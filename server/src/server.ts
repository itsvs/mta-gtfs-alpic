import { McpServer } from "skybridge/server";
import { GTFSService } from "./mcp/services/gtfs-service.js";
import { createRouteTools } from "./mcp/tools/route-tools.js";
import { createStopTools } from "./mcp/tools/stop-tools.js";
import { createTripTools } from "./mcp/tools/trip-tools.js";
import { createSystemTools } from "./mcp/tools/system-tools.js";
import { createUserTools } from "./mcp/tools/user-tools.js";

export function buildServer(): McpServer {
  const server = new McpServer(
    {
      name: "alpic-openai-app",
      version: "0.0.1",
    },
    { capabilities: {} },
  );

  const gtfsService = new GTFSService();

  // Register all tool categories
  createRouteTools(gtfsService, server);
  createStopTools(gtfsService, server);
  createTripTools(gtfsService, server);
  createSystemTools(gtfsService, server);
  createUserTools(server);

  return server;
}
