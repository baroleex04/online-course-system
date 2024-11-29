const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const authorizeRole = require('./middleware/authorizeRole');
const logActivity = require('./middleware/logActivity');
const updateHistoryCourses = require('./modules/updateHistoryCourses'); // Adjust path as needed
const connection = require('./db/database'); // Your database connection
const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(
    session({
        secret: 'your_secret_key', // Replace with a secure key
        resave: false,
        saveUninitialized: true,
    })
);
app.set('view engine', 'ejs');
app.set('views', './views');

updateHistoryCourses();

// Middleware to Pass Session Data to Templates
app.use((req, res, next) => {
    res.locals.user_type = req.session.user_type || null;
    res.locals.user_id = req.session.user_id || null;
    next();
});

// GET :/login
app.get('/login', (req, res) => {
    res.render('user/login'); // Render login form
});

// POST :/login
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Query to Check User Credentials
    const loginQuery = `
        SELECT user_id, user_type 
        FROM Users 
        WHERE username = ? AND password = ?
    `;

    connection.query(loginQuery, [username, password], (err, results) => {
        if (err) {
            console.error('Error during login:', err);
            res.status(500).send('Error during login. Please try again later.');
            return;
        }

        if (results.length > 0) {
            // User authenticated, set session and redirect
            req.session.user_id = results[0].user_id;
            req.session.user_type = results[0].user_type;
            // Redirect based on user type
            switch (req.session.user_type) {
                case 'Student':
                    res.redirect('/student-homepage');
                    break;
                case 'Admin':
                    res.redirect('/admin-homepage');
                    break;
                case 'Faculty':
                    res.redirect('/faculty-homepage');
                    break;
                case 'Staff':
                    res.redirect('/staff-homepage');
                    break;
                default:
                    res.status(403).send('Unauthorized user role.');
            }
        } else {
            // Invalid credentials
            res.status(401).send('Invalid username or password.');
        }
    });
});

// Middleware to Ensure Authentication
app.use((req, res, next) => {
    if (!req.session.user_id && req.path !== '/login') {
        return res.redirect('/login');
    }
    next();
});

// GET :/logout
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error logging out:', err);
            res.status(500).send('Error logging out. Please try again.');
            return;
        }
        res.redirect('/login');
    });
});

// GET :/student-homepage
app.get('/student-homepage', authorizeRole(['Student']), (req, res) => {
    const studentId = req.session.user_id;

    const query = `
        SELECT fname, lname
        FROM Users
        WHERE user_id = ?
    `;

    connection.query(query, [studentId], (err, results) => {
        if (err) {
            console.error('Error fetching student name:', err);
            res.status(500).send('Error loading student homepage.');
            return;
        }

        if (results.length > 0) {
            const studentName = `${results[0].fname} ${results[0].lname}`;
            res.render('home/student-homepage', { studentName });
        } else {
            res.status(404).send('Student not found.');
        }
    });
});

// GET :/admin-homepage
app.get('/admin-homepage', authorizeRole(['Admin']), (req, res) => {
    const adminId = req.session.user_id;

    // Query to fetch faculty details
    const query = `
        SELECT fname, lname 
        FROM Users 
        WHERE user_id = ? AND user_type = 'Admin'
    `;

    connection.query(query, [adminId], (err, results) => {
        if (err) {
            console.error('Error fetching faculty details:', err);
            res.status(500).send('Error loading faculty homepage.');
            return;
        }

        if (results.length > 0) {
            const adminName = `${results[0].fname} ${results[0].lname}`;
            res.render('home/admin-homepage', { adminName }); // Pass the faculty name to the EJS template
        } else {
            res.status(404).send('Admin not found.');
        }
    });
});

// GET :/faculty-homepage
app.get('/faculty-homepage', authorizeRole(['Faculty']), (req, res) => {
    const facultyId = req.session.user_id;

    // Query to fetch faculty details
    const query = `
        SELECT fname, lname 
        FROM Users 
        WHERE user_id = ? AND user_type = 'Faculty'
    `;

    connection.query(query, [facultyId], (err, results) => {
        if (err) {
            console.error('Error fetching faculty details:', err);
            res.status(500).send('Error loading faculty homepage.');
            return;
        }

        if (results.length > 0) {
            const facultyName = `${results[0].fname} ${results[0].lname}`;
            res.render('home/faculty-homepage', { facultyName }); // Pass the faculty name to the EJS template
        } else {
            res.status(404).send('Faculty not found.');
        }
    });
});

