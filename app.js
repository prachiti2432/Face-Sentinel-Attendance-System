import { supabase } from './lib/supabaseClient.js';
import { checkAndNotifyLowAttendance, notifyParents } from './assets/js/notifications.js';

const video = document.getElementById('video');
const registerButton = document.getElementById('register');
const recognizeButton = document.getElementById('recognize');
const nameInput = document.getElementById('name');
const exportButton = document.getElementById('export');
// Attendance page-only controls
const subjectInput = document.getElementById('subject');
const classesInput = document.getElementById('classesHeld');
const saveClassesBtn = document.getElementById('saveClasses');
const lectureTimeInput = document.getElementById('lecture-time');
const statusMessage = document.getElementById('status-message');

async function setupCamera() {
    if (!video) return null;
    try {
        // Ensure inline playback (especially for iOS Safari)
        video.setAttribute('playsinline', 'true');
        video.muted = true; // ensure autoplay is allowed
        // Try ideal constraints first, fallback to basic constraints for broader camera support
        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 720 }, height: { ideal: 560 }, facingMode: 'user' },
                audio: false
            });
        } catch (e) {
            // Fallback: some cameras don't support ideal dimensions
            stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user' },
                audio: false
            });
        }
        video.srcObject = stream;
        // Explicitly call play() to avoid autoplay stalls
        try {
            await video.play();
        } catch (e) {
            console.warn('video.play() was blocked or failed:', e?.name || e, e);
        }
        return new Promise((resolve) => {
            if (video.readyState >= 2) {
                resolve(video);
            } else {
                video.onloadedmetadata = () => {
                    resolve(video);
                };
            }
        });
    } catch (err) {
        console.error('Error accessing webcam:', err?.name || err, err?.message, err);
        alert('Could not access webcam. Please ensure you have granted camera permissions and no other app is using it.');
        return null;
    }
}

async function loadModels() {
    try {
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
            faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
            faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
        ]);
        console.log('Models Loaded');
    } catch (err) {
        console.error('Error loading face-api models:', err);
        alert(`Error loading face recognition models: ${err.message}. Check console for details.`);
    }
}

let labeledFaceDescriptors = [];

async function loadLabeledImages() {
    const { data: students, error } = await supabase
        .from('students')
        .select('*');

    if (error) {
        console.error('Error loading students:', error);
        return [];
    }

    // Group multiple descriptors per label (name), to support with/without specs etc.
    const byName = new Map();
    for (const student of students) {
        const desc = new Float32Array(student.face_descriptor);
        if (!byName.has(student.name)) {
            byName.set(student.name, [desc]);
        } else {
            byName.get(student.name).push(desc);
        }
    }

    const results = [];
    for (const [name, descs] of byName.entries()) {
        results.push(new faceapi.LabeledFaceDescriptors(name, descs));
    }
    return results;
}

async function start() {
    // Only start camera and models if we are on a page with a video element
    if (video) {
        await setupCamera();
        await loadModels();
        labeledFaceDescriptors = await loadLabeledImages();
        console.log('Camera, models, and data are ready.');
    }
}

start();

if (registerButton) {
    registerButton.addEventListener('click', async () => {
        try {
            const name = nameInput ? nameInput.value : '';
            if (!name) {
                alert('Please enter a name');
                return;
            }

            // First capture
            const detection1 = await detectFace();
            if (!detection1) {
                alert('No face detected! Please ensure your face is clearly visible in the camera.');
                return;
            }

            console.log('Attempting to register:', name);
            let { error } = await supabase
                .from('students')
                .insert([{ name: name, face_descriptor: Array.from(detection1.descriptor) }]);

            if (error) {
                console.error('Error registering face (sample 1):', error);
                alert(`Error registering face: ${error.message || error.details || 'Unknown error'}`);
                return;
            }

            // Optional second capture (with/without specs)
            const doSecond = confirm('Capture an additional sample (e.g., with or without specs)?');
            if (doSecond) {
                alert('Adjust your appearance (e.g., put on or remove specs), then press OK to capture.');
                // Small delay to allow UI to update/user to get ready if needed, though alert blocks
                const detection2 = await detectFace();
                if (detection2) {
                    let { error: error2 } = await supabase
                        .from('students')
                        .insert([{ name: name, face_descriptor: Array.from(detection2.descriptor) }]);
                    if (error2) {
                        console.error('Error registering face (sample 2):', error2);
                        // Don't block success if second sample fails, just warn
                        alert(`Warning: Second sample failed to save: ${error2.message}`);
                    }
                } else {
                    alert('No face detected for second sample. distinct sample skipped.');
                }
            }

            alert('Face registered successfully!');
            // Reload descriptors
            labeledFaceDescriptors = await loadLabeledImages();
        } catch (err) {
            console.error('Unexpected error during registration:', err);
            alert(`An unexpected error occurred: ${err.message}`);
        }
    });
}

