/**
 * Timezone utilities for MTA system (Eastern Time)
 * Handles conversion from UTC (Cloudflare Workers environment) to Eastern Time
 */

/**
 * Convert Unix timestamp to Eastern Time string
 */
export function unixTimestampToEasternTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Check if a GTFS calendar service is active today (Eastern timezone-aware)
 * This is specifically for Cloudflare Workers UTC environment
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isServiceActiveTodayEastern(calendar: any): boolean {
  // Get current date/time in Eastern timezone
  const now = new Date();
  const pacificTime = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" }),
  );

  const dayOfWeek = pacificTime.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const todayStr = pacificTime.toISOString().slice(0, 10).replace(/-/g, "");

  // Check if today is within the service period
  if (todayStr < calendar.start_date || todayStr > calendar.end_date) {
    return false;
  }

  // Check if service runs on this day of week
  const dayFields = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const dayField = dayFields[dayOfWeek];
  return calendar[dayField] === "1";
}
