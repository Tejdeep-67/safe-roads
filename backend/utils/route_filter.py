"""
Route-based Pothole Filtering Module
"""

import math
import logging

logger = logging.getLogger(__name__)


def is_point_near_route(point, route_coordinates, buffer_meters=30):
    """
    Check if a point (pothole) is near the route with a buffer
    
    Args:
        point (tuple): (latitude, longitude) of the pothole
        route_coordinates (list): List of [lon, lat] coordinate pairs of the route
        buffer_meters (float): Buffer distance in meters (default 30m)
        
    Returns:
        bool: True if point is within buffer of route
    """
    if not route_coordinates or len(route_coordinates) < 2:
        return False
    
    # Convert buffer from meters to degrees (approximate)
    # 1 degree ≈ 111 km at equator
    buffer_degrees = buffer_meters / (111 * 1000)
    
    point_lat, point_lon = point
    
    # Check distance to each route segment
    for i in range(len(route_coordinates) - 1):
        route_point1 = route_coordinates[i]
        route_point2 = route_coordinates[i + 1]
        
        # Calculate distance from point to line segment
        distance = point_to_segment_distance(
            (point_lon, point_lat),
            (route_point1[0], route_point1[1]),
            (route_point2[0], route_point2[1])
        )
        
        if distance <= buffer_degrees:
            return True
    
    return False


def point_to_segment_distance(point, seg_start, seg_end):
    """
    Calculate minimum distance from point to line segment using
    perpendicular distance
    
    Args:
        point (tuple): (x, y) - point coordinates
        seg_start (tuple): (x1, y1) - segment start
        seg_end (tuple): (x2, y2) - segment end
        
    Returns:
        float: Distance in degrees
    """
    x, y = point
    x1, y1 = seg_start
    x2, y2 = seg_end
    
    # Calculate the vector from seg_start to seg_end
    dx = x2 - x1
    dy = y2 - y1
    
    if dx == 0 and dy == 0:
        # seg_start and seg_end are the same
        return math.sqrt((x - x1) ** 2 + (y - y1) ** 2)
    
    # Calculate the parameter t for the perpendicular projection
    t = max(0, min(1, ((x - x1) * dx + (y - y1) * dy) / (dx ** 2 + dy ** 2)))
    
    # Calculate the closest point on the segment
    closest_x = x1 + t * dx
    closest_y = y1 + t * dy
    
    # Calculate the distance
    distance = math.sqrt((x - closest_x) ** 2 + (y - closest_y) ** 2)
    
    return distance


def filter_potholes_by_route(potholes, route_coordinates, buffer_meters=30):
    """
    Filter a list of potholes to only those near the route
    
    Args:
        potholes (list): List of pothole documents
        route_coordinates (list): List of [lon, lat] coordinate pairs
        buffer_meters (float): Buffer distance in meters (default 30m)
        
    Returns:
        list: Filtered list of potholes
    """
    filtered = []
    
    for pothole in potholes:
        if is_point_near_route(
            (pothole['latitude'], pothole['longitude']),
            route_coordinates,
            buffer_meters
        ):
            filtered.append(pothole)
    
    logger.info(f"Filtered {len(filtered)} potholes from {len(potholes)} total")
    return filtered


def calculate_distance_in_meters(lat1, lon1, lat2, lon2):
    """
    Calculate distance between two points using Haversine formula
    
    Args:
        lat1, lon1: First point coordinates
        lat2, lon2: Second point coordinates
        
    Returns:
        float: Distance in meters
    """
    R = 6371000  # Earth's radius in meters
    
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = math.sin(delta_phi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda/2)**2
    c = 2 * math.asin(math.sqrt(a))
    
    return R * c


def get_closest_pothole_on_route(potholes, source, destination):
    """
    Find the closest pothole to the start of the route
    
    Args:
        potholes (list): List of filtered pothole documents
        source (tuple): (lat, lon) of source
        destination (tuple): (lat, lon) of destination
        
    Returns:
        dict or None: Closest pothole or None
    """
    if not potholes:
        return None
    
    closest = None
    min_distance = float('inf')
    
    for pothole in potholes:
        distance = calculate_distance_in_meters(
            source[0], source[1],
            pothole['latitude'], pothole['longitude']
        )
        
        if distance < min_distance:
            min_distance = distance
            closest = pothole
            closest['distance_to_start'] = distance
    
    return closest