// GET :/staff-homepage
app.get('/staff-homepage', authorizeRole(['Staff']), (req, res) => {
    const staffId = req.session.user_id;

    // Query to fetch faculty details
    const query = `
        SELECT fname, lname 
        FROM Users 
        WHERE user_id = ? AND user_type = 'Staff'
    `;

    connection.query(query, [staffId], (err, results) => {
        if (err) {
            console.error('Error fetching faculty details:', err);
            res.status(500).send('Error loading faculty homepage.');
            return;
        }

        if (results.length > 0) {
            const staffName = `${results[0].fname} ${results[0].lname}`;
            res.render('home/staff-homepage', { staffName }); // Pass the faculty name to the EJS template
        } else {
            res.status(404).send('Staff not found.');
        }
    });
});
// GET :/
app.get('/', (req, res) => {
    res.render('home'); // Render home page with navbar
});

// GET :/register-course
app.get('/register-course', authorizeRole(['Student']), (req, res) => {
    const studentId = req.session.user_id;
    const userType = req.session.user_type;
    const searchQuery = req.query.search || ''; // Default to empty if no search term

    const query = `
        SELECT c.cid, c.name, c.credit, c.semester, t.week_day, t.class_period
        FROM Course c
        JOIN Timetable t ON c.cid = t.course_cid AND c.semester = t.semester
        WHERE NOT EXISTS (
            SELECT 1 FROM Registration r
            WHERE r.course_cid = c.cid AND r.semester = c.semester AND r.user_id = ?
        )
        AND (c.name LIKE ? OR c.cid LIKE ?) -- Search by name or ID
        ORDER BY c.cid, t.week_day, t.class_period
    `;

    connection.query(query, [studentId, `%${searchQuery}%`, `%${searchQuery}%`], (err, results) => {
        if (err) {
            console.error('Error fetching courses:', err);
            res.status(500).send('Error fetching courses.');
            return;
        }

        const courses = {};
        results.forEach((row) => {
            const key = `${row.cid}-${row.semester}`;
            if (!courses[key]) {
                courses[key] = {
                    cid: row.cid,
                    name: row.name,
                    credit: row.credit,
                    semester: row.semester,
                    timetable: [],
                };
            }
            courses[key].timetable.push({ week_day: row.week_day, class_period: row.class_period });
        });

        res.render('course/register-course', { 
            courses: Object.values(courses), 
            searchQuery, // Pass the search term to avoid undefined
            errorMessage: null,
            userType, 
            successMessage: null
        });
    });
});

app.post('/register-course', authorizeRole(['Student']), (req, res) => {
    const { cid, semester, search } = req.body; // Include `search` from the form
    const studentId = req.session.user_id;
    const userType = req.session.user_type;

    const overlapCheckQuery = `
        SELECT t.week_day, t.class_period
        FROM Timetable t
        JOIN Registration r ON t.course_cid = r.course_cid AND t.semester = r.semester
        WHERE r.user_id = ?
        AND EXISTS (
            SELECT 1
            FROM Timetable t2
            WHERE t2.course_cid = ? AND t2.semester = ?
            AND t2.week_day = t.week_day
            AND t2.class_period = t.class_period
        )
    `;

    connection.query(overlapCheckQuery, [studentId, cid, semester], (err, results) => {
        if (err) {
            console.error('Error checking for overlapping timetable:', err);
            res.status(500).send('Error checking for overlapping timetable.');
            return;
        }

        if (results.length > 0) {
            const errorMessage = 'You cannot register for this course because it conflicts with your existing schedule.';
            const fetchCoursesQuery = `
                SELECT c.cid, c.name, c.credit, c.semester, t.week_day, t.class_period
                FROM Course c
                JOIN Timetable t ON c.cid = t.course_cid AND c.semester = t.semester
                WHERE NOT EXISTS (
                    SELECT 1 FROM Registration r
                    WHERE r.course_cid = c.cid AND r.semester = c.semester AND r.user_id = ?
                )
                ORDER BY c.cid, t.week_day, t.class_period
            `;

            connection.query(fetchCoursesQuery, [studentId], (fetchErr, fetchResults) => {
                if (fetchErr) {
                    console.error('Error refetching courses:', fetchErr);
                    res.status(500).send('Error fetching courses.');
                    return;
                }

                const courses = {};
                fetchResults.forEach((row) => {
                    const key = `${row.cid}-${row.semester}`;
                    if (!courses[key]) {
                        courses[key] = {
                            cid: row.cid,
                            name: row.name,
                            credit: row.credit,
                            semester: row.semester,
                            timetable: [],
                        };
                    }
                    courses[key].timetable.push({ week_day: row.week_day, class_period: row.class_period });
                });

                res.render('course/register-course', { 
                    courses: Object.values(courses), 
                    userType,
                    searchQuery: search, 
                    errorMessage, 
                    successMessage: null,
                });
            });
            return;
        }

        const registerQuery = `
            INSERT INTO Registration (user_id, course_cid, semester)
            VALUES (?, ?, ?)
        `;

        connection.query(registerQuery, [studentId, cid, semester], (err) => {
            if (err) {
                console.error('Error registering for course:', err);
                res.status(500).send('Error registering for course.');
                return;
            }

            logActivity(studentId, `Registered for course: ${cid} in semester ${semester}`);

            res.render('course/register-course', {
                successMessage: 'You have successfully registered for the course!',
                errorMessage: null,
                userType,
                courses: [],
                searchQuery: search || '',
            });
        });
    });
});

