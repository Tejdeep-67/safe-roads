# Pothole Detection and Hazard-Aware Navigation System

A semester project built with a free and open-source stack to improve road safety by detecting and reporting potholes in real-time.

## Project Overview

This system integrates pothole detection into a map-based navigation application, warning users only when potholes lie on their active navigation route. It combines YOLOv8-based computer vision with crowd-sourced reporting.

### Key Features

- **Navigation with Pothole Warnings**: Get directions with real-time pothole alerts on your route
- **Crowd-Sourced Reporting**: Upload pothole photos with GPS data for AI detection
- **Route-Based Filtering**: Potholes shown only when they intersect your active route
- **verification System**: Multiple reports increase confidence in detections
- **Free and Open-Source**: Built entirely with free APIs, tools, and libraries

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development
- **React Leaflet** for map rendering
- **OpenStreetMap** + Leaflet for mapping
- **Tailwind CSS** for styling
- **Axios** for API communication

### Backend
- **Flask 3.0** with Python
- **MongoDB** for data persistence
- **YOLOv8** for pothole detection
- **EXIF extraction** for GPS data from images
- **JWT** for authentication

### Free APIs & Services
- **OpenStreetMap (OSM)**: Map tiles
- **Nominatim**: Geolocation search
- **OSRM**: Open Source Routing Machine for directions
- **YOLOv8**: Computer vision model (local inference)

## Project Structure

```
project/
├── frontend/
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── contexts/          # Authentication context
│   │   ├── lib/               # API client and utilities
│   │   ├── types/             # TypeScript type definitions
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
│
└── backend/
    ├── app.py                 # Flask main application
    ├── routes/                # API endpoints
    │   ├── auth.py           # Authentication routes
    │   ├── reports.py        # Pothole report handling
    │   ├── potholes.py       # Pothole data endpoints
    │   └── users.py          # User profile endpoints
    ├── utils/
    │   ├── detection.py      # YOLOv8 pothole detection
    │   ├── exif_handler.py   # GPS data extraction
    │   ├── route_filter.py   # Route-based filtering
    │   ├── auth.py           # JWT authentication
    │   └── database.py       # MongoDB operations
    ├── uploads/              # User-uploaded images
    ├── requirements.txt      # Python dependencies
    ├── .env                  # Environment configuration
    └── models/
        └── best.pt          # YOLOv8 weights (download separately)
```

## Setup Instructions

### Prerequisites

- Python 3.9+ and pip
- Node.js 16+ and npm
- MongoDB (local or cloud instance)
- Git

### Backend Setup

1. **Navigate to backend directory**
   ```bash
   cd project/backend
   ```

2. **Create Python virtual environment**
   ```bash
   python -m venv venv
   
   # Windows
   venv\Scripts\activate
   
   # macOS/Linux
   source venv/bin/activate
   ```

3. **Install Python dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Download YOLOv8 model**
   ```bash
   mkdir models
   cd models
   # Download pre-trained model or your custom model
   # Place it as 'best.pt' in this directory
   cd ..
   ```

5. **Configure Environment**
   - Copy `.env` file and update values:
   ```bash
   cp .env.example .env
   ```
   - Edit `.env` with your MongoDB URI and other settings

6. **Start MongoDB**
   ```bash
   # If using local MongoDB
   mongod
   
   # Or use MongoDB Atlas for cloud database
   ```

7. **Run Flask server**
   ```bash
   python app.py
   ```
   Server will start at `http://localhost:5000`

### Frontend Setup

