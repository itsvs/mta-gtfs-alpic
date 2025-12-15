import { Route, Stop, Trip } from "../gtfs/types.js";

// MTA-specific types for MCP responses
export interface RouteInfo extends Route {
  stop_count: number;
  trip_count: number;
  is_active: boolean;
}

export interface StopInfo extends Stop {
  upcoming_departures: UpcomingDeparture[];
}

export interface UpcomingDeparture {
  trip_id: string;
  route_short_name: string;
  trip_headsign: string;
  scheduled_departure: string;
  estimated_departure?: string;
  delay_seconds?: number;
  delay_status: "on_time" | "late" | "early" | "scheduled";
  route_color: string;
}

export interface TripInfo extends Trip {
  route_short_name: string;
  is_active: boolean;
  has_realtime_data: boolean;
  delay_seconds?: number;
  progress_percentage?: number;
  current_stop?: string;
  next_stop?: string;
  stop_schedule: StopSchedule[];
}

export interface StopSchedule {
  stop_id: string;
  stop_name: string;
  stop_sequence: number;
  scheduled_arrival: string;
  scheduled_departure: string;
  estimated_arrival?: string;
  estimated_departure?: string;
  delay_seconds?: number;
  has_passed: boolean;
}

export interface SystemInfo {
  agency_name: string;
  agency_url: string;
  feed_version?: string;
  total_routes: number;
  total_stops: number;
  total_trips: number;
  active_routes_today: number;
  active_trips_today: number;
  realtime_data_available: boolean;
  realtime_last_updated?: string;
  realtime_trip_updates: number;
}

export interface RouteServicePattern {
  route_id: string;
  route_short_name: string;
  weekday_service: boolean;
  saturday_service: boolean;
  sunday_service: boolean;
  first_departure: string;
  last_departure: string;
  average_headway_minutes: number;
}
