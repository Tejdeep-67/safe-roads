"""
Database Utilities
MongoDB operations
"""

from bson.objectid import ObjectId
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class DatabaseManager:
    """Manager for MongoDB operations"""
    
    def __init__(self, db):
        self.db = db
        self.users_collection = db['users']
        self.potholes_collection = db['potholes']
        self.reports_collection = db['reports']
    
    # User operations
    def create_user(self, email, password_hash, full_name):
        """Create a new user"""
        user = {
            'email': email,
            'password_hash': password_hash,
            'full_name': full_name,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        result = self.users_collection.insert_one(user)
        return result.inserted_id
    
    def get_user_by_email(self, email):
        """Get user by email"""
        return self.users_collection.find_one({'email': email})
    
    def get_user_by_id(self, user_id):
        """Get user by ID"""
        return self.users_collection.find_one({'_id': ObjectId(user_id)})
    
    def get_user_reports(self, user_id):
        """Get all reports by a user"""
        return list(self.reports_collection.find({'user_id': user_id}))
    
    # Pothole operations
    def create_pothole(self, latitude, longitude, confidence, image_url=None, user_id=None, verified=False):
        """Create a new pothole entry"""
        pothole = {
            'latitude': latitude,
            'longitude': longitude,
            'confidence': confidence,
            'image_url': image_url,
            'reported_by': user_id,
            'verified': bool(verified),
            'report_count': 1,
            'severity': self._get_severity(confidence),
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        result = self.potholes_collection.insert_one(pothole)
        return result.inserted_id
    
    def get_pothole(self, pothole_id):
        """Get pothole by ID"""
        return self.potholes_collection.find_one({'_id': ObjectId(pothole_id)})
    
    def get_all_verified_potholes(self):
        """Get all verified potholes"""
        return list(self.potholes_collection.find({'verified': True}))
    
    def get_potholes_near_location(self, latitude, longitude, radius_km=2):
        """Get potholes near a location (using geospatial query)"""
        # Using simple distance calculation (in production, use MongoDB geospatial index)
        from math import radians, cos, sin, asin, sqrt
        
        potholes = self.get_all_verified_potholes()
        nearby = []
        
        for pothole in potholes:
            distance = self._haversine_distance(
                latitude, longitude,
                pothole['latitude'], pothole['longitude']
            )
            if distance <= radius_km:
                nearby.append(pothole)
        
        return nearby
    
    def update_pothole_verification(self, pothole_id, verified=True):
        """Update pothole verification status"""
        self.potholes_collection.update_one(
            {'_id': ObjectId(pothole_id)},
            {
                '$set': {
                    'verified': verified,
                    'updated_at': datetime.utcnow()
                }
            }
        )
    
    def increment_pothole_reports(self, pothole_id):
        """Increment the report count for a pothole"""
        self.potholes_collection.update_one(
            {'_id': ObjectId(pothole_id)},
            {
                '$inc': {'report_count': 1},
                '$set': {'updated_at': datetime.utcnow()}
            }
        )
    
    # Report operations
    def create_report(self, user_id, latitude, longitude, image_url, confidence):
        """Create a new pothole report"""
        # Check if pothole already exists at this location (simple distance check)
        # Using a 30 meter radius (approximately 0.0003 degrees)
        existing_potholes = self.potholes_collection.find({
            'latitude': {'$gte': latitude - 0.0005, '$lte': latitude + 0.0005},
            'longitude': {'$gte': longitude - 0.0005, '$lte': longitude + 0.0005}
        })
        
        pothole_id = None
        for pothole in existing_potholes:
            # Check if within 30 meters
            distance = self._haversine_distance(latitude, longitude, pothole['latitude'], pothole['longitude'])
            if distance <= 0.03:  # 30 meters
                pothole_id = pothole['_id']
                self.increment_pothole_reports(str(pothole_id))
                break
        
        report_status = 'pending'

        if not pothole_id:
            # If an image was uploaded, mark the pothole as verified so it appears on the map
            pothole_id = self.create_pothole(
                latitude, longitude, confidence, image_url, user_id, verified=bool(image_url)
            )
            if image_url:
                report_status = 'verified'
        else:
            # Existing pothole: increment report count and mark verified if we have an image
            if image_url:
                try:
                    self.update_pothole_verification(str(pothole_id), True)
                except Exception:
                    pass
                report_status = 'verified'

        report = {
            'user_id': user_id,
            'pothole_id': str(pothole_id),
            'latitude': latitude,
            'longitude': longitude,
            'image_url': image_url,
            'confidence': confidence,
            'status': report_status,
            'created_at': datetime.utcnow()
        }
        
        result = self.reports_collection.insert_one(report)
        return {
            'report_id': str(result.inserted_id),
            'pothole_id': str(pothole_id)
        }
    
    def get_report(self, report_id):
        """Get report by ID"""
        return self.reports_collection.find_one({'_id': ObjectId(report_id)})
    
    def delete_report(self, report_id):
        """Delete a report"""
        report = self.get_report(report_id)
        if report:
            self.reports_collection.delete_one({'_id': ObjectId(report_id)})
            return True
        return False
    
    def update_report_status(self, report_id, status):
        """Update report status"""
        self.reports_collection.update_one(
            {'_id': ObjectId(report_id)},
            {'$set': {'status': status}}
        )
    
    # Helper methods
    @staticmethod
    def _get_severity(confidence):
        """Determine severity level based on confidence"""
        if confidence >= 0.85:
            return 'high'
        elif confidence >= 0.70:
            return 'medium'
        else:
            return 'low'
    
    @staticmethod
    def _haversine_distance(lat1, lon1, lat2, lon2):
        """Calculate distance between two points in kilometers"""
        from math import radians, cos, sin, asin, sqrt
        
        lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])
        dlon = lon2 - lon1
        dlat = lat2 - lat1
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
        c = 2 * asin(sqrt(a))
        r = 6371  # Radius of earth in kilometers
        return c * r
