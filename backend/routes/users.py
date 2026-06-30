"""
Users Routes
User profile and report management
"""

from flask import Blueprint, request, jsonify, current_app
from utils.auth import token_required
from utils.database import DatabaseManager
import logging

logger = logging.getLogger(__name__)

users_bp = Blueprint('users', __name__)


@users_bp.route('/profile', methods=['GET'])
@token_required
def get_profile():
    """Get user profile"""
    try:
        db_manager = DatabaseManager(current_app.db)
        user = db_manager.get_user_by_id(request.user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify({
            'id': str(user['_id']),
            'email': user['email'],
            'full_name': user['full_name'],
            'created_at': user['created_at'].isoformat(),
            'updated_at': user['updated_at'].isoformat()
        }), 200
    
    except Exception as e:
        logger.error(f"Get profile error: {e}")
        return jsonify({'error': 'Failed to retrieve profile'}), 500


@users_bp.route('/reports', methods=['GET'])
@token_required
def get_user_reports():
    """Get all reports by the current user"""
    try:
        db_manager = DatabaseManager(current_app.db)
        reports = db_manager.get_user_reports(request.user_id)
        
        # Convert ObjectId to string for JSON serialization
        for report in reports:
            report['_id'] = str(report['_id'])
            # Convert datetime to ISO string
            if 'created_at' in report and hasattr(report['created_at'], 'isoformat'):
                report['created_at'] = report['created_at'].isoformat()
            # pothole_id already stored as string
        
        return jsonify({
            'total': len(reports),
            'reports': reports
        }), 200
    
    except Exception as e:
        logger.error(f"Get user reports error: {e}")
        return jsonify({'error': 'Failed to retrieve reports'}), 500


@users_bp.route('/stats', methods=['GET'])
@token_required
def get_user_stats():
    """Get user statistics"""
    try:
        db_manager = DatabaseManager(current_app.db)
        reports = db_manager.get_user_reports(request.user_id)
        
        total_reports = len(reports)
        verified_reports = sum(1 for r in reports if r['status'] == 'verified')
        pending_reports = sum(1 for r in reports if r['status'] == 'pending')
        
        return jsonify({
            'total_reports': total_reports,
            'verified_reports': verified_reports,
            'pending_reports': pending_reports,
            'rejection_rate': (total_reports - verified_reports) / total_reports * 100 if total_reports > 0 else 0
        }), 200
    
    except Exception as e:
        logger.error(f"Get user stats error: {e}")
        return jsonify({'error': 'Failed to retrieve stats'}), 500