// GET :/cancel-course
app.get('/cancel-course', authorizeRole(['Student']), (req, res) => {
    const studentId = req.session.user_id;

    const query = `
        SELECT c.cid, c.name, c.credit, r.semester, t.week_day, t.class_period
        FROM Registration r
        JOIN Course c ON r.course_cid = c.cid AND r.semester = c.semester
        JOIN Timetable t ON c.cid = t.course_cid AND c.semester = t.semester
        WHERE r.user_id = ?
        ORDER BY c.cid, t.week_day, t.class_period
    `;

    connection.query(query, [studentId], (err, results) => {
        if (err) {
            console.error('Error fetching registered courses:', err);
            res.status(500).send('Error fetching registered courses.');
            return;
        }

        // Group courses by `cid` and `semester` for display
        const courses = {};
        results.forEach((row) => {
            const key = `${row.cid}-${row.semester}`;
            if (!courses[key]) {
                courses[key] = {
                    cid: row.cid,
                    name: row.name,
                    credit: row.credit,
                    semester: row.semester,
                    timetable: [],
                };
            }
            courses[key].timetable.push({ week_day: row.week_day, class_period: row.class_period });
        });

        res.render('course/cancel-course', { courses: Object.values(courses), successMessage: null });
    });
});

// POST :/cancel-course
app.post('/cancel-course', authorizeRole(['Student']), (req, res) => {
    const { cid, semester } = req.body;
    const studentId = req.session.user_id;

    const query = `
        DELETE FROM Registration
        WHERE user_id = ? AND course_cid = ? AND semester = ?
    `;

    connection.query(query, [studentId, cid, semester], (err) => {
        if (err) {
            console.error('Error canceling course:', err);
            res.status(500).send('Error canceling course.');
            return;
        }

        // Log the activity
        logActivity(studentId, `Canceled course: ${cid} in semester ${semester}`);
        // After successful cancellation, redirect to fetch updated list
        res.redirect('/cancel-course');
    });
});

// GET :/feedback
app.get('/feedback', authorizeRole(['Student']), (req, res) => {
    const studentId = req.session.user_id;

    // Query to fetch past courses eligible for feedback
    const query = `
        SELECT c.cid, c.name, c.semester
        FROM History_courses h
        JOIN Course c ON h.course_cid = c.cid AND h.semester = c.semester
        WHERE h.user_id = ?
        ORDER BY h.semester DESC
    `;

    connection.query(query, [studentId], (err, results) => {
        if (err) {
            console.error('Error fetching past courses for feedback:', err);
            res.status(500).send('Error fetching past courses for feedback.');
            return;
        }

        res.render('feedback/submit-feedback', { courses: results, successMessage: null });
    });
});

// POST :/feedback
app.post('/feedback', authorizeRole(['Student']), (req, res) => {
    const { cid, feedback_des } = req.body;
    const [courseCid, semester] = cid.split('-'); // Parse course ID and semester
    const studentId = req.session.user_id;

    const validationQuery = `
        SELECT 1
        FROM History_courses
        WHERE user_id = ? AND course_cid = ? AND semester = ?
    `;

    connection.query(validationQuery, [studentId, courseCid, semester], (err, results) => {
        if (err) {
            console.error('Error validating feedback eligibility:', err);
            res.status(500).send('Error validating feedback eligibility.');
            return;
        }

        if (results.length === 0) {
            res.status(400).send('You are not eligible to provide feedback for this course.');
            return;
        }

        const feedbackQuery = `
            INSERT INTO Feed_Back (user_id, course_cid, semester, feedback_des)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE feedback_des = VALUES(feedback_des)
        `;

        connection.query(feedbackQuery, [studentId, courseCid, semester, feedback_des], (err) => {
            if (err) {
                console.error('Error submitting feedback:', err);
                res.status(500).send('Error submitting feedback.');
                return;
            }

            res.render('feedback/submit-feedback', {
                courses: results,
                successMessage: 'Your feedback has been submitted successfully!',
            });
        });
    });
});

