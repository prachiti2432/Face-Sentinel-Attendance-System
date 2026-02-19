# FaceGuard - New Features Documentation

## Overview
This document describes all the new features added to the FaceGuard Attendance System.

## 1. Vite Configuration Fix
**Issue:** Vite was trying to parse model files (binary files) as JavaScript, causing errors.

**Solution:** Created `vite.config.js` to:
- Exclude model files from being processed as JavaScript
- Configure HMR overlay settings
- Treat model files as static assets

## 2. Location-Based Attendance (GPS Enabled)

### Features:
- **Campus Boundary Detection**: Attendance can only be marked when user is within campus boundaries
- **Geolocation API**: Uses browser's native geolocation API
- **Prevents Proxy Attendance**: Blocks attendance marking from outside campus
- **Configurable Boundaries**: Campus center and radius can be configured

### Implementation:
- File: `assets/js/location.js`
- Functions:
  - `getCurrentLocation()`: Gets user's current GPS coordinates
  - `isWithinCampus(lat, lng)`: Checks if coordinates are within campus
  - `verifyLocation()`: Verifies location before marking attendance
  - `updateCampusBoundaries()`: Updates campus boundaries (admin only)

### Configuration:
Update campus coordinates in `assets/js/location.js`:
```javascript
const CAMPUS_BOUNDARIES = {
  center: { lat: YOUR_LATITUDE, lng: YOUR_LONGITUDE },
  radius: 500 // meters
};
```

## 3. Time-Based Attendance with Late/Absent Detection

### Features:
- **Late Entry Detection**: Automatically detects late entries based on lecture start time
- **Auto Mark Absent**: Marks absent after cutoff time (20 minutes)
- **Multiple Time Slots**: Supports different lecture time slots
- **Auto Close Attendance**: Attendance window closes after cutoff time

### Time Windows:
- **9:00-9:10**: Present (within first 10 minutes)
- **9:10-9:20**: Late (between 10-20 minutes)
- **After 9:20**: Absent (after 20 minutes)

### Implementation:
- Added `lecture-time` input field in attendance.html
- Functions in `app.js`:
  - `getAttendanceStatus(lectureStartTime)`: Determines present/late/absent
  - `isAttendanceWindowOpen(lectureStartTime)`: Checks if attendance window is open

## 4. Analytics Dashboard

### Features:
- **Attendance Percentage Graph**: Shows attendance percentage for each student
- **Subject-wise Performance**: Displays attendance breakdown by subject
- **Monthly Trend Chart**: Shows attendance trends over time
- **Total Statistics**: Displays total present/late/absent counts

### Implementation:
- File: `analytics.html`
- Uses Chart.js for visualizations
- Fetches data from Supabase attendance table
- Real-time statistics calculation

### Access:
Navigate to `/analytics.html` to view the dashboard.

## 5. Role-Based Login System

### Roles:
1. **Admin**: Full access to all features
   - Manage all data
   - Configure campus boundaries
   - View all analytics
   - Manage users and roles

2. **Staff**: Can mark attendance and view data
   - Mark attendance
   - Register students
   - View attendance records
   - Export data

3. **Student**: View-only access
   - View own attendance
   - View analytics (read-only)

### Implementation:
- File: `assets/js/auth.js`
- Database table: `profiles` (stores user roles)
- Functions:
  - `getUserRole()`: Gets current user's role
  - `hasRole(roles)`: Checks if user has required role
  - `requireAuth(roles)`: Protects routes based on role
  - `isAdmin()`, `isStaff()`, `isStudent()`: Role checkers

### Database Schema:
See `database_schema.sql` for complete schema including RLS policies.

## 6. Auto Notifications

### Features:
- **Email Notifications**: Sends email when attendance drops below 75%
- **SMS Alerts**: Sends SMS to parents for low attendance
- **Daily Summary**: Sends daily attendance summary to faculty
- **Parent Notifications**: Alerts parents about their child's attendance

