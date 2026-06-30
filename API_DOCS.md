# API Documentation

Complete REST API reference for the Pothole Detection System.

## Base URL

```
http://localhost:5000/api
```

## Authentication

All protected endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

## Response Format

All responses are JSON. Successful responses include:
- 200-201: Success with data
- 400: Bad request
- 401: Unauthorized
- 404: Not found
- 500: Server error

## Endpoints

### Authentication

#### Register User
```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "full_name": "User Name"
}
```

**Response (201)**
```json
{
  "message": "User registered successfully",
  "token": "eyJhbGc...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "full_name": "User Name"
  }
}
```

#### User Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (200)**
```json
{
  "message": "Login successful",
  "token": "eyJhbGc...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "full_name": "User Name"
  }
}
```

#### Verify Token
```http
GET /auth/verify
Authorization: Bearer <token>
```

**Response (200)**
```json
{
  "valid": true,
  "user_id": "507f1f77bcf86cd799439011",
  "email": "user@example.com"
}
```

---

### Users

#### Get User Profile
```http
GET /users/profile
Authorization: Bearer <token>
```

**Response (200)**
```json
{
  "id": "507f1f77bcf86cd799439011",
  "email": "user@example.com",
  "full_name": "User Name",
  "created_at": "2024-02-20T10:30:00Z",
  "updated_at": "2024-02-20T10:30:00Z"
}
```

#### Get User Reports
```http
GET /users/reports
Authorization: Bearer <token>
```

**Response (200)**
```json
{
  "total": 2,
  "reports": [
    {
      "_id": "507f1f77bcf86cd799439012",
      "user_id": "507f1f77bcf86cd799439011",
      "pothole_id": "507f1f77bcf86cd799439013",
      "latitude": 28.6139,
      "longitude": 77.2090,
      "image_url": "/uploads/image.jpg",
      "confidence": 0.85,
      "status": "verified",
      "created_at": "2024-02-20T10:30:00Z"
    }
  ]
}
```

#### Get User Statistics
```http
GET /users/stats
Authorization: Bearer <token>
```

**Response (200)**
```json
{
  "total_reports": 5,
  "verified_reports": 3,
  "pending_reports": 2,
  "rejection_rate": 0
}
```

---

### Reports

#### Upload Pothole Report
```http
POST /reports/upload
Content-Type: multipart/form-data
Authorization: Bearer <token>

image: <binary image file>
```

**Response (201)**
```json
{
  "message": "Pothole detected and report created",
  "report_id": "507f1f77bcf86cd799439012",
  "pothole_id": "507f1f77bcf86cd799439013",
  "latitude": 28.6139,
  "longitude": 77.2090,
  "confidence": 0.87,
  "image_url": "/uploads/image_uuid.jpg"
}
```

**Error Response (400)**
```json
{
  "error": "No GPS data found in image EXIF"
}
```

#### Create Report (Manual GPS)
```http
POST /reports
Content-Type: application/json
Authorization: Bearer <token>

{
  "latitude": 28.6139,
  "longitude": 77.2090,
  "confidence": 0.85,
  "image_url": "optional_url"
}
```

**Response (201)**
```json
{
  "message": "Report created",
  "report_id": "507f1f77bcf86cd799439012",
  "pothole_id": "507f1f77bcf86cd799439013"
}
```

#### Get Specific Report
```http
GET /reports/<report_id>
Authorization: Bearer <token>
```

**Response (200)**
```json
{
  "_id": "507f1f77bcf86cd799439012",
  "user_id": "507f1f77bcf86cd799439011",
  "pothole_id": "507f1f77bcf86cd799439013",
  "latitude": 28.6139,
  "longitude": 77.2090,
  "image_url": "/uploads/image.jpg",
  "confidence": 0.85,
  "status": "pending",
  "created_at": "2024-02-20T10:30:00Z"
}
```

#### Delete Report
```http
DELETE /reports/<report_id>
Authorization: Bearer <token>
```

**Response (200)**
```json
{
  "message": "Report deleted successfully"
}
```

---

### Potholes

#### Get All Verified Potholes
```http
GET /potholes
```

**Response (200)**
```json
{
  "total": 15,
  "potholes": [
    {
      "_id": "507f1f77bcf86cd799439013",
      "latitude": 28.6139,
      "longitude": 77.2090,
      "confidence": 0.87,
      "image_url": "/uploads/image.jpg",
      "reported_by": "507f1f77bcf86cd799439011",
      "verified": true,
      "report_count": 3,
      "severity": "high",
      "created_at": "2024-02-20T10:30:00Z",
      "updated_at": "2024-02-20T10:30:00Z"
    }
  ]
}
```

#### Get Specific Pothole
```http
GET /potholes/<pothole_id>
```