// GET :/view-feedback
app.get('/view-feedback', authorizeRole(['Admin', 'Faculty', 'Staff', 'Student']), (req, res) => {
    const userType = req.session.user_type; // Determine the user type from the session
    const userId = req.session.user_id; // User ID for filtering student feedback
    const { criteria = 'cid', query = '' } = req.query; // Filter criteria and query

    let baseQuery = `
        SELECT f.feedback_des, u.fname, u.lname, c.name AS course_name, c.cid, f.semester
        FROM Feed_Back f
        JOIN Users u ON f.user_id = u.user_id
        JOIN Course c ON f.course_cid = c.cid AND f.semester = c.semester
    `;
    
    const validCriteria = ['cid', 'name', 'semester'];
    const filterCriteria = validCriteria.includes(criteria) ? criteria : 'cid';

    let whereClause = '';
    const queryParams = [];

    if (userType === 'Student') {
        // Students only see feedback they have given
        whereClause = `WHERE f.user_id = ?`;
        queryParams.push(userId);
    } else if (query) {
        // Admins and Faculty can filter feedback
        whereClause = `WHERE c.${filterCriteria} LIKE ?`;
        queryParams.push(`%${query}%`);
    }

    const finalQuery = `${baseQuery} ${whereClause} ORDER BY c.cid, f.semester`;

    connection.query(finalQuery, queryParams, (err, results) => {
        if (err) {
            console.error('Error fetching feedback:', err);
            res.status(500).send('Error fetching feedback.');
            return;
        }

        res.render('feedback/view-feedback', {
            feedback: results,
            userType,
            criteria,
            query,
        });
    });
});

// GET :/create-user
app.get('/create-user', authorizeRole(['Admin']), (req, res) => {
    const userType = req.session.user_type;
    const { successMessage = null, errorMessage = null } = req.query; // Handle notifications
    res.render('user/create-user', { userType, successMessage, errorMessage }); 
});

