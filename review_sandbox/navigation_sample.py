"""Standalone review fixture; never imported by the RoadbookNavi application."""


def remaining_distance(total_meters, travelled_meters):
    """Return the remaining distance in meters, clamped to zero after arrival."""
    return max(0, total_meters - travelled_meters)


def next_waypoint(waypoints, current_index):
    """Return the next waypoint, or None when already at the final waypoint."""
    next_index = current_index + 1
    if next_index < len(waypoints):
        return waypoints[next_index]
    return None


def kilometers_to_meters(kilometers):
    """Convert a distance in kilometers, including fractional kilometers, to meters."""
    return kilometers * 1000
