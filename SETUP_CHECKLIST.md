# ✅ Getting Started Checklist

Use this checklist to ensure everything is set up correctly before running the project.

## Pre-Development Setup

### System Requirements
- [ ] Python 3.9 or higher installed
- [ ] Node.js 16 or higher installed  
- [ ] Git installed
- [ ] 500MB free disk space
- [ ] Text editor or IDE (VS Code recommended)

### Project Files
- [ ] Project folder exists: `project-bolt-sb1-gt5grsbh/project/`
- [ ] Backend folder exists: `project/backend/`
- [ ] Frontend source exists: `project/src/`
- [ ] `package.json` exists
- [ ] `backend/requirements.txt` exists

## Backend Setup

### Initial Configuration
- [ ] Created `backend/.env` file
- [ ] Set `MONGODB_URI` in .env
- [ ] Set `JWT_SECRET_KEY` (random string)
- [ ] Set `DB_NAME=pothole_detection`

### Python Environment
- [ ] Created virtual environment: `python -m venv venv`
- [ ] Activated virtual environment
- [ ] Installed dependencies: `pip install -r requirements.txt`
- [ ] Verified Flask installed: `python -c "import flask; print(flask.__version__)"`

### YOLOv8 Model
- [ ] Created `backend/models/` directory
- [ ] Downloaded YOLOv8 model as `best.pt`
- [ ] Verified model exists: `ls backend/models/best.pt`
- [ ] Model is under 200MB

### Database
- [ ] MongoDB installed/running or Atlas account created
- [ ] Database connection tested
- [ ] MongoDB URI correct in `.env`
- [ ] Empty database ready for initialization

### Backend Verification
- [ ] Flask app runs without errors: `python app.py`
- [ ] Server starts on `http://localhost:5000`
- [ ] Health check works: `curl http://localhost:5000/api/health`
- [ ] Server can be stopped with Ctrl+C

## Frontend Setup

### Initial Configuration
- [ ] Created `.env` file in project root
- [ ] Set `VITE_API_URL=http://localhost:5000/api`
- [ ] Verified `.env` exists in root

### Node.js Environment
- [ ] Installed dependencies: `npm install`
- [ ] Verified all packages installed: `npm ls`
- [ ] No critical warnings in npm output
- [ ] `node_modules/` folder created

### Frontend Verification
- [ ] Dev server runs: `npm run dev`
- [ ] Server starts on `http://localhost:5173`
- [ ] React app loads without errors
- [ ] Console has no critical errors
- [ ] Homepage displays "Pothole Navigator"

## Integration Testing

### Authentication Flow
- [ ] Can register new user
- [ ] Can login with registered credentials
- [ ] JWT token is stored in localStorage
- [ ] Can view profile page
- [ ] Can logout successfully

### Navigation Flow
- [ ] Can search for locations (Nominatim)
- [ ] Search results display correctly
- [ ] Can select destination
- [ ] "Directions" button appears
- [ ] Can set source location
- [ ] Route displays on map
- [ ] Distance and duration show correctly

### Pothole Reporting
- [ ] Profile panel opens
- [ ] Can select image file
- [ ] Upload initiates without errors
- [ ] File accepted: jpg, jpeg, png
- [ ] Reports tab shows uploaded reports
- [ ] Can delete reports

### API Connectivity
- [ ] Frontend connects to backend without CORS errors
- [ ] API responses are logged correctly
- [ ] Auth tokens are sent with requests
- [ ] Error messages display properly

## Files to Review

### Backend
- [ ] `backend/app.py` - Main Flask application
- [ ] `backend/routes/auth.py` - Authentication endpoints
- [ ] `backend/routes/reports.py` - Pothole upload handling
- [ ] `backend/routes/potholes.py` - Pothole queries
- [ ] `backend/utils/detection.py` - YOLOv8 integration
- [ ] `backend/utils/exif_handler.py` - GPS extraction
- [ ] `backend/.env` - Environment configuration

### Frontend
- [ ] `src/lib/api.ts` - API client (NEW)
- [ ] `src/contexts/AuthContext.tsx` - JWT auth (UPDATED)
- [ ] `src/components/Map.tsx` - Map with pothole markers (UPDATED)
- [ ] `src/components/ProfilePanel.tsx` - Report upload (UPDATED)
- [ ] `src/.env` - Frontend configuration

