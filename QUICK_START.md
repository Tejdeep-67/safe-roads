# Quick Start Guide

This guide will help you get the Pothole Detection System running in less than 30 minutes.

## System Requirements

### Minimum
- Python 3.9 or higher
- Node.js 16 or higher
- 4GB RAM
- 500MB free disk space

### Recommended
- Python 3.10 or higher
- Node.js 18 or higher
- 8GB RAM
- 2GB free disk space (for YOLOv8 model)

## Installation Steps

### Step 1: Clone/Download the Project

```bash
# Navigate to the project directory
cd project-bolt-sb1-gt5grsbh/project
```

### Step 2: Install Backend Dependencies

#### Windows:
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

#### macOS/Linux:
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Step 3: Download YOLOv8 Model

1. Create a `models` directory:
```bash
mkdir models
```

2. Download YOLOv8 model from your training or use pre-trained:
```python
# Run this in Python to download pre-trained model
from ultralytics import YOLO
model = YOLO('yolov8m.pt')  # Downloads ~50MB model
```

3. Or place your custom trained `best.pt` file in `backend/models/`

### Step 4: Set Up MongoDB

#### Option A: Local MongoDB (Recommended for development)
```bash
# macOS
brew services start mongodb-community

# Linux
sudo systemctl start mongod

# Windows
# Run MongoDB from Services or: mongod
```

#### Option B: MongoDB Atlas (Cloud)
1. Visit https://www.mongodb.com/cloud/atlas
2. Create free cluster account
3. Get connection string
4. Update `backend/.env` with your connection string

### Step 5: Configure Environment Variables

#### Backend Config
Create/update `backend/.env`:
```bash
MONGODB_URI=mongodb://localhost:27017
DB_NAME=pothole_detection
JWT_SECRET_KEY=your-secret-key-change-in-production
FLASK_ENV=development
FLASK_DEBUG=True
YOLO_MODEL_PATH=models/best.pt
```

#### Frontend Config
Create `.env` in project root:
```bash
VITE_API_URL=http://localhost:5000/api
```

### Step 6: Install Frontend Dependencies

```bash
cd project  # Go to root if not already there
npm install
```

### Step 7: Start the Application

#### Option A: Automated (Recommended)

**Windows:**
```bash
start.bat
```

**macOS/Linux:**
```bash
bash start.sh
```

#### Option B: Manual

**Terminal 1 - Backend:**
```bash
cd project/backend
source venv/bin/activate  # or venv\Scripts\activate on Windows
python app.py
# Server runs on http://localhost:5000
```

**Terminal 2 - Frontend:**
```bash
cd project
npm run dev
# Access on http://localhost:5173
```

## Verification

### Check Backend
```bash
curl http://localhost:5000/api/health
# Should return: {"status": "healthy", "message": "..."}
```

### Check Frontend
Open browser: `http://localhost:5173`

## First Time Usage

### Test Authentication
1. Click "Get Started" on welcome screen
2. Click "Sign Up"
3. Create account with:
   - Email: test@example.com
   - Password: password123 (min 6 chars)
   - Name: Test User
4. Click Sign Up

### Test Navigation
1. Search for destination (e.g., "Times Square, New York")
2. Click on result
3. Click "Directions" button
4. Set source location (use "Current Location" or search)
5. Click "Start"
6. View route on map

### Test Pothole Reporting
1. Click profile icon (top right)
2. Go to "Report Pothole" tab
3. Click "Choose File"
4. **Important**: Upload image with GPS embed
   - Use smartphone photo (has GPS metadata)
   - Or simulate GPS in image metadata
5. After upload, check "My Reports" to see status

## Troubleshooting

### MongoDB Connection Error
```
Error: Failed to connect to MongoDB
```
**Solution:**
- Verify MongoDB is running
- Check connection string in `.env`
- Try with Atlas if local fails

### Port Already in Use
```
Address already in use: ('0.0.0.0', 5000)
```
**Solution:**
```bash
# Kill process on port 5000
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# macOS/Linux
lsof -i :5000
kill -9 <PID>
```

### YOLOv8 Model Not Loading
```
Error: Model not found at models/best.pt
```
**Solution:**
- Create `models` directory if missing
- Download model and place as `best.pt`
- Check `YOLO_MODEL_PATH` in `.env`

### CORS Error
```
Error: Response not allowed by Access-Control-Allow-Origin
```
**Solution:**
- Ensure frontend URL and backend CORS match
- Check `VITE_API_URL` in `.env`
- Verify backend CORS is enabled

### GPS Data Not Found in Image
```
⚠️ GPS data not found in image EXIF
```
**Solution:**
- Use photo from GPS-enabled camera
- Check image has EXIF data:
  ```bash
  exiftool image.jpg | grep GPS
  ```
- Some edited images lose EXIF data

## Next Steps

### Development
- Review [README.md](../README.md) for full documentation
- Check API endpoints in [API_DOCS.md](./API_DOCS.md)
- Modify components in `src/components/`

### Database
- View data in MongoDB Atlas UI
- Or use MongoDB Compass locally

### Model Training
- Collect pothole images
- Train custom YOLOv8 model
- Replace `models/best.pt`

### Deployment
- Follow deployment guide in main README
- Use Vercel/Netlify for frontend
- Use Render/Railway for backend

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| npm: command not found | Install Node.js from nodejs.org |
| python: command not found | Install Python from python.org |
| MongoDB connection refused | Start MongoDB service |
| Port 5000 already in use | Change port in app.py or kill process |
| VITE hot reload not working | Clear cache, restart dev server |
| Images not uploading | Check file size (max 50MB) and format |

## Performance Tips

1. **Use smaller YOLOv8 model** for faster inference:
   - `yolov8n.pt` (Nano) - Fastest, least accurate
   - `yolov8s.pt` (Small) - Balanced
   - `yolov8m.pt` (Medium) - More accurate

2. **Enable GPU** for YOLOv8 (if available):
   ```python
   # In detection.py
   model = YOLO('models/best.pt')
   model.to('cuda')  # GPU inference
   ```

3. **Database indexes** for faster queries:
   ```javascript
   db.potholes.createIndex({ latitude: 1, longitude: 1 })
   db.reports.createIndex({ user_id: 1, created_at: -1 })
   ```

## Support

- Check main [README.md](../README.md)
- Review API documentation
- Check error messages in browser console
- Monitor backend logs in terminal

## What's Next?

After successful setup:
1. Explore the dashboard
2. Test all features
3. Review code structure
4. Start customizing!

Happy development! 🚀
