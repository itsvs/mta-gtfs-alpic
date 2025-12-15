import { loadGTFSData } from "../../gtfs/static.js";
import { fetchGTFSRealtimeData } from "../../gtfs/realtime.js";
import { GTFSData, GTFSRealtimeData } from "../../gtfs/types.js";
import { RouteInfo, StopInfo, TripInfo, SystemInfo, UpcomingDeparture, StopSchedule } from "../types.js";
import { unixTimestampToEasternTime, isServiceActiveTodayEastern } from "../utils/timezone.js";

export class GTFSService {
  private gtfsData: GTFSData | null = null;
  private realtimeData: GTFSRealtimeData | null = null;
  private lastDataLoad = 0;
  private lastRealtimeUpdate = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes for static data
  private readonly REALTIME_CACHE_DURATION = 30 * 1000; // 30 seconds for realtime data

  private async ensureGTFSData(): Promise<GTFSData> {
    const now = Date.now();
    if (!this.gtfsData || now - this.lastDataLoad > this.CACHE_DURATION) {
      this.gtfsData = await loadGTFSData();
      this.lastDataLoad = now;
    }
    return this.gtfsData;
  }

  private async ensureRealtimeData(): Promise<GTFSRealtimeData> {
    const now = Date.now();
    if (!this.realtimeData || now - this.lastRealtimeUpdate > this.REALTIME_CACHE_DURATION) {
      this.realtimeData = await fetchGTFSRealtimeData();
      this.lastRealtimeUpdate = now;
    }
    return this.realtimeData;
  }

  async getSystemInfo(): Promise<SystemInfo> {
    const [gtfsData, realtimeData] = await Promise.all([this.ensureGTFSData(), this.ensureRealtimeData()]);

    const activeServices = gtfsData.calendar.filter(isServiceActiveTodayEastern).map((c) => c.service_id);
    const activeTrips = gtfsData.trips.filter((trip) => activeServices.includes(trip.service_id));
    const activeRoutes = new Set(activeTrips.map((trip) => trip.route_id)).size;

    const agency = gtfsData.agencies[0];

    return {
      agency_name: agency?.agency_name || "Unknown Agency",
      agency_url: agency?.agency_url || "",
      total_routes: gtfsData.routes.length,
      total_stops: gtfsData.stops.length,
      total_trips: gtfsData.trips.length,
      active_routes_today: activeRoutes,
      active_trips_today: activeTrips.length,
      realtime_data_available: realtimeData.trip_updates.length > 0,
      realtime_last_updated: new Date(realtimeData.last_updated).toISOString(),
      realtime_trip_updates: realtimeData.trip_updates.length,
    };
  }

  async getActiveRoutesToday(): Promise<RouteInfo[]> {
    const [gtfsData] = await Promise.all([this.ensureGTFSData(), this.ensureRealtimeData()]);

    const activeServices = gtfsData.calendar.filter(isServiceActiveTodayEastern).map((c) => c.service_id);
    const activeTrips = gtfsData.trips.filter((trip) => activeServices.includes(trip.service_id));
    const activeRouteIds = new Set(activeTrips.map((trip) => trip.route_id));

    // Build lookup maps once instead of filtering repeatedly
    const tripsByRoute = new Map<string, typeof gtfsData.trips>();
    const stopIdsByRoute = new Map<string, Set<string>>();

    // Group trips by route
    for (const trip of gtfsData.trips) {
      if (!tripsByRoute.has(trip.route_id)) {
        tripsByRoute.set(trip.route_id, []);
      }
      tripsByRoute.get(trip.route_id)!.push(trip);
    }

    // For each route, collect unique stop IDs from all its trips
    for (const [routeId, trips] of Array.from(tripsByRoute.entries())) {
      const stopIds = new Set<string>();
      const tripIds = new Set(trips.map((t) => t.trip_id));

      for (const stopTime of gtfsData.stopTimes) {
        if (tripIds.has(stopTime.trip_id)) {
          stopIds.add(stopTime.stop_id);
        }
      }

      stopIdsByRoute.set(routeId, stopIds);
    }

    const routeInfos = gtfsData.routes.map((route) => {
      const isActive = activeRouteIds.has(route.route_id);
      const routeTrips = tripsByRoute.get(route.route_id) || [];
      const stopIds = stopIdsByRoute.get(route.route_id) || new Set();

      return {
        route_id: route.route_id,
        route_short_name: route.route_short_name,
        route_long_name: route.route_long_name,
        route_type: route.route_type,
        route_color: route.route_color || "666666",
        route_text_color: route.route_text_color || "FFFFFF",
        stop_count: stopIds.size,
        trip_count: routeTrips.length,
        is_active: isActive,
      };
    });

    return routeInfos.sort((a, b) => a.route_short_name.localeCompare(b.route_short_name));
  }

