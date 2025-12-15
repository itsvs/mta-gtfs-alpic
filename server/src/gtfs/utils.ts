import { Route, Stop, Trip, StopTime, Calendar } from "./types";

export function getRouteColor(route: Route): string {
  if (!route.route_color) return "#666666";
  return `#${route.route_color}`;
}

export function getRouteTextColor(route: Route): string {
  if (!route.route_text_color) return "#FFFFFF";
  return `#${route.route_text_color}`;
}

export function getStopsForRoute(routeId: string, trips: Trip[], stopTimes: StopTime[], stops: Stop[]): Stop[] {
  const routeTrips = trips.filter((trip) => trip.route_id === routeId);
  const stopIds = new Set<string>();

  routeTrips.forEach((trip) => {
    const tripStopTimes = stopTimes.filter((st) => st.trip_id === trip.trip_id);
    tripStopTimes.forEach((st) => stopIds.add(st.stop_id));
  });

  return stops.filter((stop) => stopIds.has(stop.stop_id));
}

export function getTripsForRoute(routeId: string, trips: Trip[]): Trip[] {
  return trips.filter((trip) => trip.route_id === routeId);
}

export function formatTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(":");
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${minutes} ${ampm}`;
}

export function isServiceActiveToday(calendar: Calendar): boolean {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const todayStr = today.toISOString().slice(0, 10).replace(/-/g, "");

  // Check if today is within the service period
  if (todayStr < calendar.start_date || todayStr > calendar.end_date) {
    return false;
  }

  // Check if service runs on this day of week
  const dayFields = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const dayField = dayFields[dayOfWeek] as keyof Calendar;
  return calendar[dayField] === "1";
}
