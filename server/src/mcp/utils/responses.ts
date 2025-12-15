// Shared utilities for MCP tool responses

/**
 * Creates a JSON response for MCP tools
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function jsonResponse(data: any) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

/**
 * Creates an error response for MCP tools
 */
export function errorResponse(operation: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  return jsonResponse({
    error: true,
    operation,
    message,
  });
}

/**
 * Wraps a tool handler with automatic error handling
 */
export function withErrorHandling<TArgs, TResult>(
  operation: string,
  handler: (args: TArgs) => Promise<TResult>,
) {
  return async (args: TArgs) => {
    try {
      return await handler(args);
    } catch (error) {
      return errorResponse(operation, error);
    }
  };
}

/**
 * Creates a "not found" response with available alternatives
 */
export function notFoundResponse(
  itemType: string,
  searchTerm: string,
  availableItems?: string[],
  suggestion?: string,
) {
  return jsonResponse({
    error: true,
    type: "not_found",
    itemType,
    searchTerm,
    ...(availableItems && availableItems.length > 0 && { availableItems }),
    ...(suggestion && { suggestion }),
  });
}

/**
 * Formats delay in seconds to a human-readable string
 */
export function formatDelaySeconds(delaySeconds: number): string {
  if (delaySeconds === 0) {
    return "On Time";
  }

  const minutes = Math.floor(Math.abs(delaySeconds) / 60);
  const seconds = Math.abs(delaySeconds) % 60;
  const timeStr = `${minutes}m${seconds}s`;

  return delaySeconds > 0 ? `${timeStr} late` : `${timeStr} early`;
}

/**
 * Formats delay with emoji status indicator
 */
export function formatDelayWithStatus(delaySeconds: number | undefined): string {
  if (delaySeconds === undefined) {
    return "⚪ Scheduled";
  }

  if (delaySeconds === 0) {
    return "🟢 On Time";
  }

  const minutes = Math.floor(Math.abs(delaySeconds) / 60);
  const seconds = Math.abs(delaySeconds) % 60;
  const timeStr = `${minutes}m${seconds}s`;

  if (delaySeconds > 0) {
    return `🔴 Late (${timeStr})`;
  } else {
    return `🟡 Early (${timeStr})`;
  }
}

/**
 * Formats coordinates to a readable string
 */
export function formatCoordinates(lat: string, lon: string, precision: number = 4): string {
  return `${parseFloat(lat).toFixed(precision)}, ${parseFloat(lon).toFixed(precision)}`;
}