  async getRouteInfo(routeId: string): Promise<RouteInfo | null> {
    const routes = await this.getActiveRoutesToday();
    return routes.find((r) => r.route_id === routeId) || null;
  }

  async getStopInfo(stopId: string, limit = 10): Promise<StopInfo | null> {
    const [gtfsData] = await Promise.all([this.ensureGTFSData(), this.ensureRealtimeData()]);

    const stop = gtfsData.stops.find((s) => s.stop_id === stopId);
    if (!stop) return null;

    const upcomingDepartures = await this.getUpcomingDepartures(stopId, limit);

    return {
      stop_id: stop.stop_id,
      stop_name: stop.stop_name,
      stop_code: stop.stop_code,
      platform_code: stop.platform_code,
      stop_lat: stop.stop_lat,
      stop_lon: stop.stop_lon,
      parent_station: stop.parent_station,
      upcoming_departures: upcomingDepartures,
    };
  }

  async getUpcomingDepartures(stopId: string, limit = 10): Promise<UpcomingDeparture[]> {
    const [gtfsData, realtimeData] = await Promise.all([this.ensureGTFSData(), this.ensureRealtimeData()]);

    const now = new Date();
    const currentTimeStr = now.toLocaleTimeString("en-US", {
      timeZone: "America/New_York",
      hour12: false,
    });

    const stopStopTimes = gtfsData.stopTimes
      .filter((st) => st.stop_id === stopId)
      .filter((st) => st.departure_time >= currentTimeStr) // Only future departures
      .sort((a, b) => a.departure_time.localeCompare(b.departure_time))
      .slice(0, limit);

    return stopStopTimes.map((st) => {
      const trip = gtfsData.trips.find((t) => t.trip_id === st.trip_id);
      const route = gtfsData.routes.find((r) => r.route_id === trip?.route_id);

      // Find real-time update for this trip (using suffix matching)
      const realtimeUpdate = realtimeData.trip_updates.find(
        (update) => update.trip?.tripId && st.trip_id.endsWith(update.trip.tripId),
      );

      // Find stop-specific update
      const stopUpdate = realtimeUpdate?.stopTimeUpdate?.find(
        (stu) => stu.stopId === stopId || stu.stopSequence === parseInt(st.stop_sequence),
      );

      let estimatedDeparture: string | undefined;
      let delaySeconds: number | undefined;
      let delayStatus: "on_time" | "late" | "early" | "scheduled" = "scheduled";

      if (stopUpdate?.departure) {
        if (stopUpdate.departure.time) {
          estimatedDeparture = unixTimestampToEasternTime(stopUpdate.departure.time);
        }

        if (stopUpdate.departure.delay !== undefined) {
          delaySeconds = stopUpdate.departure.delay;
          if (delaySeconds === 0) {
            delayStatus = "on_time";
          } else if (delaySeconds > 0) {
            delayStatus = "late";
          } else {
            delayStatus = "early";
          }
        }
      }

      return {
        trip_id: st.trip_id,
        route_short_name: route?.route_short_name || "Unknown",
        trip_headsign: trip?.trip_headsign || "Unknown Destination",
        scheduled_departure: st.departure_time,
        estimated_departure: estimatedDeparture,
        delay_seconds: delaySeconds,
        delay_status: delayStatus,
        route_color: route?.route_color || "666666",
      };
    });
  }