async function detectFace() {
    if (!video) return null;

    // Use TinyFaceDetector for performance
    const options = new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.3, inputSize: 416 });

    // We need both landmarks and descriptor for recognition
    const detection = await faceapi
        .detectSingleFace(video, options)
        .withFaceLandmarks()
        .withFaceDescriptor();

    if (!detection) {
        // console.log("No face detected");
        return null;
    }

    return detection;
}

/**
 * Get attendance status based on deadline
 * @param {string} deadlineTime - Format: "HH:MM"
 * @returns {string} - "present" or "absent"
 */
function getAttendanceStatus(deadlineTime) {
    // If within window (checked by isAttendanceWindowOpen), they are present.
    // simpler logic for now as requested.
    return 'present';
}

/**
 * Check if attendance is allowed (current time <= deadline)
 * @param {string} deadlineTime 
 * @returns {boolean}
 */
function isAttendanceWindowOpen(deadlineTime) {
    if (!deadlineTime) return true; // If no time specified, allow anytime

    const now = new Date();
    const [hours, minutes] = deadlineTime.split(':').map(Number);
    const deadline = new Date(now);
    deadline.setHours(hours, minutes, 0, 0);

    // Allow if current time is before or equal to deadline
    // Adding a small buffer (e.g. 59 seconds) to include the minute? 
    // "10:30" usually means up to 10:30:00. Let's stick to strict comparison.
    return now <= deadline;
}

if (recognizeButton) {
    recognizeButton.addEventListener('click', async () => {
        try {
            if (statusMessage) statusMessage.textContent = 'Detecting face...';
            const faceDetection = await detectFace();
            if (!faceDetection) {
                if (statusMessage) statusMessage.textContent = '';
                return;
            }

            // Face recognition
            if (labeledFaceDescriptors.length === 0) {
                alert('No registered faces found in the system.');
                if (statusMessage) statusMessage.textContent = '';
                return;
            }

            const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6);
            const bestMatch = faceMatcher.findBestMatch(faceDetection.descriptor);

            if (bestMatch.label !== 'unknown') {
                // Check lecture time and determine status
                const subject = subjectInput ? subjectInput.value.trim() : '';
                const lectureTime = lectureTimeInput ? lectureTimeInput.value : '';

                // Attendance window check removed as requested
                // if (lectureTime && !isAttendanceWindowOpen(lectureTime)) {
                //     alert('Attendance window is closed. Attendance can only be marked within the allowed time window.');
                //     if (statusMessage) statusMessage.textContent = '';
                //     return;
                // }

                const attendanceStatus = getAttendanceStatus(lectureTime);

                await markAttendance(bestMatch.label, subject, attendanceStatus, null);

                // Update stats and notifications (non-blocking - don't fail recognition)
                if (subject) {
                    try {
                        await updateAttendanceStats(bestMatch.label, subject, attendanceStatus);
                        const stats = await getStats();
                        const held = await getClassesHeld();
                        const total = Number(held[subject] || 0);
                        if (total > 0) {
                            const present = stats[bestMatch.label]?.[subject]?.present || 0;
                            const pct = (present / total) * 100;
                            const { data: student } = await supabase
                                .from('students')
                                .select('email, phone_number, parent_email, parent_phone')
                                .eq('name', bestMatch.label)
                                .single();
                            if (student) {
                                await checkAndNotifyLowAttendance(
                                    bestMatch.label, subject, pct,
                                    student.email, student.phone_number
                                );
                                if (pct < 75) await notifyParents(bestMatch.label, subject, pct);
                            }
                        }
                    } catch (e) {
                        console.warn('Stats/notifications update failed:', e);
                    }
                }

                const statusText = attendanceStatus === 'late' ? ' (Late)' :
                    attendanceStatus === 'absent' ? ' (Absent)' : '';
                alert(`Face recognized! Attendance marked for ${bestMatch.label}${statusText}.`);
                if (statusMessage) statusMessage.textContent = `✓ Attendance marked for ${bestMatch.label}`;
            } else {
                alert('Face not recognized. Please register first.');
                if (statusMessage) statusMessage.textContent = '';
            }
        } catch (error) {
            console.error('Error in recognition process:', error);
            alert('An error occurred during recognition. Please try again.');
            if (statusMessage) statusMessage.textContent = '';
        }
    });
}

async function markAttendance(name, subject, status, location) {
    // Use minimal insert for compatibility with basic schema (student_name, created_at)
    const record = { student_name: name };
    const { error } = await supabase.from('attendance').insert([record]);

    if (error) {
        console.error('Error marking attendance:', error);
        throw error;
    }
    console.log(`Attendance marked for ${name}`);
}

// ============ Supabase-based attendance statistics tracking ============

/**
 * Get attendance statistics from Supabase
 * @returns {Promise<Object>} Stats object keyed by student name -> subject -> counts
 */
