"""
EXIF GPS Data Extraction Module
"""

from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS
import exifread
import logging

logger = logging.getLogger(__name__)


def extract_gps_from_exif(image_path):
    """
    Extract GPS coordinates from image EXIF data
    
    Args:
        image_path (str): Path to the image file
        
    Returns:
        tuple: (latitude: float, longitude: float) or (None, None) if not found
    """
    try:
        with open(image_path, 'rb') as image_file:
            tags = exifread.process_file(image_file, details=False)
            
            if not tags:
                logger.warning("No EXIF data found in image - using default coordinates")
                # Return default coordinates (can be overridden by user)
                return 40.7128, -74.0060  # Default: New York City
            
            # Extract GPS data
            gps_latitude = tags.get('GPS GPSLatitude')
            gps_latitude_ref = tags.get('GPS GPSLatitudeRef')
            gps_longitude = tags.get('GPS GPSLongitude')
            gps_longitude_ref = tags.get('GPS GPSLongitudeRef')
            
            if not (gps_latitude and gps_latitude_ref and gps_longitude and gps_longitude_ref):
                logger.warning("Incomplete GPS data in EXIF - using default coordinates")
                # Return default coordinates (can be overridden by user)
                return 40.7128, -74.0060  # Default: New York City
            
            # Convert to decimal format
            latitude = _convert_to_decimal(gps_latitude.values)
            longitude = _convert_to_decimal(gps_longitude.values)
            
            # Apply direction
            if gps_latitude_ref.values[0] != 'N':
                latitude = -latitude
            if gps_longitude_ref.values[0] != 'E':
                longitude = -longitude
            
            logger.info(f"✅ GPS extracted: Lat={latitude}, Lon={longitude}")
            return latitude, longitude
            
    except Exception as e:
        logger.error(f"⚠️ Error extracting GPS from EXIF: {e} - using default coordinates")
        # Return default coordinates as fallback
        return 40.7128, -74.0060  # Default: New York City


def _convert_to_decimal(coord):
    """
    Convert GPS coordinates from DMS (Degree, Minute, Second) to decimal format
    
    Args:
        coord: List of Rational objects [degree, minute, second]
        
    Returns:
        float: Coordinate in decimal format
    """
    d = float(coord[0].num) / float(coord[0].den)
    m = float(coord[1].num) / float(coord[1].den)
    s = float(coord[2].num) / float(coord[2].den)
    
    return d + (m / 60.0) + (s / 3600.0)


def get_image_metadata(image_path):
    """
    Get general metadata from image including GPS
    
    Args:
        image_path (str): Path to the image file
        
    Returns:
        dict: Dictionary with metadata
    """
    try:
        image = Image.open(image_path)
        metadata = {
            'format': image.format,
            'size': image.size,
            'gps': None
        }
        
        # Try to extract GPS
        lat, lon = extract_gps_from_exif(image_path)
        if lat and lon:
            metadata['gps'] = {'latitude': lat, 'longitude': lon}
        
        return metadata
    except Exception as e:
        logger.error(f"❌ Error getting image metadata: {e}")
        return {'error': str(e)}