  async getTripInfo(tripId: string): Promise<TripInfo | null> {
    const [gtfsData, realtimeData] = await Promise.all([this.ensureGTFSData(), this.ensureRealtimeData()]);

    const trip = gtfsData.trips.find((t) => t.trip_id === tripId);
    if (!trip) return null;

    const route = gtfsData.routes.find((r) => r.route_id === trip.route_id);
    const isActive = gtfsData.calendar
      .filter(isServiceActiveTodayEastern)
      .some((c) => c.service_id === trip.service_id);

    // Match realtime data using suffix matching (MTA realtime IDs are suffixes of static IDs)
    const realtimeUpdate = realtimeData.trip_updates.find(
      (update) => update.trip?.tripId && tripId.endsWith(update.trip.tripId),
    );

    const stopSchedule = await this.getTripSchedule(tripId);
    const progress = this.calculateTripProgress(tripId, gtfsData, realtimeData);

    return {
      trip_id: trip.trip_id,
      route_id: trip.route_id,
      route_short_name: route?.route_short_name || "Unknown",
      trip_headsign: trip.trip_headsign || "Unknown Destination",
      direction_id: trip.direction_id || "0",
      service_id: trip.service_id,
      is_active: isActive,
      has_realtime_data: !!realtimeUpdate,
      delay_seconds: realtimeUpdate?.delay,
      progress_percentage: progress?.progress,
      current_stop: progress?.currentStop,
      next_stop: progress?.nextStop,
      stop_schedule: stopSchedule,
    };
  }

