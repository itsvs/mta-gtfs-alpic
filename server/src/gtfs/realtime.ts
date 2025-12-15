import { FeedMessage, TripUpdate, TripUpdate_StopTimeUpdate } from "./proto";
import { GTFSRealtimeData } from "./types";

const MTA_GTFS_RT_URL = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs";

async function parseFeedMessage(buffer: ArrayBuffer): Promise<FeedMessage> {
  try {
    const uint8Array = new Uint8Array(buffer);
    return FeedMessage.decode(uint8Array);
  } catch (error) {
    console.error("Error parsing protobuf message:", error);
    throw error;
  }
}

export async function fetchGTFSRealtimeData(): Promise<GTFSRealtimeData> {
  try {
    const response = await fetch(MTA_GTFS_RT_URL, {
      headers: {
        Accept: "application/x-protobuf",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    const feedMessage = await parseFeedMessage(buffer);

    // Parse the protobuf response into our format
    let tripUpdates: TripUpdate[] = [];

    if (feedMessage.entity) {
      tripUpdates = feedMessage.entity.filter((entity) => !!entity.tripUpdate).map(({ tripUpdate }) => tripUpdate!);
    }

    return {
      trip_updates: tripUpdates,
      last_updated: feedMessage.header?.timestamp
        ? parseInt(feedMessage.header.timestamp.toString()) * 1000
        : Date.now(),
    };
  } catch (error) {
    console.error("Error fetching GTFS-RT data:", error);
    return {
      trip_updates: [],
      last_updated: Date.now(),
    };
  }
}

export function enrichTripWithRealtime(tripId: string, realtimeData: GTFSRealtimeData): TripUpdate | null {
  return realtimeData.trip_updates.find((update) => update.trip?.tripId === tripId) || null;
}

export function formatDelay(delaySeconds: number): string {
  if (delaySeconds === 0) return "On time";

  const minutes = Math.floor(Math.abs(delaySeconds) / 60);
  const seconds = Math.abs(delaySeconds) % 60;

  if (delaySeconds > 0) {
    return `${minutes}m ${seconds}s late`;
  } else {
    return `${minutes}m ${seconds}s early`;
  }
}

export function getRealtimeArrivalTime(
  scheduledTime: string,
  stopTimeUpdate?: TripUpdate_StopTimeUpdate,
): { time: string; delay?: string; isRealtime: boolean } {
  if (!stopTimeUpdate?.arrival) {
    return {
      time: scheduledTime,
      isRealtime: false,
    };
  }

  if (stopTimeUpdate.arrival.time) {
    const realtimeDate = new Date(stopTimeUpdate.arrival.time * 1000);
    const timeStr = realtimeDate.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    });
    return {
      time: timeStr,
      delay: stopTimeUpdate.arrival.delay ? formatDelay(stopTimeUpdate.arrival.delay) : undefined,
      isRealtime: true,
    };
  }

  if (stopTimeUpdate.arrival.delay) {
    const [hours, minutes, seconds] = scheduledTime.split(":").map(Number);
    const scheduledMs = (hours * 3600 + minutes * 60 + seconds) * 1000;
    const adjustedMs = scheduledMs + stopTimeUpdate.arrival.delay * 1000;

    const adjustedDate = new Date(adjustedMs);
    const timeStr = adjustedDate.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    });

    return {
      time: timeStr,
      delay: formatDelay(stopTimeUpdate.arrival.delay),
      isRealtime: true,
    };
  }

  return {
    time: scheduledTime,
    isRealtime: false,
  };
}