// POST :/create-user
app.post('/create-user', authorizeRole(['Admin']), (req, res) => {
    const {
        user_id,
        username,
        password,
        email,
        pnumber,
        nationality,
        fname,
        mname,
        lname,
        user_type,
        enroll_year,
        study_status,
        position,
        department
    } = req.body;

    // Insert into Users table
    const userQuery = `
        INSERT INTO Users (user_id, username, password, email, pnumber, nationality, fname, mname, lname, user_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    connection.query(
        userQuery,
        [user_id, username, password, email, pnumber, nationality, fname, mname || null, lname, user_type],
        (err, result) => {
            if (err) {
                console.error('Error creating user:', err);
                res.redirect(`/create-user?errorMessage=${encodeURIComponent('Error creating user. Please try again.')}`);
                return;
            }

            // Handle role-specific insertion
            switch (user_type) {
                case 'Student':
                    const studentQuery = `
                        INSERT INTO Student (user_id, enroll_year, study_status)
                        VALUES (?, ?, ?)
                    `;
                    connection.query(
                        studentQuery,
                        [user_id, enroll_year, study_status],
                        (err) => {
                            if (err) {
                                console.error('Error creating student:', err);
                                res.redirect(`/create-user?errorMessage=${encodeURIComponent('Error creating student. Please try again.')}`);
                                return;
                            }
                            res.redirect(`/create-user?successMessage=${encodeURIComponent('Student created successfully!')}`);
                        }
                    );
                    break;

                case 'Staff':
                    const staffQuery = `
                        INSERT INTO Staff (user_id, position)
                        VALUES (?, ?)
                    `;
                    connection.query(
                        staffQuery,
                        [user_id, position],
                        (err) => {
                            if (err) {
                                console.error('Error creating staff:', err);
                                res.redirect(`/create-user?errorMessage=${encodeURIComponent('Error creating staff. Please try again.')}`);
                                return;
                            }
                            res.redirect(`/create-user?successMessage=${encodeURIComponent('Staff created successfully!')}`);
                        }
                    );
                    break;

                case 'Faculty':
                    const facultyQuery = `
                        INSERT INTO Faculty (user_id, department)
                        VALUES (?, ?)
                    `;
                    connection.query(
                        facultyQuery,
                        [user_id, department],
                        (err) => {
                            if (err) {
                                console.error('Error creating faculty:', err);
                                res.redirect(`/create-user?errorMessage=${encodeURIComponent('Error creating faculty. Please try again.')}`);
                                return;
                            }
                            res.redirect(`/create-user?successMessage=${encodeURIComponent('Faculty created successfully!')}`);
                        }
                    );
                    break;

                default:
                    const adminQuery = `
                        INSERT INTO Admin (user_id)
                        VALUES (?)
                    `;
                    connection.query(
                        adminQuery,
                        [user_id],
                        (err) => {
                            if (err) {
                                console.error('Error creating admin:', err);
                                res.redirect(`/create-user?errorMessage=${encodeURIComponent('Error creating admin. Please try again.')}`);
                                return;
                            }
                            res.redirect(`/create-user?successMessage=${encodeURIComponent('Admin created successfully!')}`);
                        }
                    );
                    break;
            }
        }
    );

    // Log the activity
    const userId = req.session.user_id;
    logActivity(userId, `Created new user: ${user_id}`);
});

// GET :/add-course
app.get('/add-course', authorizeRole(['Admin', 'Staff', 'Faculty']), (req, res) => {
    const userType = req.session.user_type; // Retrieve the user role from the session
    res.render('course/add-course', {
        userType,
        successMessage: null,
        errorMessage: null,}); // Renders the add-course.ejs form
});

// POST :/add-course
app.post('/add-course', authorizeRole(['Admin', 'Staff', 'Faculty']), (req, res) => {
    const userType = req.session.user_type;
    const { cid, semester, name, credit, instructor, week_day, class_period } = req.body;

    // Insert course details into the Course table
    const courseQuery = `
        INSERT INTO Course (cid, semester, name, credit, instructor)
        VALUES (?, ?, ?, ?, ?)
    `;

    connection.query(courseQuery, [cid, semester, name, credit, instructor], (err) => {
        if (err) {
            console.error('Error adding course:', err);
            res.status(500).send('Error adding course. Please try again later.');
            return;
        }

        // Combine week_day and class_period arrays into rows
        const timetableEntries = [];
        if (Array.isArray(week_day) && Array.isArray(class_period)) {
            for (let i = 0; i < week_day.length; i++) {
                timetableEntries.push([cid, semester, week_day[i], class_period[i]]);
            }
        }

        // Remove duplicate entries from the array
        const uniqueEntries = Array.from(new Set(timetableEntries.map(JSON.stringify))).map(JSON.parse);

        // Insert unique timetable rows
        const timetableQuery = `
            INSERT INTO Timetable (course_cid, semester, week_day, class_period)
            VALUES ?
        `;

        connection.query(timetableQuery, [uniqueEntries], (err) => {
            if (err) {
                console.error('Error adding timetable entries:', err);
                res.status(500).send('Course added, but timetable entries failed.');
                return;
            }

            res.render('course/add-course', {
                userType,
                successMessage: 'Course and timetable added successfully!',
                errorMessage: null,
            });
        });
    });
    // Log the activity
    const userId = req.session.user_id;
    logActivity(userId, `Added course: ${cid} for semester ${semester}`);
});

//POST :/delete-course
app.post('/delete-course', authorizeRole(['Admin', 'Faculty', 'Staff']), (req, res) => {
    const { cid, semester } = req.body;

    // Delete related rows in the Registration table
    const deleteRegistrationQuery = `
        DELETE FROM Registration
        WHERE course_cid = ? AND semester = ?
    `;

    connection.query(deleteRegistrationQuery, [cid, semester], (err) => {
        if (err) {
            console.error('Error deleting from registration:', err);
            res.status(500).send('Error deleting related records. Please try again later.');
            return;
        }

        // Delete related rows in the Timetable table
        const deleteTimetableQuery = `
            DELETE FROM Timetable
            WHERE course_cid = ? AND semester = ?
        `;

        connection.query(deleteTimetableQuery, [cid, semester], (err) => {
            if (err) {
                console.error('Error deleting from timetable:', err);
                res.status(500).send('Error deleting related records. Please try again later.');
                return;
            }

            // Delete related rows in the History_courses table
            const deleteHistoryQuery = `
                DELETE FROM History_courses
                WHERE course_cid = ? AND semester = ?
            `;

            connection.query(deleteHistoryQuery, [cid, semester], (err) => {
                if (err) {
                    console.error('Error deleting from history_courses:', err);
                    res.status(500).send('Error deleting related records. Please try again later.');
                    return;
                }

                // Delete the course itself
                const deleteCourseQuery = `
                    DELETE FROM Course
                    WHERE cid = ? AND semester = ?
                `;

                connection.query(deleteCourseQuery, [cid, semester], (err) => {
                    if (err) {
                        console.error('Error deleting course:', err);
                        res.status(500).send('Error deleting course. Please try again later.');
                        return;
                    }

                    // Log the activity
                    const userId = req.session.user_id;
                    logActivity(userId, `Deleted course: ${cid} for semester ${semester}`);

                    // Redirect back to the list of courses
                    res.redirect('/list-courses');
                });
            });
        });
    });
});

// GET :/delete-user
app.get('/delete-user', authorizeRole(['Admin']), (req, res) => {
    const query = `
        SELECT user_id, username, fname, lname, user_type
        FROM Users
        ORDER BY user_type, fname, lname
    `;
    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching users:', err);
            res.status(500).send('Error fetching users.');
            return;
        }

        res.render('user/delete-user', { users: results });
    });
});

// POST :/delete-user
// POST :/delete-user
app.post('/delete-user', authorizeRole(['Admin']), (req, res) => {
    const { user_id } = req.body;

    // Step 1: Determine user type
    const getUserTypeQuery = `
        SELECT user_type
        FROM Users
        WHERE user_id = ?
    `;

    connection.query(getUserTypeQuery, [user_id], (err, results) => {
        if (err) {
            console.error('Error fetching user type:', err);
            res.status(500).send('Error fetching user type. Please try again.');
            return;
        }

        if (results.length === 0) {
            res.status(404).send('User not found.');
            return;
        }

        const userType = results[0].user_type;

        // Step 2: Handle user type-specific dependencies
        const deleteHistoryCoursesQuery = `
            DELETE FROM History_courses
            WHERE user_id = ?
        `;

        connection.query(deleteHistoryCoursesQuery, [user_id], (err) => {
            if (err) {
                console.error('Error deleting from History_courses:', err);
                res.status(500).send('Error deleting history records. Please try again.');
                return;
            }

            const deleteFeedbackQuery = `
                DELETE FROM Feed_Back
                WHERE user_id = ?
            `;

            connection.query(deleteFeedbackQuery, [user_id], (err) => {
                if (err) {
                    console.error('Error deleting feedback:', err);
                    res.status(500).send('Error deleting feedback records. Please try again.');
                    return;
                }

                const deleteActivityRecordQuery = `
                    DELETE FROM activity_record
                    WHERE user_id = ?
                `;

                connection.query(deleteActivityRecordQuery, [user_id], (err) => {
                    if (err) {
                        console.error('Error deleting activity records:', err);
                        res.status(500).send('Error deleting activity records. Please try again.');
                        return;
                    }

                    const deleteRegistrationQuery = `
                        DELETE FROM Registration
                        WHERE user_id = ?
                    `;

                    connection.query(deleteRegistrationQuery, [user_id], (err) => {
                        if (err) {
                            console.error('Error deleting registrations:', err);
                            res.status(500).send('Error deleting registrations. Please try again.');
                            return;
                        }

                        // Step 3: Delete from role-specific table
                        const roleTable = {
                            Student: 'Student',
                            Staff: 'Staff',
                            Faculty: 'Faculty',
                            Admin: 'Admin',
                        };

                        const roleTableQuery = `
                            DELETE FROM ${roleTable[userType]}
                            WHERE user_id = ?
                        `;

                        connection.query(roleTableQuery, [user_id], (err) => {
                            if (err) {
                                console.error(`Error deleting from ${roleTable[userType]}:`, err);
                                res.status(500).send(`Error deleting ${userType} data. Please try again.`);
                                return;
                            }

                            // Step 4: Delete the user from the `Users` table
                            const deleteUserQuery = `
                                DELETE FROM Users
                                WHERE user_id = ?
                            `;

                            connection.query(deleteUserQuery, [user_id], (err) => {
                                if (err) {
                                    console.error('Error deleting user:', err);
                                    res.status(500).send('Error deleting user. Please try again.');
                                    return;
                                }

                                // Log the activity
                                const adminId = req.session.user_id;
                                logActivity(adminId, `Deleted user: ${user_id}`);

                                res.redirect('/delete-user'); // Redirect back to the user list
                            });
                        });
                    });
                });
            });
        });
    });
});

// GET :/view-student-registrations
app.get('/view-student-registrations', authorizeRole(['Admin', 'Faculty', 'Staff']), (req, res) => {
    const { criteria = 'name', query = '' } = req.query; // Default to search by name if no criteria specified
    const userType = req.session.user_type;
    // Validate criteria
    const validCriteria = ['name', 'email', 'course_name', 'cid', 'semester'];
    const filterCriteria = validCriteria.includes(criteria) ? criteria : 'name';

    // Build query condition based on criteria
    let whereClause = '';
    let queryParam = '';
    if (query) {
        switch (filterCriteria) {
            case 'name':
                whereClause = "WHERE CONCAT(u.fname, ' ', u.lname) LIKE ?";
                queryParam = `%${query}%`;
                break;
            case 'email':
                whereClause = "WHERE u.email LIKE ?";
                queryParam = `%${query}%`;
                break;
            case 'course_name':
                whereClause = "WHERE c.name LIKE ?";
                queryParam = `%${query}%`;
                break;
            case 'cid':
                whereClause = "WHERE c.cid LIKE ?";
                queryParam = `%${query}%`;
                break;
            case 'semester':
                whereClause = "WHERE c.semester LIKE ?";
                queryParam = `%${query}%`;
                break;
        }
    }

    const queryString = `
        SELECT 
            u.user_id, u.fname, u.lname, u.email, 
            c.cid, c.name AS course_name, c.semester, 
            t.week_day, t.class_period
        FROM Users u
        LEFT JOIN Registration r ON u.user_id = r.user_id
        LEFT JOIN Course c ON r.course_cid = c.cid AND r.semester = c.semester
        LEFT JOIN Timetable t ON c.cid = t.course_cid AND c.semester = t.semester
        WHERE u.user_type = 'Student'
        ${whereClause ? `AND ${whereClause.substring(6)}` : ''}
        ORDER BY u.fname, u.lname, c.semester, c.cid, t.week_day, t.class_period
    `;

    connection.query(queryString, [queryParam].filter(Boolean), (err, results) => {
        if (err) {
            console.error('Error fetching student registrations:', err);
            res.status(500).send('Error fetching student registrations.');
            return;
        }

        // Group data by student
        const students = {};
        results.forEach(row => {
            if (!students[row.user_id]) {
                students[row.user_id] = {
                    user_id: row.user_id,
                    name: `${row.fname} ${row.lname}`,
                    email: row.email,
                    registrations: []
                };
            }

            if (row.cid) {
                students[row.user_id].registrations.push({
                    course_id: row.cid,
                    course_name: row.course_name,
                    semester: row.semester,
                    timetable: row.week_day && row.class_period 
                        ? [{ week_day: row.week_day, class_period: row.class_period }]
                        : []
                });
            }
        });

        // Pass data to the template
        res.render('registration/view-student-registrations', {
            students: Object.values(students),
            criteria,
            query,
            userType
        });
    });
});


//GET :/edit-course/:cid/:semester
app.get('/edit-course/:cid/:semester', authorizeRole(['Admin', 'Faculty', 'Staff']), (req, res) => {
    const { cid, semester } = req.params;
    const userType = req.session.user_type;

    const courseQuery = `
        SELECT c.cid, c.name, c.credit, c.semester, c.instructor, t.week_day, t.class_period
        FROM Course c
        JOIN Timetable t ON c.cid = t.course_cid AND c.semester = t.semester
        WHERE c.cid = ? AND c.semester = ?
    `;

    connection.query(courseQuery, [cid, semester], (err, results) => {
        if (err) {
            console.error('Error fetching course details:', err);
            res.status(500).send('Error fetching course details.');
            return;
        }

        if (results.length === 0) {
            res.status(404).send('Course not found.');
            return;
        }

        const course = {
            cid: results[0].cid,
            name: results[0].name,
            credit: results[0].credit,
            semester: results[0].semester,
            instructor: results[0].instructor,
            timetable: results.map((row) => ({
                week_day: row.week_day,
                class_period: row.class_period,
            })),
        };

        res.render('course/edit-course', { course, userType });
    });
});

//POST :/edit-course/:cid/:semester
app.post('/edit-course/:cid/:semester', authorizeRole(['Admin', 'Faculty', 'Staff']), (req, res) => {
    const { cid, semester } = req.params;
    const { name, credit, instructor, week_day, class_period } = req.body;

    const updateCourseQuery = `
        UPDATE Course
        SET name = ?, credit = ?, instructor = ?
        WHERE cid = ? AND semester = ?
    `;

    connection.query(updateCourseQuery, [name, credit, instructor, cid, semester], (err) => {
        if (err) {
            console.error('Error updating course details:', err);
            res.status(500).send('Error updating course details.');
            return;
        }

        // Delete existing timetable entries
        const deleteTimetableQuery = `
            DELETE FROM Timetable
            WHERE course_cid = ? AND semester = ?
        `;

        connection.query(deleteTimetableQuery, [cid, semester], (err) => {
            if (err) {
                console.error('Error clearing timetable entries:', err);
                res.status(500).send('Error clearing timetable entries.');
                return;
            }

            // Insert new timetable entries
            const timetableEntries = [];
            if (Array.isArray(week_day) && Array.isArray(class_period)) {
                for (let i = 0; i < week_day.length; i++) {
                    timetableEntries.push([cid, semester, week_day[i], class_period[i]]);
                }
            }

            const insertTimetableQuery = `
                INSERT INTO Timetable (course_cid, semester, week_day, class_period)
                VALUES ?
            `;

            connection.query(insertTimetableQuery, [timetableEntries], (err) => {
                if (err) {
                    console.error('Error updating timetable entries:', err);
                    res.status(500).send('Error updating timetable entries.');
                    return;
                }

                res.redirect('/list-courses');
            });
        });
    });
    // Log the activity
    const userId = req.session.user_id;
    logActivity(userId, `Edited course: ${cid} for semester ${semester}`);
});

// GET :/list-courses
app.get('/list-courses', authorizeRole(['Admin', 'Faculty', 'Staff']), (req, res) => {
    const userType = req.session.user_type; // Determine the user type from the session
    const query = `
        SELECT c.cid, c.name, c.credit, c.semester, c.instructor
        FROM Course c
        ORDER BY c.semester, c.cid
    `;

    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching courses:', err);
            res.status(500).send('Error fetching courses.');
            return;
        }

        res.render('course/list-courses-edit', { courses: results, userType });
    });
});

//GET :/courses
app.get('/courses', authorizeRole(['Student', 'Faculty', 'Admin', 'Staff']), (req, res) => {
    const userType = req.session.user_type; // Retrieve the user role from the session
    const { query, criteria } = req.query; // Capture search query and selected criteria

    const validCriteria = ['cid', 'name', 'semester', 'instructor', 'all']; // Include 'all' as valid criteria
    const selectedCriteria = validCriteria.includes(criteria) ? criteria : 'cid'; // Default to 'cid'

    const baseQuery = `
        SELECT c.cid, c.name, c.credit, c.semester, c.instructor
        FROM Course c
    `;

    let finalQuery;
    let queryParams = [];

    if (selectedCriteria === 'all') {
        // Ignore searchCondition if 'all' is selected
        finalQuery = `${baseQuery} ORDER BY c.cid, c.semester`;
    } else {
        const searchCondition = `WHERE c.${selectedCriteria} LIKE ?`;
        finalQuery = query
            ? `${baseQuery} ${searchCondition} ORDER BY c.cid, c.semester`
            : `${baseQuery} ORDER BY c.cid, c.semester`;
        queryParams = query ? [`%${query}%`] : [];
    }

    connection.query(finalQuery, queryParams, (err, results) => {
        if (err) {
            console.error('Error fetching courses:', err);
            res.status(500).send('Error fetching courses.');
            return;
        }

        res.render('course/list-courses', {
            courses: results,
            query: query || '',
            criteria: criteria || 'cid',
            userType, // Pass the role to the EJS template
        });
    });
});



//GET :/course-details/:cid/:semester
app.get('/course-details/:cid/:semester', (req, res) => {
    const { cid, semester } = req.params;

    const query = `
        SELECT c.cid, c.name, c.credit, c.semester, c.instructor, 
               t.week_day, t.class_period
        FROM Course c
        JOIN Timetable t ON c.cid = t.course_cid AND c.semester = t.semester
        WHERE c.cid = ? AND c.semester = ?
        ORDER BY t.week_day, t.class_period
    `;

    connection.query(query, [cid, semester], (err, results) => {
        if (err) {
            console.error('Error fetching course details:', err);
            res.status(500).send('Error fetching course details.');
            return;
        }

        if (results.length === 0) {
            res.status(404).send('Course not found.');
            return;
        }

        const course = {
            cid: results[0].cid,
            name: results[0].name,
            credit: results[0].credit,
            semester: results[0].semester,
            instructor: results[0].instructor,
            timetable: results.map((row) => ({
                week_day: row.week_day,
                class_period: row.class_period,
            })),
        };

        res.render('course/course-details', { course });
    });
});

//GET :/search-courses
app.get('/search-courses', (req, res) => {
    const { query } = req.query;

    const searchQuery = `
        SELECT c.cid, c.name, c.credit, c.semester, c.instructor
        FROM Course c
        WHERE c.cid LIKE ? OR c.name LIKE ? OR c.semester LIKE ? OR c.instructor LIKE ?
        ORDER BY c.cid, c.semester
    `;

    connection.query(searchQuery, [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`], (err, results) => {
        if (err) {
            console.error('Error searching courses:', err);
            res.status(500).send('Error searching courses.');
            return;
        }

        res.render('course/search-results', { courses: results, query });
    });
});

