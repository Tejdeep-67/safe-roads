"""
Potholes Routes
Get potholes and potholes on route endpoints
"""

from flask import Blueprint, request, jsonify, current_app
from utils.database import DatabaseManager
from utils.route_filter import filter_potholes_by_route
import logging

logger = logging.getLogger(__name__)

potholes_bp = Blueprint('potholes', __name__)


@potholes_bp.route('', methods=['GET'])
def get_all_potholes():
    """Get all verified potholes"""
    try:
        db_manager = DatabaseManager(current_app.db)
        potholes = db_manager.get_all_verified_potholes()
        
        # Convert ObjectId to string and rename to 'id' for frontend compatibility
        for pothole in potholes:
            pothole['id'] = str(pothole['_id'])
            del pothole['_id']
            if 'reported_by' in pothole and pothole['reported_by']:
                pothole['reported_by'] = str(pothole['reported_by'])
        
        return jsonify({
            'total': len(potholes),
            'potholes': potholes
        }), 200
    
    except Exception as e:
        logger.error(f"Get potholes error: {e}")
        return jsonify({'error': 'Failed to retrieve potholes'}), 500


@potholes_bp.route('/<pothole_id>', methods=['GET'])
def get_pothole(pothole_id):
    """Get a specific pothole by ID"""
    try:
        db_manager = DatabaseManager(current_app.db)
        pothole = db_manager.get_pothole(pothole_id)
        
        if not pothole:
            return jsonify({'error': 'Pothole not found'}), 404
        
        # Convert ObjectId to string and rename to 'id' for frontend compatibility
        pothole['id'] = str(pothole['_id'])
        del pothole['_id']
        if 'reported_by' in pothole and pothole['reported_by']:
            pothole['reported_by'] = str(pothole['reported_by'])
        
        return jsonify(pothole), 200
    
    except Exception as e:
        logger.error(f"Get pothole error: {e}")
        return jsonify({'error': 'Failed to retrieve pothole'}), 500


@potholes_bp.route('/near/<latitude>/<longitude>', methods=['GET'])
def get_potholes_near(latitude, longitude):
    """Get potholes near a specific location"""
    try:
        latitude = float(latitude)
        longitude = float(longitude)
        radius_km = float(request.args.get('radius', 2))
        
        db_manager = DatabaseManager(current_app.db)
        potholes = db_manager.get_potholes_near_location(latitude, longitude, radius_km)
        
        # Convert ObjectId to string and rename to 'id' for frontend compatibility
        for pothole in potholes:
            pothole['id'] = str(pothole['_id'])
            del pothole['_id']
            if 'reported_by' in pothole and pothole['reported_by']:
                pothole['reported_by'] = str(pothole['reported_by'])
        
        return jsonify({
            'latitude': latitude,
            'longitude': longitude,
            'radius_km': radius_km,
            'total': len(potholes),
            'potholes': potholes
        }), 200
    
    except ValueError:
        return jsonify({'error': 'Invalid coordinates'}), 400
    except Exception as e:
        logger.error(f"Get nearby potholes error: {e}")
        return jsonify({'error': 'Failed to retrieve potholes'}), 500


@potholes_bp.route('/on-route', methods=['POST'])
def get_potholes_on_route():
    """Get potholes along a specific route"""
    try:
        data = request.get_json()
        
        if 'route_coordinates' not in data:
            return jsonify({'error': 'Missing route_coordinates'}), 400
        
        route_coordinates = data['route_coordinates']
        buffer_meters = float(data.get('buffer_meters', 30))
        
        if not isinstance(route_coordinates, list) or len(route_coordinates) < 2:
            return jsonify({'error': 'Invalid route coordinates'}), 400
        
        # Get all verified potholes
        db_manager = DatabaseManager(current_app.db)
        all_potholes = db_manager.get_all_verified_potholes()
        
        # Filter potholes by route
        potholes_on_route = filter_potholes_by_route(
            all_potholes,
            route_coordinates,
            buffer_meters
        )
        
        # Convert ObjectId to string and rename to 'id' for frontend compatibility
        for pothole in potholes_on_route:
            pothole['id'] = str(pothole['_id'])
            del pothole['_id']
            if 'reported_by' in pothole and pothole['reported_by']:
                pothole['reported_by'] = str(pothole['reported_by'])
        
        # Generate warning message if potholes found
        warning_message = None
        if potholes_on_route:
            count = len(potholes_on_route)
            avg_distance = sum(
                pothole.get('distance_to_start', 0) 
                for pothole in potholes_on_route
            ) / count if count > 0 else 0
            
            warning_message = f"⚠️ {count} pothole{'s' if count != 1 else ''} ahead in the next {int(avg_distance/1000)} km"
        
        return jsonify({
            'total': len(potholes_on_route),
            'buffer_meters': buffer_meters,
            'potholes': potholes_on_route,
            'warning': warning_message
        }), 200
    
    except ValueError:
        return jsonify({'error': 'Invalid parameters'}), 400
    except Exception as e:
        logger.error(f"Get potholes on route error: {e}")
        return jsonify({'error': 'Failed to retrieve potholes on route'}), 500


@potholes_bp.route('/<pothole_id>/verify', methods=['PUT'])
def verify_pothole(pothole_id):
    """Verify a pothole (admin operation)"""
    try:
        db_manager = DatabaseManager(current_app.db)
        pothole = db_manager.get_pothole(pothole_id)
        
        if not pothole:
            return jsonify({'error': 'Pothole not found'}), 404
        
        data = request.get_json()
        verified = data.get('verified', True)
        
        db_manager.update_pothole_verification(pothole_id, verified)
        
        return jsonify({
            'message': f'Pothole {"verified" if verified else "unverified"}',
            'pothole_id': pothole_id
        }), 200
    
    except Exception as e:
        logger.error(f"Verify pothole error: {e}")
        return jsonify({'error': 'Failed to verify pothole'}), 500