  private async getTripSchedule(tripId: string): Promise<StopSchedule[]> {
    const [gtfsData, realtimeData] = await Promise.all([this.ensureGTFSData(), this.ensureRealtimeData()]);

    const tripStopTimes = gtfsData.stopTimes
      .filter((st) => st.trip_id === tripId)
      .sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence));

    // Match realtime data using suffix matching (MTA realtime IDs are suffixes of static IDs)
    const realtimeUpdate = realtimeData.trip_updates.find(
      (update) => update.trip?.tripId && tripId.endsWith(update.trip.tripId),
    );

    const now = new Date();
    const currentTimeStr = now.toLocaleTimeString("en-US", {
      timeZone: "America/New_York",
      hour12: false,
    });

    return tripStopTimes.map((st) => {
      const stop = gtfsData.stops.find((s) => s.stop_id === st.stop_id);
      const stopUpdate = realtimeUpdate?.stopTimeUpdate?.find(
        (stu) => stu.stopId === st.stop_id || stu.stopSequence === parseInt(st.stop_sequence),
      );

      let estimatedArrival: string | undefined;
      let estimatedDeparture: string | undefined;
      let delaySeconds: number | undefined;

      if (stopUpdate) {
        if (stopUpdate.arrival?.time) {
          estimatedArrival = unixTimestampToEasternTime(stopUpdate.arrival.time);
        }
        if (stopUpdate.departure?.time) {
          estimatedDeparture = unixTimestampToEasternTime(stopUpdate.departure.time);
        }
        delaySeconds = stopUpdate.arrival?.delay || stopUpdate.departure?.delay;
      }

      return {
        stop_id: st.stop_id,
        stop_name: stop?.stop_name || "Unknown Stop",
        stop_sequence: parseInt(st.stop_sequence),
        scheduled_arrival: st.arrival_time,
        scheduled_departure: st.departure_time,
        estimated_arrival: estimatedArrival,
        estimated_departure: estimatedDeparture,
        delay_seconds: delaySeconds,
        has_passed: st.departure_time < currentTimeStr,
      };
    });
  }

  private calculateTripProgress(tripId: string, gtfsData: GTFSData, realtimeData: GTFSRealtimeData) {
    const tripStopTimes = gtfsData.stopTimes
      .filter((st) => st.trip_id === tripId)
      .sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence));

    if (tripStopTimes.length === 0) return null;

    // Match realtime data using suffix matching (MTA realtime IDs are suffixes of static IDs)
    const realtimeUpdate = realtimeData.trip_updates.find(
      (update) => update.trip?.tripId && tripId.endsWith(update.trip.tripId),
    );

    if (!realtimeUpdate?.stopTimeUpdate) return null;

    // Find current position (similar to UI logic but simplified)
    const now = Math.floor(Date.now() / 1000);
    let currentStopIndex = 0;

    for (let i = 0; i < tripStopTimes.length; i++) {
      const stopTime = tripStopTimes[i];
      const stopUpdate = realtimeUpdate.stopTimeUpdate.find(
        (stu) => stu.stopId === stopTime.stop_id || stu.stopSequence === parseInt(stopTime.stop_sequence),
      );

      if (stopUpdate?.departure?.time && stopUpdate.departure.time < now) {
        currentStopIndex = Math.min(i + 1, tripStopTimes.length - 1);
      } else if (stopUpdate?.arrival?.time && stopUpdate.arrival.time < now) {
        currentStopIndex = i;
        break;
      }
    }

    const currentStop = tripStopTimes[currentStopIndex];
    const nextStopIndex = Math.min(currentStopIndex + 1, tripStopTimes.length - 1);
    const nextStop = tripStopTimes[nextStopIndex];

    // Calculate progress using distance if available
    let progress = 0;
    if (
      currentStop?.shape_distance_traveled &&
      tripStopTimes[0]?.shape_distance_traveled &&
      tripStopTimes[tripStopTimes.length - 1]?.shape_distance_traveled
    ) {
      const currentDistance = parseFloat(currentStop.shape_distance_traveled!);
      const startDistance = parseFloat(tripStopTimes[0].shape_distance_traveled!);
      const totalDistance =
        parseFloat(tripStopTimes[tripStopTimes.length - 1].shape_distance_traveled!) - startDistance;

      if (totalDistance > 0) {
        progress = ((currentDistance - startDistance) / totalDistance) * 100;
      }
    } else {
      progress = (currentStopIndex / Math.max(tripStopTimes.length - 1, 1)) * 100;
    }

    const currentStopName = gtfsData.stops.find((s) => s.stop_id === currentStop?.stop_id)?.stop_name;
    const nextStopName = gtfsData.stops.find((s) => s.stop_id === nextStop?.stop_id)?.stop_name;

    return {
      progress: Math.round(Math.min(progress, 100)),
      currentStop: currentStopName,
      nextStop: currentStopIndex < tripStopTimes.length - 1 ? nextStopName : currentStopName,
    };
  }

  async searchStops(query: string, limit = 10): Promise<StopInfo[]> {
    const gtfsData = await this.ensureGTFSData();
    const lowerQuery = query.toLowerCase();

    const matchingStops = gtfsData.stops
      .filter(
        (stop) =>
          stop.stop_name.toLowerCase().includes(lowerQuery) ||
          stop.stop_id.toLowerCase().includes(lowerQuery) ||
          stop.stop_code?.toLowerCase().includes(lowerQuery),
      )
      .slice(0, limit);

    const results: StopInfo[] = [];
    for (const stop of matchingStops) {
      const stopInfo = await this.getStopInfo(stop.stop_id, 5);
      if (stopInfo) results.push(stopInfo);
    }

    return results;
  }

  async getLiveTrips(routeFilter?: string, limit = 10): Promise<TripInfo[]> {
    const [gtfsData, realtimeData] = await Promise.all([this.ensureGTFSData(), this.ensureRealtimeData()]);

    // Get active services for today
    const activeServices = gtfsData.calendar.filter(isServiceActiveTodayEastern).map((c) => c.service_id);
    const activeTrips = gtfsData.trips.filter((trip) => activeServices.includes(trip.service_id));

    // Filter by route if specified
    let filteredTrips = activeTrips;
    if (routeFilter) {
      const matchingRoutes = gtfsData.routes.filter(
        (route) =>
          route.route_short_name.toLowerCase().includes(routeFilter.toLowerCase()) || route.route_id === routeFilter,
      );
      const matchingRouteIds = matchingRoutes.map((r) => r.route_id);
      filteredTrips = activeTrips.filter((trip) => matchingRouteIds.includes(trip.route_id));
    }

    // Get trips that have real-time data (using suffix matching for MTA)
    // MTA realtime trip IDs are suffixes of static trip IDs
    // Static: ASP25GEN-1038-Sunday-00_128750_1..N03R
    // Realtime: 128750_1..N03R
    const tripsWithRealtimeData = filteredTrips.filter((trip) =>
      realtimeData.trip_updates.some((update) => update.trip?.tripId && trip.trip_id.endsWith(update.trip.tripId)),
    );

    // Convert to TripInfo objects
    const liveTrips: TripInfo[] = [];
    for (const trip of tripsWithRealtimeData.slice(0, limit)) {
      const tripInfo = await this.getTripInfo(trip.trip_id);
      if (tripInfo && tripInfo.has_realtime_data) {
        liveTrips.push(tripInfo);
      }
    }

    return liveTrips;
  }

  async getRouteShape(
    routeId: string,
    startStopId?: string,
    endStopId?: string,
  ): Promise<{
    coordinates: [number, number][];
    color: string;
    routeName: string;
    filteredSegment: boolean;
    startMarker?: { lat: number; lng: number; name: string; stopId: string };
    endMarker?: { lat: number; lng: number; name: string; stopId: string };
  } | null> {
    const gtfsData = await this.ensureGTFSData();

    // Find the route
    const route = gtfsData.routes.find(
      (r) => r.route_id === routeId || r.route_short_name.toLowerCase() === routeId.toLowerCase(),
    );

    if (!route) return null;

    // Get all trips for this route to find shape_ids
    const routeTrips = gtfsData.trips.filter((trip) => trip.route_id === route.route_id);

    if (routeTrips.length === 0) return null;

    // Get unique shape_ids for this route
    const shapeIds = Array.from(new Set(routeTrips.map((trip) => trip.shape_id).filter(Boolean) as string[]));

    if (shapeIds.length === 0) return null;

    // For now, use the first shape_id (we could combine multiple shapes later)
    const shapeId = shapeIds[0];

    // Get all shape points for this shape_id
    const shapePoints = gtfsData.shapes
      .filter((shape) => shape.shape_id === shapeId)
      .sort((a, b) => parseInt(a.shape_pt_sequence) - parseInt(b.shape_pt_sequence));

    if (shapePoints.length === 0) return null;

    // Always use full route coordinates
    const coordinates = shapePoints.map(
      (point) => [parseFloat(point.shape_pt_lat), parseFloat(point.shape_pt_lon)] as [number, number],
    );

    // Helper function to find stop coordinates
    const findStopCoordinates = (stopId: string) => {
      // Try direct match first
      let stop = gtfsData.stops.find((s) => s.stop_id === stopId);

      // If not found, try to find a platform stop for this parent station
      if (!stop) {
        const platformStops = gtfsData.stops.filter((s) => s.parent_station === stopId);
        if (platformStops.length > 0) {
          stop = platformStops[0]; // Use first platform
        }
      }

      // If still not found, try to find parent station if this is a platform
      if (!stop) {
        const thisStop = gtfsData.stops.find((s) => s.stop_id === stopId);
        if (thisStop?.parent_station) {
          stop = gtfsData.stops.find((s) => s.stop_id === thisStop.parent_station);
        }
      }

      if (stop) {
        return {
          lat: parseFloat(stop.stop_lat),
          lng: parseFloat(stop.stop_lon),
          name: stop.stop_name,
          stopId: stop.stop_id,
        };
      }

      return null;
    };

    // Get marker coordinates for start/end stations
    const startMarker = startStopId ? findStopCoordinates(startStopId) : undefined;
    const endMarker = endStopId ? findStopCoordinates(endStopId) : undefined;

    return {
      coordinates,
      color: `#${route.route_color || "666666"}`,
      routeName: `${route.route_short_name} - ${route.route_long_name}`,
      filteredSegment: false,
      startMarker: startMarker || undefined,
      endMarker: endMarker || undefined,
    };
  }
}
