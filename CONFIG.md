# Configuration Guide

## Environment Variables

### Backend Configuration

#### MongoDB
```env
# Local MongoDB
MONGODB_URI=mongodb://localhost:27017

# MongoDB Atlas (Cloud)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net

# Database Name
DB_NAME=pothole_detection
```

#### Flask
```env
# Development
FLASK_ENV=development
FLASK_DEBUG=True

# Production
FLASK_ENV=production
FLASK_DEBUG=False
```

#### JWT Authentication
```env
# Change this to a random string in production!
JWT_SECRET_KEY=your-super-secret-key-change-in-production

# Token expiration in days
JWT_EXPIRATION_DAYS=30
```

#### YOLOv8 Model
```env
# Path to YOLOv8 model weights
YOLO_MODEL_PATH=models/best.pt

# Confidence threshold for detection (0-1)
YOLO_CONFIDENCE_THRESHOLD=0.25
```

#### File Upload
```env
# Maximum file size in bytes (50MB)
MAX_CONTENT_LENGTH=52428800

# Upload directory
UPLOAD_FOLDER=./uploads

# Allowed file extensions
ALLOWED_EXTENSIONS=jpg,jpeg,png,gif
```

#### Pothole Filtering
```env
# Buffer distance in meters for route-based filtering
ROUTE_BUFFER_METERS=30

# Minimum confidence for pothole verification
MIN_CONFIDENCE_THRESHOLD=0.70

# Minimum reports needed for automatic verification
MIN_REPORTS_FOR_VERIFICATION=3
```

#### Server
```env
# Server host and port
FLASK_HOST=0.0.0.0
FLASK_PORT=5000

# Allowed origins for CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

---

### Frontend Configuration

#### API
```env
# Backend API endpoint
VITE_API_URL=http://localhost:5000/api

# API timeout in milliseconds
VITE_API_TIMEOUT=30000
```

#### Maps
```env
# Note: We use free OpenStreetMap + Leaflet
# No API keys needed!

# Default map center
VITE_MAP_CENTER=28.6139,77.2090

# Default zoom level
VITE_MAP_ZOOM=5

# Route buffer in meters
VITE_ROUTE_BUFFER=30
```

#### Features
```env
# Enable/disable features
VITE_ENABLE_DEMO_MODE=false
VITE_ENABLE_ANALYTICS=false
```

---

## Complete Example .env Files

### Backend Example
```env
# MongoDB
MONGODB_URI=mongodb://localhost:27017
DB_NAME=pothole_detection

# JWT
JWT_SECRET_KEY=my-super-secret-key-12345
JWT_EXPIRATION_DAYS=30

# Flask
FLASK_ENV=development
FLASK_DEBUG=True
FLASK_HOST=0.0.0.0
FLASK_PORT=5000

# YOLOv8
YOLO_MODEL_PATH=models/best.pt
YOLO_CONFIDENCE_THRESHOLD=0.25

# File Upload
MAX_CONTENT_LENGTH=52428800
UPLOAD_FOLDER=./uploads

# Pothole Detection
ROUTE_BUFFER_METERS=30
MIN_CONFIDENCE_THRESHOLD=0.70
MIN_REPORTS_FOR_VERIFICATION=3

# CORS
CORS_ORIGINS=http://localhost:5173
```

### Frontend Example
```env
# API
VITE_API_URL=http://localhost:5000/api
VITE_API_TIMEOUT=30000

# Maps
VITE_MAP_CENTER=28.6139,77.2090
VITE_MAP_ZOOM=5
VITE_ROUTE_BUFFER=30

# Features
VITE_ENABLE_DEMO_MODE=false
VITE_ENABLE_ANALYTICS=false
```

---

## Configuration by Environment

### Development

**Backend .env:**
```env
FLASK_ENV=development
FLASK_DEBUG=True
MONGODB_URI=mongodb://localhost:27017
JWT_SECRET_KEY=dev-secret-change-me
```

**Frontend .env:**
```env
VITE_API_URL=http://localhost:5000/api
VITE_ENABLE_DEMO_MODE=true
```

### Staging

**Backend .env:**
```env
FLASK_ENV=production
FLASK_DEBUG=False
MONGODB_URI=mongodb+srv://user:pass@staging.mongodb.net
JWT_SECRET_KEY=<generate-random-key>
```

**Frontend .env:**
```env
VITE_API_URL=https://api-staging.herokuapp.com/api
VITE_ENABLE_DEMO_MODE=false
```

### Production

**Backend .env:**
```env
FLASK_ENV=production
FLASK_DEBUG=False
MONGODB_URI=mongodb+srv://user:pass@prod.mongodb.net
JWT_SECRET_KEY=<very-random-secure-key>
FLASK_HOST=0.0.0.0
FLASK_PORT=5000
```

**Frontend .env:**
```env
VITE_API_URL=https://api.yourdomain.com/api
VITE_ENABLE_DEMO_MODE=false
```

---

## Configuration Options in Code

### YOLOv8 Detection Settings

File: `backend/utils/detection.py`

```python
# Confidence threshold
CONFIDENCE_THRESHOLD = 0.25  # Lower = more detections but more false positives

