import { TripUpdate } from "./proto/index.js";

export interface Agency {
  agency_name: string;
  agency_url: string;
}

export interface Route {
  route_id: string;
  route_short_name: string;
  route_long_name: string;
  route_type: string;
  route_color?: string;
  route_text_color?: string;
}

export interface Stop {
  stop_id: string;
  stop_code?: string;
  stop_name: string;
  stop_lat: string;
  stop_lon: string;
  parent_station?: string;
  platform_code?: string;
}

export interface Trip {
  route_id: string;
  service_id: string;
  trip_id: string;
  trip_headsign?: string;
  direction_id?: string;
  shape_id?: string;
}

export interface StopTime {
  trip_id: string;
  arrival_time: string;
  departure_time: string;
  stop_id: string;
  stop_sequence: string;
  shape_distance_traveled?: string;
}

export interface Calendar {
  service_id: string;
  monday: string;
  tuesday: string;
  wednesday: string;
  thursday: string;
  friday: string;
  saturday: string;
  sunday: string;
  start_date: string;
  end_date: string;
}

export interface Shape {
  shape_id: string;
  shape_pt_lat: string;
  shape_pt_lon: string;
  shape_pt_sequence: string;
  shape_dist_traveled?: string;
}

export interface GTFSData {
  agencies: Agency[];
  routes: Route[];
  stops: Stop[];
  trips: Trip[];
  stopTimes: StopTime[];
  calendar: Calendar[];
  shapes: Shape[];
}

export interface GTFSRealtimeData {
  trip_updates: TripUpdate[];
  last_updated: number;
}