### Implementation:
- File: `assets/js/notifications.js`
- Database table: `notifications` (queues notifications)
- Functions:
  - `sendEmailNotification()`: Queues email notification
  - `sendSMSAlert()`: Queues SMS notification
  - `checkAndNotifyLowAttendance()`: Checks and sends alerts
  - `notifyParents()`: Sends alerts to parents

### Note:
Email/SMS sending requires backend integration (Supabase Edge Functions or external service like SendGrid/Twilio).

## 7. Anti-Spoofing (Fake Detection)

### Features:
- **Blink Detection**: Requires user to blink during verification
- **Head Movement Verification**: Detects natural head movements
- **Liveness Detection**: Ensures real person, not photo or screen
- **Photo/Screen Detection**: Detects printed photos or mobile screens

### Implementation:
- File: `assets/js/antiSpoofing.js`
- Functions:
  - `detectBlink(landmarks)`: Detects eye blinks using landmarks
  - `detectSpoofing(detection, video)`: Checks for spoofing attempts
  - `verifyLiveness(video, faceapi)`: Performs liveness check
  - Uses face-api.js landmarks for blink detection

### Process:
1. User clicks "Recognize Face"
2. System requests location verification
3. System performs liveness check (requires 2+ blinks)
4. System checks for head movement
5. System detects face and checks for spoofing
6. If all checks pass, attendance is marked

## 8. Enhanced Attendance Marking

### Updated Flow:
1. **Location Verification**: Checks GPS coordinates
2. **Liveness Check**: Verifies user is real (not photo/screen)
3. **Face Recognition**: Matches face with registered students
4. **Time Check**: Determines present/late/absent status
5. **Attendance Marking**: Records attendance with all metadata
6. **Notification Check**: Checks if notifications needed

### Database Fields Added:
- `status`: present/late/absent
- `location_lat`: GPS latitude
- `location_lng`: GPS longitude
- `subject`: Subject name
- `timestamp`: Attendance timestamp

## Setup Instructions

### 1. Database Setup:
Run `database_schema.sql` in your Supabase SQL Editor to create all required tables and policies.

### 2. Environment Variables:
Ensure your `.env` file has:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Campus Configuration:
Update campus coordinates in `assets/js/location.js`:
```javascript
const CAMPUS_BOUNDARIES = {
  center: { lat: YOUR_LATITUDE, lng: YOUR_LONGITUDE },
  radius: 500 // meters
};
```

### 4. Notification Setup:
To enable email/SMS notifications, you need to:
- Set up Supabase Edge Functions for email/SMS
- Or integrate with external services (SendGrid, Twilio, etc.)
- Update notification functions in `assets/js/notifications.js`

### 5. Role Assignment:
Assign roles to users via Supabase:
```sql
UPDATE profiles SET role = 'admin' WHERE id = 'user-id';
UPDATE profiles SET role = 'staff' WHERE id = 'user-id';
UPDATE profiles SET role = 'student' WHERE id = 'user-id';
```

## File Structure

```
Face-attendance-system/
├── assets/
│   └── js/
│       ├── location.js          # GPS/location features
│       ├── antiSpoofing.js     # Anti-spoofing detection
│       ├── notifications.js    # Email/SMS notifications
│       └── auth.js             # Role-based authentication
├── analytics.html              # Analytics dashboard
├── attendance.html            # Enhanced attendance page
├── app.js                     # Main app with all integrations
├── vite.config.js            # Vite configuration
└── database_schema.sql       # Database schema
```

## Browser Compatibility

- **Geolocation API**: Requires HTTPS (or localhost)
- **Webcam Access**: Requires user permission
- **Modern Browsers**: Chrome, Firefox, Safari, Edge (latest versions)

## Security Considerations

1. **Location Privacy**: GPS coordinates are stored but can be anonymized
2. **Face Data**: Face descriptors are stored securely in Supabase
3. **Role-Based Access**: RLS policies enforce access control
4. **Anti-Spoofing**: Multiple layers prevent fake attendance

## Future Enhancements

- Real-time notification delivery
- Advanced analytics with ML predictions
- Mobile app support
- Offline mode support
- Multi-campus support