async function getStats() {
    try {
        const { data, error } = await supabase
            .from('attendance_stats')
            .select('*');

        if (error) {
            console.error('Error fetching attendance stats:', error);
            return {};
        }

        // Convert array to nested object structure
        const stats = {};
        if (data) {
            data.forEach(record => {
                if (!stats[record.student_name]) {
                    stats[record.student_name] = {};
                }
                stats[record.student_name][record.subject] = {
                    present: record.present_count || 0,
                    late: record.late_count || 0,
                    absent: record.absent_count || 0
                };
            });
        }
        return stats;
    } catch (error) {
        console.error('Error getting stats:', error);
        return {};
    }
}

/**
 * Save attendance statistics to Supabase
 * @param {string} student 
 * @param {string} subject 
 * @param {Object} counts - { present, late, absent }
 */
async function saveStats(student, subject, counts) {
    try {
        const { error } = await supabase
            .from('attendance_stats')
            .upsert({
                student_name: student,
                subject: subject,
                present_count: counts.present || 0,
                late_count: counts.late || 0,
                absent_count: counts.absent || 0,
                last_updated: new Date().toISOString()
            }, {
                onConflict: 'student_name,subject'
            });

        if (error) {
            console.error('Error saving attendance stats:', error);
            throw error;
        }
    } catch (error) {
        console.error('Error in saveStats:', error);
    }
}

/**
 * Get classes held per subject from Supabase
 * @returns {Promise<Object>} Object with subject -> total_classes mapping
 */
async function getClassesHeld() {
    try {
        const { data, error } = await supabase
            .from('classes_held')
            .select('subject, total_classes');

        if (error) {
            console.error('Error fetching classes held:', error);
            return {};
        }

        // Convert array to object
        const map = {};
        if (data) {
            data.forEach(record => {
                map[record.subject] = record.total_classes || 0;
            });
        }
        return map;
    } catch (error) {
        console.error('Error getting classes held:', error);
        return {};
    }
}

/**
 * Save classes held to Supabase
 * @param {string} subject 
 * @param {number} totalClasses 
 */
async function saveClassesHeld(subject, totalClasses) {
    try {
        const { error } = await supabase
            .from('classes_held')
            .upsert({
                subject: subject,
                total_classes: totalClasses,
                last_updated: new Date().toISOString()
            }, {
                onConflict: 'subject'
            });

        if (error) {
            console.error('Error saving classes held:', error);
            throw error;
        }
    } catch (error) {
        console.error('Error in saveClassesHeld:', error);
    }
}

/**
 * Update attendance statistics in Supabase
 * @param {string} student 
 * @param {string} subject 
 * @param {string} status - 'present', 'late', or 'absent'
 */
async function updateAttendanceStats(student, subject, status) {
    try {
        // Get current stats
        const { data: currentStats, error: fetchError } = await supabase
            .from('attendance_stats')
            .select('*')
            .eq('student_name', student)
            .eq('subject', subject)
            .single();

        let presentCount = 0;
        let lateCount = 0;
        let absentCount = 0;

        if (currentStats) {
            presentCount = currentStats.present_count || 0;
            lateCount = currentStats.late_count || 0;
            absentCount = currentStats.absent_count || 0;
        }

        // Update based on status
        if (status === 'present') {
            presentCount += 1;
        } else if (status === 'late') {
            lateCount += 1;
            presentCount += 1; // Late still counts as present
        } else if (status === 'absent') {
            absentCount += 1;
        }

        // Save updated stats
        await saveStats(student, subject, {
            present: presentCount,
            late: lateCount,
            absent: absentCount
        });
    } catch (error) {
        console.error('Error updating attendance stats:', error);
    }
}

if (saveClassesBtn) {
    saveClassesBtn.addEventListener('click', async () => {
        const subject = subjectInput ? subjectInput.value.trim() : '';
        if (!subject) {
            alert('Enter a Subject before saving total classes held.');
            return;
        }
        if (!classesInput) {
            alert('Classes Held input not found.');
            return;
        }
        const n = Number(classesInput.value);
        if (!Number.isFinite(n) || n <= 0) {
            alert('Enter a valid positive number for Classes Held.');
            return;
        }

        try {
            await saveClassesHeld(subject, n);
            alert(`Saved total classes held for ${subject}: ${n}`);
        } catch (error) {
            console.error('Error saving classes held:', error);
            alert('Error saving classes held. Please try again.');
        }
    });
}

if (exportButton) {
    exportButton.addEventListener('click', async () => {
        const { data: attendanceRecords, error } = await supabase
            .from('attendance')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching attendance:', error);
            return;
        }

        if (!attendanceRecords || attendanceRecords.length === 0) {
            alert('No attendance records to export.');
            return;
        }

        const csvContent = 'data:text/csv;charset=utf-8,'
            + ['Name,Date,Time'].concat(attendanceRecords.map(record => {
                const date = new Date(record.created_at).toLocaleDateString();
                const time = new Date(record.created_at).toLocaleTimeString();
                return `${record.student_name},${date},${time}`;
            })).join('\n');

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', 'attendance.csv');
        document.body.appendChild(link);
        link.click();
    });
}