**Response (200)**
```json
{
  "_id": "507f1f77bcf86cd799439013",
  "latitude": 28.6139,
  "longitude": 77.2090,
  "confidence": 0.87,
  "image_url": "/uploads/image.jpg",
  "reported_by": "507f1f77bcf86cd799439011",
  "verified": true,
  "report_count": 3,
  "severity": "high",
  "created_at": "2024-02-20T10:30:00Z",
  "updated_at": "2024-02-20T10:30:00Z"
}
```

#### Get Nearby Potholes
```http
GET /potholes/near/<latitude>/<longitude>?radius=2
```

Parameters:
- `latitude` (float): Center point latitude
- `longitude` (float): Center point longitude
- `radius` (float, optional): Search radius in kilometers (default: 2)

**Response (200)**
```json
{
  "latitude": 28.6139,
  "longitude": 77.2090,
  "radius_km": 2,
  "total": 5,
  "potholes": [...]
}
```

#### Get Potholes on Route
```http
POST /potholes/on-route
Content-Type: application/json

{
  "route_coordinates": [
    [77.2090, 28.6139],
    [77.2100, 28.6150],
    [77.2110, 28.6160]
  ],
  "buffer_meters": 30
}
```

**Response (200)**
```json
{
  "total": 2,
  "buffer_meters": 30,
  "warning": "⚠️ 2 potholes ahead in the next 1 km",
  "potholes": [
    {
      "_id": "507f1f77bcf86cd799439013",
      "latitude": 28.6145,
      "longitude": 77.2095,
      "confidence": 0.87,
      "severity": "high",
      "report_count": 3,
      ...
    }
  ]
}
```

#### Verify Pothole ⚠️ (Admin Only)
```http
PUT /potholes/<pothole_id>/verify
Content-Type: application/json
Authorization: Bearer <admin_token>

{
  "verified": true
}
```

**Response (200)**
```json
{
  "message": "Pothole verified",
  "pothole_id": "507f1f77bcf86cd799439013"
}
```

---

## Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| 400 | Bad Request | Check request parameters |
| 401 | Unauthorized | Providea valid JWT token |
| 403 | Forbidden | You don't have permission |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | User already exists |
| 500 | Server Error | Check server logs |

### Error Response Format
```json
{
  "error": "Description of what went wrong"
}
```

---

## Data Models

### User
```typescript
interface User {
  _id: ObjectId
  email: string
  password_hash: string
  full_name: string
  created_at: DateTime
  updated_at: DateTime
}
```

### Pothole
```typescript
interface Pothole {
  _id: ObjectId
  latitude: number
  longitude: number
  confidence: number (0-1)
  image_url?: string
  reported_by?: ObjectId
  verified: boolean
  report_count: number
  severity: 'low' | 'medium' | 'high'
  created_at: DateTime
  updated_at: DateTime
}
```

### Report
```typescript
interface Report {
  _id: ObjectId
  user_id: ObjectId
  pothole_id: ObjectId
  latitude: number
  longitude: number
  image_url?: string
  confidence: number (0-1)
  status: 'pending' | 'verified' | 'rejected'
  created_at: DateTime
}
```

---

## Examples

### Complete User Flow

#### 1. Register
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "driver@example.com",
    "password": "securepass",
    "full_name": "John Driver"
  }'
```

#### 2. Login and Get Token
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "driver@example.com",
    "password": "securepass"
  }'

# Response includes token
```

#### 3. Upload Report
```bash
curl -X POST http://localhost:5000/api/reports/upload \
  -H "Authorization: Bearer <token>" \
  -F "image=@pothole.jpg"
```

#### 4. Get Potholes on Route
```bash
curl -X POST http://localhost:5000/api/potholes/on-route \
  -H "Content-Type: application/json" \
  -d '{
    "route_coordinates": [
      [77.2090, 28.6139],
      [77.2100, 28.6150]
    ],
    "buffer_meters": 30
  }'
```

---

## Rate Limiting

Recommended rate limits:
- Auth endpoints: 10 requests/minute
- Upload endpoint: 5 requests/minute
- Query endpoints: 60 requests/minute

---

## Best Practices

1. **Always validate input** on client side before sending
2. **Use appropriate HTTP methods** (GET, POST, etc.)
3. **Include proper headers** (Content-Type, Authorization)
4. **Handle errors gracefully** with user-friendly messages
5. **Cache frequently accessed data** (potholes list)
6. **Log all errors** for debugging
7. **Use pagination** for large datasets (future enhancement)

---

## Changelog

### Version 1.0.0 (2024-02-24)
- Initial API release
- All core endpoints functional
- MongoDB integration
- YOLOv8 detection pipeline
- JWT authentication

---

For more information, see [README.md](../README.md)
