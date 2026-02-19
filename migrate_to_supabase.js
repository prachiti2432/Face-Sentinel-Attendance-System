/**
 * Migration Script: localStorage to Supabase
 * Run this script once to migrate existing localStorage data to Supabase
 * 
 * Usage: Import this module and call migrateLocalStorageToSupabase()
 */

import { supabase } from './lib/supabaseClient.js';

/**
 * Migrate attendance stats from localStorage to Supabase
 */
async function migrateAttendanceStats() {
    try {
        const statsJson = localStorage.getItem('attendance_stats');
        if (!statsJson) {
            console.log('No attendance stats found in localStorage');
            return { migrated: 0, errors: 0 };
        }

        const stats = JSON.parse(statsJson);
        let migrated = 0;
        let errors = 0;

        for (const [studentName, subjects] of Object.entries(stats)) {
            for (const [subject, counts] of Object.entries(subjects)) {
                try {
                    const { error } = await supabase
                        .from('attendance_stats')
                        .upsert({
                            student_name: studentName,
                            subject: subject,
                            present_count: counts.present || 0,
                            late_count: counts.late || 0,
                            absent_count: counts.absent || 0,
                            last_updated: new Date().toISOString()
                        }, {
                            onConflict: 'student_name,subject'
                        });

                    if (error) {
                        console.error(`Error migrating stats for ${studentName}/${subject}:`, error);
                        errors++;
                    } else {
                        migrated++;
                    }
                } catch (err) {
                    console.error(`Error migrating stats for ${studentName}/${subject}:`, err);
                    errors++;
                }
            }
        }

        console.log(`Migrated ${migrated} attendance stat records, ${errors} errors`);
        return { migrated, errors };
    } catch (error) {
        console.error('Error migrating attendance stats:', error);
        return { migrated: 0, errors: 1 };
    }
}

/**
 * Migrate classes held from localStorage to Supabase
 */
async function migrateClassesHeld() {
    try {
        const classesJson = localStorage.getItem('classes_held');
        if (!classesJson) {
            console.log('No classes held found in localStorage');
            return { migrated: 0, errors: 0 };
        }

        const classes = JSON.parse(classesJson);
        let migrated = 0;
        let errors = 0;

        for (const [subject, totalClasses] of Object.entries(classes)) {
            try {
                const { error } = await supabase
                    .from('classes_held')
                    .upsert({
                        subject: subject,
                        total_classes: totalClasses || 0,
                        last_updated: new Date().toISOString()
                    }, {
                        onConflict: 'subject'
                    });

                if (error) {
                    console.error(`Error migrating classes held for ${subject}:`, error);
                    errors++;
                } else {
                    migrated++;
                }
            } catch (err) {
                console.error(`Error migrating classes held for ${subject}:`, err);
                errors++;
            }
        }

        console.log(`Migrated ${migrated} classes held records, ${errors} errors`);
        return { migrated, errors };
    } catch (error) {
        console.error('Error migrating classes held:', error);
        return { migrated: 0, errors: 1 };
    }
}

/**
 * Migrate campus boundaries from localStorage to Supabase
 */
async function migrateCampusBoundaries() {
    try {
        const boundariesJson = localStorage.getItem('campus_boundaries');
        if (!boundariesJson) {
            console.log('No campus boundaries found in localStorage');
            return { migrated: 0, errors: 0 };
        }

        const boundaries = JSON.parse(boundariesJson);
        
        // Deactivate old boundaries
        await supabase
            .from('campus_boundaries')
            .update({ is_active: false })
            .eq('is_active', true);

        // Insert new boundary
        const { error } = await supabase
            .from('campus_boundaries')
            .insert([{
                center_lat: boundaries.center.lat,
                center_lng: boundaries.center.lng,
                radius_meters: boundaries.radius,
                is_active: true
            }]);

        if (error) {
            console.error('Error migrating campus boundaries:', error);
            return { migrated: 0, errors: 1 };
        }

        console.log('Migrated campus boundaries');
        return { migrated: 1, errors: 0 };
    } catch (error) {
        console.error('Error migrating campus boundaries:', error);
        return { migrated: 0, errors: 1 };
    }
}

/**
 * Main migration function - migrates all localStorage data to Supabase
 */
export async function migrateLocalStorageToSupabase() {
    console.log('Starting migration from localStorage to Supabase...');
    
    const results = {
        attendanceStats: await migrateAttendanceStats(),
        classesHeld: await migrateClassesHeld(),
        campusBoundaries: await migrateCampusBoundaries()
    };

    const totalMigrated = 
        results.attendanceStats.migrated +
        results.classesHeld.migrated +
        results.campusBoundaries.migrated;
    
    const totalErrors = 
        results.attendanceStats.errors +
        results.classesHeld.errors +
        results.campusBoundaries.errors;

    console.log(`\nMigration complete!`);
    console.log(`Total records migrated: ${totalMigrated}`);
    console.log(`Total errors: ${totalErrors}`);

    if (totalErrors === 0 && totalMigrated > 0) {
        console.log('\n✅ Migration successful! You can now clear localStorage if desired.');
        console.log('Note: The app will now use Supabase for all data storage.');
    }

    return results;
}

/**
 * Clear localStorage after successful migration (optional)
 */
export function clearLocalStorage() {
    localStorage.removeItem('attendance_stats');
    localStorage.removeItem('classes_held');
    localStorage.removeItem('campus_boundaries');
    console.log('Cleared localStorage data');
}

// Auto-run migration if this script is imported directly
if (typeof window !== 'undefined' && window.location.pathname.includes('migrate')) {
    migrateLocalStorageToSupabase().then(() => {
        const shouldClear = confirm('Migration complete! Clear localStorage data?');
        if (shouldClear) {
            clearLocalStorage();
        }
    });
}
