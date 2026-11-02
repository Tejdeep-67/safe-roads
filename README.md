# Safe Roads - Pothole Detection and Hazard-Aware Navigation

A web app that finds potholes in road photos with a YOLOv8 model and warns drivers about the ones that are
on their route. Built as a semester team project.

## Why

Most map apps tell you the fastest route but nothing about the road surface. Showing every reported pothole
in a city would just clutter the map, so this app only warns you about potholes that are actually on the route
you are about to drive.

## Features

- **Report a pothole:** upload a road photo. The backend reads the GPS location from the photo's EXIF data and
  runs the YOLOv8 model on it. If a pothole is found, it is added to the map with a severity level.
- **Navigation with warnings:** search a place (Nominatim), get directions (OSRM) and see only the potholes
  within 30 m of your route.
- **Crowd verification:** repeated reports at the same spot increase the pothole's report count.
- **User accounts:** register/login with JWT, see your own reports and stats.

## Tech stack

| Part | Tools |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, React Leaflet, Axios |
| Backend | Python, Flask 3, PyJWT, Flask-CORS |
| Database | MongoDB (pymongo) |
| Model | YOLOv8 (Ultralytics), OpenCV, Pillow, ExifRead |
| Maps | OpenStreetMap tiles, Nominatim (search), OSRM (routing) |

## How it works

1. **Detection** (`backend/utils/detection.py`): the uploaded image goes through the YOLOv8 model with a
   confidence threshold of 0.25. The model is a YOLOv8n-seg model fine-tuned on the Kaggle
   *Pothole Image Segmentation* dataset. Validation scores saved in the checkpoint: precision 0.78, mAP@50 0.68 for
   boxes and 0.70 for masks.
2. **Location** (`backend/utils/exif_handler.py`): latitude and longitude come from the photo's EXIF GPS tags.
   A report can also be created with manual coordinates.
3. **Severity** (`backend/utils/database.py`): confidence 0.85 or above is *high*, 0.70 to 0.85 is *medium*,
   below 0.70 is *low*.
4. **Route filter** (`backend/utils/route_filter.py`): the route polyline from OSRM is checked segment by segment,
   and a pothole is kept only if its distance to the route is within the buffer (30 m by default).

## Project structure

```
├── src/                    # React frontend
│   ├── components/         # Map, SearchBar, DirectionsPanel, ProfilePanel, AuthModal
│   ├── contexts/           # auth context
│   └── lib/api.ts          # API client
├── backend/
│   ├── app.py              # Flask app
│   ├── routes/             # auth, reports, potholes, users (+ best.pt model weights)
│   ├── utils/              # detection, exif_handler, route_filter, database, auth
│   └── requirements.txt
├── package.json
└── vite.config.ts
```

## Running it locally

You need Python 3.9+, Node.js 16+ and MongoDB (local or Atlas).

**Backend**

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows  (source venv/bin/activate on Mac/Linux)
pip install -r requirements.txt
```

Create `backend/.env`:

```
MONGODB_URI=mongodb://localhost:27017
DB_NAME=pothole_detection
JWT_SECRET_KEY=change-this
YOLO_MODEL_PATH=routes/best.pt
```

Then run `python app.py`. The API starts on http://localhost:5000.

**Frontend** (from the project root)

```bash
npm install
echo VITE_API_URL=http://localhost:5000/api > .env
npm run dev
```

Open http://localhost:5173.

## API

| Method | Endpoint | What it does |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` | create account / log in |
| GET | `/api/auth/verify` | check the JWT |
| POST | `/api/reports/upload` | upload a photo, run detection, save the report |
| POST | `/api/reports` | report with manual coordinates |
| GET / DELETE | `/api/reports/<id>` | get or delete a report |
| GET | `/api/potholes` | all verified potholes |
| GET | `/api/potholes/near/<lat>/<lon>` | potholes near a point |
| POST | `/api/potholes/on-route` | potholes within the buffer of a route |
| GET | `/api/users/profile`, `/api/users/reports`, `/api/users/stats` | user data |

## Limitations and next steps

- Photos without GPS data need the location entered by hand.
- The model was trained on a public dataset, so it can miss potholes in very different lighting or road types.
- Ideas: live GPS tracking while driving, an admin page to verify reports, estimating pothole size from the
  segmentation mask.

## Acknowledgements

OpenStreetMap contributors, OSRM, Nominatim, Ultralytics YOLOv8 and the Kaggle Pothole Image Segmentation dataset.
