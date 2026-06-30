"""
Authentication Utilities
JWT-based authentication for the API
"""

import os
import jwt
import logging
from datetime import datetime, timedelta
from functools import wraps
from flask import request, jsonify

logger = logging.getLogger(__name__)

# Secret key for JWT
SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'your-secret-key-change-in-production')

def generate_token(user_id, user_email):
    """
    Generate JWT token for a user
    
    Args:
        user_id (str): User ID
        user_email (str): User email
        
    Returns:
        str: JWT token
    """
    payload = {
        'user_id': str(user_id),
        'email': user_email,
        'iat': datetime.utcnow(),
        'exp': datetime.utcnow() + timedelta(days=30)
    }
    
    token = jwt.encode(payload, SECRET_KEY, algorithm='HS256')
    return token


def decode_token(token):
    """
    Decode and verify JWT token
    
    Args:
        token (str): JWT token
        
    Returns:
        dict: Decoded token payload or None if invalid
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning("Token has expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid token: {e}")
        return None


def token_required(f):
    """
    Decorator to protect routes that require authentication
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Get token from Authorization header
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(' ')[1]
            except IndexError:
                return jsonify({'error': 'Invalid authorization header'}), 401
        
        if not token:
            return jsonify({'error': 'Token is missing'}), 401
        
        # Decode and verify token
        payload = decode_token(token)
        if not payload:
            return jsonify({'error': 'Invalid or expired token'}), 401
        
        # Attach user info to request
        request.user_id = payload['user_id']
        request.user_email = payload['email']
        
        return f(*args, **kwargs)
    
    return decorated


def hash_password(password):
    """
    Hash a password using simple hashing (in production, use bcrypt)
    
    Args:
        password (str): Plain text password
        
    Returns:
        str: Hashed password
    """
    import hashlib
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(password, hashed_password):
    """
    Verify a password against its hash
    
    Args:
        password (str): Plain text password
        hashed_password (str): Hashed password
        
    Returns:
        bool: True if password matches
    """
    import hashlib
    return hashlib.sha256(password.encode()).hexdigest() == hashed_password
