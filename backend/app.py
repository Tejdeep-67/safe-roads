"""
Pothole Detection and Hazard-Aware Navigation System
Flask Backend - Main Application
"""

import os
from dotenv import load_dotenv
from flask import Flask, send_file
from flask_cors import CORS
from pymongo import MongoClient

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)

# Enable CORS
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Configure static file serving for uploads
app.config['JSON_SORT_KEYS'] = False
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

# Serve uploads folder as static files
@app.route('/uploads/<path:filename>')
def serve_upload(filename):
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    if not os.path.exists(filepath):
        return {'error': 'File not found'}, 404
    return send_file(filepath, mimetype='image/jpeg')

# MongoDB Configuration
MONGO_URI = os.getenv('MONGODB_URI', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'pothole_detection')

# Connect to MongoDB
try:
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    print("✅ Connected to MongoDB")
except Exception as e:
    print(f"❌ Failed to connect to MongoDB: {e}")

# Store db in app context
app.db = db

# Import routes
from routes.auth import auth_bp
from routes.reports import reports_bp
from routes.potholes import potholes_bp
from routes.users import users_bp

# Register blueprints
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(reports_bp, url_prefix='/api/reports')
app.register_blueprint(potholes_bp, url_prefix='/api/potholes')
app.register_blueprint(users_bp, url_prefix='/api/users')

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return {
        'status': 'healthy',
        'message': 'Pothole Detection API is running'
    }, 200

@app.errorhandler(404)
def not_found(error):
    return {'error': 'Not found'}, 404

@app.errorhandler(500)
def internal_error(error):
    return {'error': 'Internal server error'}, 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