//GET :/past-courses
app.get('/past-courses', authorizeRole(['Student']), (req, res) => {
    const studentId = req.session.user_id;
    const userType = req.session.user_type;

    const query = `
        SELECT c.cid, c.name, c.semester
        FROM History_courses h
        JOIN Course c ON h.course_cid = c.cid AND h.semester = c.semester
        WHERE h.user_id = ?
        ORDER BY h.semester DESC
    `;

    connection.query(query, [studentId], (err, results) => {
        if (err) {
            console.error('Error fetching past courses for feedback:', err);
            res.status(500).send('Error fetching past courses for feedback.');
            return;
        }

        res.render('course/past-courses', { courses: results, userType });
    });
});

//GET :/view-calendar
app.get('/view-calendar', authorizeRole(['Student']), (req, res) => {
    const studentId = req.session.user_id;
    const userType = req.session.user_type;

    // Calculate the current semester code
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1; // Months are 0-indexed
    const currentSemester = Math.ceil(currentMonth / 4); // Divide the year into 3 semesters
    const currentSemesterCode = `${currentYear % 100}${currentSemester}`; // Format: YY + Semester (e.g., 231)

    const query = `
        SELECT c.name, t.week_day, t.class_period
        FROM Registration r
        JOIN Timetable t ON r.course_cid = t.course_cid AND r.semester = t.semester
        JOIN Course c ON r.course_cid = c.cid AND r.semester = c.semester
        WHERE r.user_id = ? AND r.semester = ?
        ORDER BY t.week_day, t.class_period
    `;

    connection.query(query, [studentId, currentSemesterCode], (err, results) => {
        if (err) {
            console.error('Error fetching registered courses:', err);
            res.status(500).send('Error fetching registered courses.');
            return;
        }

        // Group results by week_day and class_period for easier rendering
        const timetable = {};
        results.forEach(({ name, week_day, class_period }) => {
            if (!timetable[class_period]) timetable[class_period] = {};
            timetable[class_period][week_day] = name;
        });

        res.render('course/view-calendar', { timetable, userType });
    });
});

//GET :/*
app.get("/*", (req, res) => {
    res.render("404");
});

// Start Server
app.listen(3000, function () {
    console.log("Starting at port 3000...");
    connection.connect(function (err) {
        if (err) throw err;
        console.log("Database connected!");
    });
});