1. **Navigate to frontend directory**
   ```bash
   cd project
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   - Create `.env` file:
   ```env
   VITE_API_URL=http://localhost:5000/api
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```
   Access at `http://localhost:5173` (or port shown in terminal)

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/verify` - Verify token

### Users
- `GET /api/users/profile` - Get user profile
- `GET /api/users/reports` - Get user's reports
- `GET /api/users/stats` - Get user statistics

### Reports
- `POST /api/reports/upload` - Upload and process pothole image
- `POST /api/reports` - Create report with manual coordinates
- `GET /api/reports/<id>` - Get specific report
- `DELETE /api/reports/<id>` - Delete report

### Potholes
- `GET /api/potholes` - Get all verified potholes
- `GET /api/potholes/<id>` - Get specific pothole
- `GET /api/potholes/near/<lat>/<lon>` - Get nearby potholes
- `POST /api/potholes/on-route` - Get potholes on navigation route
- `PUT /api/potholes/<id>/verify` - Verify pothole (admin)

## How to Use

### For Navigation Users

1. **Open the app** and sign in / register
2. **Search for a destination** using the search bar (powered by Nominatim)
3. **Click "Directions"** to see the route
4. **Set source location** (current location or manual entry)
5. **Click "Start"** to begin navigation
6. **View pothole alerts** automatically shown on your route

### For Reporting Users

1. **Take a photo** of a pothole with a GPS-enabled camera
2. **Open app → Profile → Report Pothole**
3. **Upload the image**
4. **Backend processes:**
   - Extracts GPS coordinates from EXIF data
   - Runs YOLOv8 detection to verify pothole
   - Creates marker if confidence > threshold
5. **View your reports** in the "My Reports" tab

## Route-Based Pothole Filtering

The system implements intelligent filtering to avoid cluttering the map:

1. **Fetch route polyline** from OSRM
2. **Create buffer zone** around route (default: 30 meters)
3. **Filter potholes** using point-to-segment distance calculation
4. **Display warnings** only for potholes on active route

The buffer can be adjusted in:
- Frontend: Map component
- Backend: `/api/potholes/on-route` endpoint

## Database Schema

### Users Collection
```json
{
  "_id": ObjectId,
  "email": "user@example.com",
  "password_hash": "...",
  "full_name": "User Name",
  "created_at": ISODate,
  "updated_at": ISODate
}
```

### Potholes Collection
```json
{
  "_id": ObjectId,
  "latitude": 28.6139,
  "longitude": 77.2090,
  "confidence": 0.85,
  "image_url": "url",
  "reported_by": ObjectId,
  "verified": true,
  "report_count": 5,
  "severity": "medium",
  "created_at": ISODate,
  "updated_at": ISODate
}
```

### Reports Collection
```json
{
  "_id": ObjectId,
  "user_id": ObjectId,
  "pothole_id": ObjectId,
  "latitude": 28.6139,
  "longitude": 77.2090,
  "image_url": "url",
  "confidence": 0.85,
  "status": "pending|verified|rejected",
  "created_at": ISODate
}
```

## YOLOv8 Model

### Download Options

1. **Using Pre-trained Model**
   ```python
   from ultralytics import YOLO
   model = YOLO('yolov8n.pt')  # nano model (fast)
   # or
   model = YOLO('yolov8m.pt')  # medium model (balanced)
   ```

2. **Using Custom Trained Model**
   - Train on your pothole dataset
   - Place weights as `backend/models/best.pt`
   - Update confidence threshold in `detection.py` as needed

### Confidence Thresholds
- Low: < 0.70 (requires multiple reports)
- Medium: 0.70 - 0.85
- High: > 0.85 (immediately marked on map)

## Troubleshooting

### MongoDB Connection Issues
- Verify MongoDB is running
- Check connection string in `.env`
- Ensure firewall allows connection

### YOLOv8 Model Not Loading
- Download and place `best.pt` in `backend/models/`
- Check YOLO_MODEL_PATH in `.env`
- Verify sufficient disk space for model

### CORS Issues
- Ensure Flask CORS is configured
- Check frontend VITE_API_URL matches backend URL

### GPS Extraction Failing
- Ensure image has EXIF data
- Use photos from GPS-enabled cameras
- Some edited images may lose EXIF metadata

## Deployment

### Frontend (Vercel/Netlify)
```bash
npm run build
# Deploy 'dist' folder
```

### Backend (Render/Railway)
1. Create `.env` with production values
2. Update database to cloud MongoDB
3. Download YOLOv8 model
4. Deploy with `pip install -r requirements.txt && python app.py`

## Future Enhancements

- [ ] Real-time GPS tracking while navigating
- [ ] Mobile app using React Native
- [ ] Admin dashboard for verification
- [ ] Machine learning model improvements
- [ ] Social features (upvote/comment)
- [ ] Severity estimation from image
- [ ] Integration with government road databases
- [ ] Offline map support

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is open-source and available under the MIT License.

## Team

Semester project built by a team of 6 students focused on improving road safety.

## Support

For issues, questions, or suggestions:
- Create an issue in the repository
- Check existing documentation
- Review API error messages carefully

## Acknowledgments

- OpenStreetMap community for map data
- Ultralytics for YOLOv8
- Flask and React communities
- All contributors and testers
