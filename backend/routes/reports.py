"""
Pothole Reports Routes
Upload, process, and manage pothole reports
"""

from flask import Blueprint, request, jsonify, current_app
from utils.auth import token_required
from utils.database import DatabaseManager
from utils.detection import detect_pothole
from utils.exif_handler import extract_gps_from_exif
from werkzeug.utils import secure_filename
import os
import logging
from uuid import uuid4

logger = logging.getLogger(__name__)

reports_bp = Blueprint('reports', __name__)

# Configure upload folder
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), '..', 'uploads')
ALLOWED_EXTENSIONS = {'jpg', 'jpeg', 'png', 'gif'}

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)


def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@reports_bp.route('/upload', methods=['POST'])
@token_required
def upload_report():
    """Upload and process a pothole report with image"""
    try:
        # Check if file is present
        if 'image' not in request.files:
            return jsonify({'error': 'No image file provided'}), 400
        
        file = request.files['image']
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'Invalid file format. Allowed: jpg, jpeg, png, gif'}), 400
        
        # Save the image
        filename = secure_filename(f"{uuid4()}_{file.filename}")
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        file.save(filepath)
        
        try:
            # Extract GPS coordinates from EXIF (with fallback to default coordinates)
            latitude, longitude = extract_gps_from_exif(filepath)
            
            if latitude is None or longitude is None:
                # Use default coordinates as fallback
                latitude, longitude = 40.7128, -74.0060
                logger.info(f"Using default coordinates: {latitude}, {longitude}")
            
            # Run pothole detection
            pothole_detected, confidence = detect_pothole(filepath)
            
            if not pothole_detected:
                os.remove(filepath)  # Clean up
                return jsonify({
                    'message': 'No pothole detected',
                    'confidence': confidence,
                    'latitude': latitude,
                    'longitude': longitude
                }), 200
            
            # Save report to database
            db_manager = DatabaseManager(current_app.db)
            image_url = f'/uploads/{filename}'
            
            result = db_manager.create_report(
                user_id=request.user_id,
                latitude=latitude,
                longitude=longitude,
                image_url=image_url,
                confidence=confidence
            )
            
            return jsonify({
                'message': 'Pothole detected and report created',
                'report_id': result['report_id'],
                'pothole_id': result['pothole_id'],
                'latitude': latitude,
                'longitude': longitude,
                'confidence': confidence,
                'image_url': image_url
            }), 201
        except Exception as db_error:
            logger.error(f"Database or processing error: {db_error}")
            # Try to clean up the file
            if os.path.exists(filepath):
                os.remove(filepath)
            return jsonify({'error': f'Failed to process image: {str(db_error)}'}), 500
    
    except Exception as e:
        logger.error(f"Upload error: {e}")
        return jsonify({'error': 'Upload failed. Please try again.'}), 500


@reports_bp.route('', methods=['POST'])
@token_required
def create_report():
    """Create a report with manual GPS coordinates (fallback)"""
    try:
        data = request.get_json()
        
        required_fields = ['latitude', 'longitude']
        if not all(k in data for k in required_fields):
            return jsonify({'error': 'Missing required fields'}), 400
        
        latitude = float(data['latitude'])
        longitude = float(data['longitude'])
        confidence = float(data.get('confidence', 0.75))
        image_url = data.get('image_url')
        
        db_manager = DatabaseManager(current_app.db)
        result = db_manager.create_report(
            user_id=request.user_id,
            latitude=latitude,
            longitude=longitude,
            image_url=image_url,
            confidence=confidence
        )
        
        return jsonify({
            'message': 'Report created',
            'report_id': result['report_id'],
            'pothole_id': result['pothole_id']
        }), 201
    
    except ValueError:
        return jsonify({'error': 'Invalid coordinate values'}), 400
    except Exception as e:
        logger.error(f"Create report error: {e}")
        return jsonify({'error': 'Failed to create report'}), 500


@reports_bp.route('/<report_id>', methods=['GET'])
@token_required
def get_report(report_id):
    """Get a specific report"""
    try:
        db_manager = DatabaseManager(current_app.db)
        report = db_manager.get_report(report_id)
        
        if not report:
            return jsonify({'error': 'Report not found'}), 404
        
        # Check if user owns the report
        if report['user_id'] != request.user_id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        # Convert ObjectId to string for JSON serialization
        report['_id'] = str(report['_id'])
        report['pothole_id'] = str(report['pothole_id'])
        
        return jsonify(report), 200
    
    except Exception as e:
        logger.error(f"Get report error: {e}")
        return jsonify({'error': 'Failed to retrieve report'}), 500


@reports_bp.route('/<report_id>', methods=['DELETE'])
@token_required
def delete_report(report_id):
    """Delete a report"""
    try:
        db_manager = DatabaseManager(current_app.db)
        report = db_manager.get_report(report_id)
        
        if not report:
            return jsonify({'error': 'Report not found'}), 404
        
        # Check if user owns the report
        if report['user_id'] != request.user_id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        # Delete the report
        db_manager.delete_report(report_id)
        
        # Clean up image file if exists
        if report.get('image_url'):
            image_filename = report['image_url'].split('/')[-1]
            image_path = os.path.join(UPLOAD_FOLDER, image_filename)
            if os.path.exists(image_path):
                os.remove(image_path)
        
        return jsonify({'message': 'Report deleted successfully'}), 200
    
    except Exception as e:
        logger.error(f"Delete report error: {e}")
        return jsonify({'error': 'Failed to delete report'}), 500
