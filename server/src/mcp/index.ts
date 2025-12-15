import { createMcpHandler } from "@vercel/mcp-adapter";
import { GTFSService } from "@/lib/mcp/services";
import {
  createRouteTools,
  createStopTools,
  createTripTools,
  createSystemTools,
  createUserTools,
} from "@/lib/mcp/tools";

export const handler = createMcpHandler((server) => {
  // Initialize the GTFS service
  const gtfsService = new GTFSService();

  // Register all tool categories
  createRouteTools(gtfsService, server);
  createStopTools(gtfsService, server);
  createTripTools(gtfsService, server);
  createSystemTools(gtfsService, server);
  createUserTools(server);
});