# Model selection
MODEL_PATH = 'models/best.pt'  # Can be yolov8n, yolov8s, yolov8m, etc.

# Device (CPU or GPU)
DEVICE = 'cuda:0'  # or 'cpu'
```

### Route Filtering Settings

File: `backend/utils/route_filter.py`

```python
# Buffer distance in degrees (convert to meters)
BUFFER_DEGREES = 0.0003  # ≈ 30 meters at equator

# Haversine distance calculation for precise GPS
R = 6371000  # Earth radius in meters
```

### Map Component Settings

File: `src/components/Map.tsx`

```typescript
// Default map center
const DEFAULT_CENTER = [20.5937, 78.9629];

// Default zoom level
const DEFAULT_ZOOM = 5;

// Pothole display settings
const POTHOLE_ICON_SIZE = [32, 32];
const ROUTE_BUFFER = 30; // meters
```

---

## Database Configuration

### MongoDB Connection Strings

#### Local
```
mongodb://localhost:27017
```

#### Atlas Cloud
```
mongodb+srv://username:password@cluster.mongodb.net/database_name?retryWrites=true&w=majority
```

#### Custom Server
```
mongodb://username:password@host:port/database_name
```

### Database Indexes (Optional but Recommended)

```javascript
// Run in MongoDB to create indexes for better performance

// Pothole location index
db.potholes.createIndex({ 
  latitude: 1, 
  longitude: 1 
});

// User reports index
db.reports.createIndex({ 
  user_id: 1, 
  created_at: -1 
});

// Verified status index
db.potholes.createIndex({ 
  verified: 1 
});
```

---

## Security Configuration

### Secret Key Generation

```bash
# Python
python -c "import secrets; print(secrets.token_urlsafe(32))"

# openssl
openssl rand -base64 32

# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Recommended Security Settings for Production

```env
# Very long, random secret key
JWT_SECRET_KEY=<64-character-random-string>

# Disable debug mode
FLASK_DEBUG=False

# Use HTTPS
FLASK_ENV=production

# Set CORS to specific domains only
CORS_ORIGINS=https://yourdomain.com

# Use environment variables for sensitive data
# Never commit credentials to git
```

### .gitignore

```
# Environment files
.env
.env.local
.env.*.local

# Dependencies
node_modules/
venv/
__pycache__/

# Uploads
backend/uploads/

# Logs
*.log
logs/

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp

# Build
dist/
build/
```

---

## Performance Tuning

### YOLOv8 Model Size vs Speed

| Model | Size | Speed | Accuracy |
|-------|------|-------|----------|
| YOLOv8n (nano) | ~7MB | Fastest | Lowest |
| YOLOv8s (small) | ~22MB | Fast | Low |
| YOLOv8m (medium) | ~50MB | Balanced | Medium |
| YOLOv8l (large) | ~100MB | Slow | High |
| YOLOv8x (xlarge) | ~150MB | Slowest | Highest |

**Recommendation:** Use `yolov8s.pt` or `yolov8m.pt` for best balance

### Database Performance

```env
# For large datasets, consider:
# 1. Add proper indexes
# 2. Use pagination in API responses
# 3. Cache frequently accessed data
# 4. Use database connection pooling
```

### API Response Caching

```typescript
// Frontend - Cache pothole list for 5 minutes
const CACHE_DURATION = 5 * 60 * 1000;
```

---

## Troubleshooting Configuration Issues

### MongoDB Connection Failed
- Check `MONGODB_URI` syntax
- Verify MongoDB is running
- Check firewall/network access
- Test with MongoDB Atlas connection string

### CORS Errors
- Verify `CORS_ORIGINS` includes frontend URL
- Check frontend `VITE_API_URL` matches backend
- Ensure trailing slashes are consistent

### YOLOv8 Model Not Found
- Verify `YOLO_MODEL_PATH` is correct
- Check file exists: `ls backend/models/best.pt`
- Ensure model format is `.pt`

### File Upload Issues
- Check `MAX_CONTENT_LENGTH` is large enough
- Verify `UPLOAD_FOLDER` directory exists
- Check file permissions
- Ensure disk space available

---

## Additional Resources

- [MongoDB Documentation](https://docs.mongodb.com/)
- [Flask Documentation](https://flask.palletsprojects.com/)
- [Ultralytics YOLOv8](https://docs.ultralytics.com/)
- [Vite Configuration](https://vitejs.dev/config/)
- [React Documentation](https://react.dev/)

---

For setup help, see [QUICK_START.md](./QUICK_START.md)
