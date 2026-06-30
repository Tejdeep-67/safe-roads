"""
Authentication Routes
User registration and login endpoints
"""

from flask import Blueprint, request, jsonify, current_app
from utils.auth import generate_token, hash_password, verify_password, decode_token
from utils.database import DatabaseManager
import logging

logger = logging.getLogger(__name__)

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/register', methods=['POST'])
def register():
    """User registration endpoint"""
    try:
        data = request.get_json()
        
        if not data or not all(k in data for k in ['email', 'password', 'full_name']):
            return jsonify({'error': 'Missing required fields'}), 400
        
        email = data['email'].lower()
        password = data['password']
        full_name = data['full_name']
        
        # Validate inputs
        if len(password) < 6:
            return jsonify({'error': 'Password must be at least 6 characters'}), 400
        
        # Check if user already exists
        db_manager = DatabaseManager(current_app.db)
        existing_user = db_manager.get_user_by_email(email)
        
        if existing_user:
            return jsonify({'error': 'User already exists'}), 409
        
        # Create user
        password_hash = hash_password(password)
        user_id = db_manager.create_user(email, password_hash, full_name)
        
        # Generate token
        token = generate_token(str(user_id), email)
        
        return jsonify({
            'message': 'User registered successfully',
            'token': token,
            'user': {
                'id': str(user_id),
                'email': email,
                'full_name': full_name
            }
        }), 201
    
    except Exception as e:
        logger.error(f"Registration error: {e}")
        return jsonify({'error': 'Registration failed'}), 500


@auth_bp.route('/login', methods=['POST'])
def login():
    """User login endpoint"""
    try:
        data = request.get_json()
        
        if not data or not all(k in data for k in ['email', 'password']):
            return jsonify({'error': 'Missing email or password'}), 400
        
        email = data['email'].lower()
        password = data['password']
        
        # Find user
        db_manager = DatabaseManager(current_app.db)
        user = db_manager.get_user_by_email(email)
        
        if not user or not verify_password(password, user['password_hash']):
            return jsonify({'error': 'Invalid email or password'}), 401
        
        # Generate token
        token = generate_token(str(user['_id']), email)
        
        return jsonify({
            'message': 'Login successful',
            'token': token,
            'user': {
                'id': str(user['_id']),
                'email': user['email'],
                'full_name': user['full_name']
            }
        }), 200
    
    except Exception as e:
        logger.error(f"Login error: {e}")
        return jsonify({'error': 'Login failed'}), 500


@auth_bp.route('/verify', methods=['GET'])
def verify_token():
    """Verify token endpoint"""
    try:
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(' ')[1]
            except IndexError:
                return jsonify({'error': 'Invalid authorization header'}), 401
        
        if not token:
            return jsonify({'error': 'Token is missing'}), 401
        
        payload = decode_token(token)
        if not payload:
            return jsonify({'error': 'Invalid or expired token'}), 401
        
        return jsonify({
            'valid': True,
            'user_id': payload['user_id'],
            'email': payload['email']
        }), 200
    
    except Exception as e:
        logger.error(f"Token verification error: {e}")
        return jsonify({'error': 'Verification failed'}), 500
