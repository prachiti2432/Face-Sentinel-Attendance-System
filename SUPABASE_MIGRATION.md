# Supabase Migration Guide

All data is now stored in Supabase instead of localStorage. This ensures:
- ✅ Data persistence across devices
- ✅ Centralized data management
- ✅ Better security and access control
- ✅ Real-time synchronization
- ✅ Backup and recovery capabilities

## What Changed

### Data Storage Locations

| Data Type | Old Location | New Location |
|-----------|-------------|--------------|
| Attendance Stats | localStorage | `attendance_stats` table |
| Classes Held | localStorage | `classes_held` table |
| Campus Boundaries | localStorage | `campus_boundaries` table |
| Attendance Records | Already in Supabase | `attendance` table |
| Students | Already in Supabase | `students` table |

## Database Tables

### 1. `attendance_stats`
Stores per-student, per-subject attendance statistics:
- `student_name` (TEXT)
- `subject` (TEXT)
- `present_count` (INTEGER)
- `late_count` (INTEGER)
- `absent_count` (INTEGER)
- `total_classes` (INTEGER)
- `last_updated` (TIMESTAMP)

### 2. `classes_held`
Stores total classes held per subject:
- `subject` (TEXT, UNIQUE)
- `total_classes` (INTEGER)
- `last_updated` (TIMESTAMP)

### 3. `campus_boundaries`
Stores campus GPS boundaries:
- `center_lat` (DOUBLE PRECISION)
- `center_lng` (DOUBLE PRECISION)
- `radius_meters` (DOUBLE PRECISION)
- `is_active` (BOOLEAN)

## Setup Instructions

### Step 1: Run Database Schema

Execute `database_schema.sql` in your Supabase SQL Editor to create all tables:

1. Go to your Supabase project
2. Navigate to SQL Editor
3. Copy and paste the contents of `database_schema.sql`
4. Click "Run" to execute

### Step 2: Migrate Existing Data (Optional)

If you have existing localStorage data, migrate it to Supabase:

**Option A: Automatic Migration (Recommended)**

1. Open your browser console on any page
2. Run:
```javascript
import('./migrate_to_supabase.js').then(module => {
    module.migrateLocalStorageToSupabase();
});
```

**Option B: Manual Migration**

1. Open browser DevTools → Application → Local Storage
2. Copy the values for:
   - `attendance_stats`
   - `classes_held`
   - `campus_boundaries`
3. Use the Supabase dashboard to insert data manually

### Step 3: Verify Migration

Check that data is being saved correctly:

1. Mark attendance for a student
2. Check Supabase dashboard → `attendance_stats` table
3. Verify the record appears

## Code Changes

### Before (localStorage)
```javascript
// Save stats
const stats = getStats();
stats[student][subject].present += 1;
saveStats(stats);

// Get stats
const stats = getStats();
const present = stats[student][subject].present;
```

### After (Supabase)
```javascript
// Save stats - automatically handled
await updateAttendanceStats(student, subject, 'present');

// Get stats
const stats = await getStats();
const present = stats[student]?.[subject]?.present || 0;
```

## API Functions

### Attendance Stats

```javascript
// Get all stats
const stats = await getStats();
// Returns: { studentName: { subject: { present, late, absent } } }

// Update stats (automatically called on attendance marking)
await updateAttendanceStats(studentName, subject, status);
// status: 'present' | 'late' | 'absent'

// Save stats directly
await saveStats(studentName, subject, { present, late, absent });
```

### Classes Held

```javascript
// Get all classes held
const held = await getClassesHeld();
// Returns: { subject: totalClasses }

// Save classes held
await saveClassesHeld(subject, totalClasses);
```

### Campus Boundaries

```javascript
// Load boundaries (automatic on page load)
await loadCampusBoundaries();

// Update boundaries (admin only)
await updateCampusBoundaries(lat, lng, radius);
```

## Benefits

1. **Multi-Device Access**: Access data from any device
2. **Data Backup**: Automatic backups in Supabase
3. **Real-time Sync**: Changes sync across all clients
4. **Security**: Row Level Security (RLS) policies
5. **Scalability**: Handles large amounts of data
6. **Analytics**: Easy to query and analyze data

## Troubleshooting

### Data Not Saving

1. Check Supabase connection:
```javascript
import { supabase } from './lib/supabaseClient.js';
const { data, error } = await supabase.from('attendance_stats').select('*');
console.log('Connection test:', error || 'Success');
```

2. Check RLS policies:
   - Ensure you're logged in with appropriate role
   - Verify RLS policies allow your operation

3. Check browser console for errors

### Migration Failed

1. Check Supabase connection
2. Verify tables exist (run `database_schema.sql`)
3. Check RLS policies allow inserts
4. Review browser console for specific errors

### Performance Issues

- Indexes are automatically created for common queries
- Use Supabase dashboard to monitor query performance
- Consider pagination for large datasets

## Rollback (if needed)

If you need to revert to localStorage temporarily:

1. The old localStorage functions are removed
2. You would need to restore them from git history
3. Not recommended - Supabase is the preferred solution

## Support

For issues or questions:
1. Check Supabase logs in dashboard
2. Review browser console errors
3. Verify database schema matches `database_schema.sql`
4. Check RLS policies are correctly configured