### Documentation
- [ ] `README.md` - Main documentation ✓
- [ ] `QUICK_START.md` - Quick setup guide ✓
- [ ] `API_DOCS.md` - API reference ✓
- [ ] `CONFIG.md` - Configuration guide ✓
- [ ] `COMPLETION_SUMMARY.md` - What was done ✓

## Startup Options

### Automated Startup
- [ ] Windows users: `start.bat` ready
- [ ] macOS/Linux users: `start.sh` ready
- [ ] Scripts handle venv and dependencies

### Manual Startup
- [ ] Background knowledge of Flask
- [ ] Understanding of React/Vite
- [ ] Can troubleshoot if scripts fail

## Verification Checklist

### Before First Run
- [ ] All required packages installed
- [ ] Environment variables configured
- [ ] Database accessible
- [ ] YOLOv8 model downloaded
- [ ] No network connectivity issues

### After Starting Servers
- [ ] Backend running on port 5000
- [ ] Frontend running on port 5173
- [ ] No critical console errors
- [ ] Both services respond to requests
- [ ] No port conflicts

### First User Test
- [ ] Can create account
- [ ] Can login
- [ ] Can search locations
- [ ] Can view map
- [ ] Can upload report
- [ ] Can view reports

## Environment Variables Checklist

### Backend `.env`
```
✓ MONGODB_URI is set
✓ DB_NAME is set
✓ JWT_SECRET_KEY is set (not default)
✓ FLASK_ENV is development or production
✓ YOLO_MODEL_PATH points to real file
✓ UPLOAD_FOLDER exists or will be created
```

### Frontend `.env`
```
✓ VITE_API_URL is set correctly
✓ No extra spaces around values
✓ URL ends without trailing slash after path
```

## Troubleshooting Checklists

### If Backend Won't Start
- [ ] Python version is 3.9+
- [ ] Virtual environment is activated
- [ ] All requirements installed: `pip list | grep flask`
- [ ] MongoDB is running
- [ ] Port 5000 is not in use
- [ ] No syntax errors in Python files
- [ ] `.env` file has correct format

### If Frontend Won't Start
- [ ] Node version is 16+
- [ ] All packages installed: `npm list react`
- [ ] Port 5173 is not in use
- [ ] No TypeScript errors
- [ ] `.env` file exists in root
- [ ] `package.json` is valid JSON

### If Can't Login
- [ ] Backend server is running
- [ ] MongoDB is accessible
- [ ]`.env` files are configured
- [ ] JWT_SECRET_KEY is set
- [ ] API URL is correct in frontend `.env`

### If Potholes Don't Show
- [ ] Route is calculated (shows on map)
- [ ] Backend API is responding
- [ ] MongoDB has pothole data
- [ ] Buffer distance is correct (30m)
- [ ] YOLOv8 model is loaded
- [ ] Check browser console for errors

## Documentation Reading Order

1. Start: **QUICK_START.md** (30 min setup)
2. Then: **README.md** (full overview)
3. Reference: **API_DOCS.md** (when coding)
4. Configure: **CONFIG.md** (for customization)
5. Summary: **COMPLETION_SUMMARY.md** (overview)

## Key Contacts/Resources

- Python Issues: `python --version`
- Node Issues: `node --version`
- MongoDB: https://www.mongodb.com/
- Flask: https://flask.palletsprojects.com/
- Vite: https://vitejs.dev/
- YOLOv8: https://docs.ultralytics.com/
- OpenStreetMap: https://www.openstreetmap.org/

## Final Validation

Before considering setup complete:

```bash
# Terminal 1: Backend
curl http://localhost:5000/api/health
# Should return: {"status": "healthy", ...}

# Terminal 2: Frontend
curl http://localhost:5173/
# Should return HTML page (or status 200)
```

## Success Indicators

✅ **System is ready when:**
- Frontend and backend both running
- No errors in console or terminal
- Can register and login
- Can search locations
- Can upload image (with GPS)
- Can view reports
- Can see potholes on map

---

## Next Actions

Once all checks pass:

1. **Explore the codebase**
   - Understand component structure
   - Review API endpoints
   - Study utility functions

2. **Try all features**
   - Complete navigation flow
   - Upload different image types
   - Test error handling

3. **Customize project**
   - Adjust colors/styling
   - Change default locations
   - Modify confidence thresholds

4. **Prepare for deployment**
   - Set up staging environment
   - Configure CI/CD
   - Plan database backup
   - Create deployment guide

---

**Keep this checklist handy for:**
- Development
- Troubleshooting
- Onboarding new team members
- Before commits/deployments

**Good luck with your project! 🚀**
