const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const authorizeRole = require('./middleware/authorizeRole');
const logActivity = require('./middleware/logActivity');
const updateHistoryCourses = require('./modules/updateHistoryCourses'); // Adjust path as needed
const connection = require('./db/database'); // Your database connection
const bcrypt = require('bcrypt'); // or require('bcryptjs');
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
app.use(express.static(path.join(__dirname, 'public')));
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
        SELECT user_id, user_type, password 
        FROM Users 
        WHERE username = ?
    `;

    connection.query(loginQuery, [username], async (err, results) => {
        if (err) {
            console.error('Error during login:', err);
            res.status(500).send('Error during login. Please try again later.');
            return;
        }

        if (results.length > 0) {
            // Compare the entered password with the stored hash
            const user = results[0];
            // const isMatch = await bcrypt.compare(password, user.password);
            const isMatch = true;
            if (isMatch) {
                // User authenticated, set session and redirect
                req.session.user_id = user.user_id;
                req.session.user_type = user.user_type;

                // Redirect based on user type
                switch (user.user_type) {
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
        } else {
            // User not found
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

app.post('/register-course', authorizeRole(['Student']), (req, res) => {
    const { cid, semester, search, criteria } = req.body; // Get course id, semester, search query, and criteria
    const studentId = req.session.user_id;
    const userType = req.session.user_type;

    // Query to check for timetable conflicts
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
            // If there are overlapping courses, send an error message
            const errorMessage = 'You cannot register for this course because it conflicts with your existing schedule.';

            // Fetch the list of courses that the student is eligible to register for
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
                    console.error('Error fetching courses:', fetchErr);
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

                // Render the courses list with error message
                res.render('course/list-courses', {
                    courses: Object.values(courses),
                    userType,
                    query: search,
                    errorMessage,
                    successMessage: null,
                    criteria: criteria || 'all',
                    registeredCourses: new Set() // No registration has occurred yet
                });
            });
            return;
        }

        // No conflict, proceed to register the course
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

            // Log the registration activity
            logActivity(studentId, `Registered for course: ${cid} in semester ${semester}`);

            // Fetch the updated list of courses after successful registration
            const baseQuery = `
                SELECT c.cid, c.name, c.credit, c.semester, c.instructor
                FROM Course c
            `;

            let finalQuery = baseQuery + ' ORDER BY c.cid, c.semester';
            const queryParams = search ? [`%${search}%`] : [];

            if (criteria && criteria !== 'all') {
                finalQuery = `${baseQuery} WHERE c.${criteria} LIKE ? ORDER BY c.cid, c.semester`;
                queryParams.push(`%${search}%`);
            }

            connection.query(finalQuery, queryParams, (err, courseResults) => {
                if (err) {
                    console.error('Error fetching courses:', err);
                    res.status(500).send('Error fetching courses.');
                    return;
                }

                // Fetch registration status for the student to disable the "Register" button if needed
                const registrationCheckQuery = `
                    SELECT course_cid, semester
                    FROM Registration
                    WHERE user_id = ?
                `;
                connection.query(registrationCheckQuery, [studentId], (err, registrationResults) => {
                    if (err) {
                        console.error('Error fetching registration status:', err);
                        res.status(500).send('Error checking registration status.');
                        return;
                    }

                    const registeredCourses = new Set();
                    registrationResults.forEach(registration => {
                        registeredCourses.add(`${registration.course_cid}-${registration.semester}`);
                    });

                    // Render the updated courses list with success message
                    res.render('course/list-courses', {
                        courses: courseResults,
                        userType,
                        query: search,
                        errorMessage: null,
                        successMessage: 'You have successfully registered for the course!',
                        registeredCourses,
                        criteria: criteria || 'all',
                    });
                });
            });
        });
    });
});

// GET :/cancel-course
// POST :/delete-course
app.post('/cancel-course', authorizeRole(['Student']), (req, res) => {
    const studentId = req.session.user_id;
    const courseCid = req.body.courseCid; // Get the course CID to delete

    // Query to delete the course from the registration table
    const deleteQuery = `
        DELETE FROM Registration
        WHERE user_id = ? AND course_cid = ?
    `;

    connection.query(deleteQuery, [studentId, courseCid], (err, result) => {
        if (err) {
            console.error('Error deleting course from registration:', err);
            return res.status(500).send('Error deleting course from registration.');
        }

        // If successfully deleted, redirect to the view calendar page
        res.redirect('/view-calendar');
    });
});

// GET :/feedback
// GET :/feedback
app.get('/feedback', authorizeRole(['Student']), (req, res) => {
    const studentId = req.session.user_id;
    const userType = req.session.user_type;

    // Query to fetch past courses eligible for feedback
    const query = `
        SELECT c.cid, c.name, c.semester, c.instructor
        FROM History_courses h
        JOIN Course c ON h.course_cid = c.cid AND h.semester = c.semester
        WHERE h.user_id = ?
        ORDER BY h.semester DESC
    `;

    // Query to check if feedback already exists for a course
    const feedbackQuery = `
        SELECT course_cid, semester
        FROM Feed_Back
        WHERE user_id = ?
    `;

    connection.query(query, [studentId], (err, results) => {
        if (err) {
            console.error('Error fetching past courses for feedback:', err);
            res.status(500).send('Error fetching past courses for feedback.');
            return;
        }

        // Query to check if feedback already exists for any of the courses
        connection.query(feedbackQuery, [studentId], (err, feedbackResults) => {
            if (err) {
                console.error('Error checking feedback status:', err);
                res.status(500).send('Error checking feedback status.');
                return;
            }

            // Create a set of courses that already have feedback
            const feedbackedCourses = new Set();
            feedbackResults.forEach(feedback => {
                feedbackedCourses.add(`${feedback.course_cid}-${feedback.semester}`);
            });

            // Pass feedbacked courses to the frontend
            res.render('feedback/submit-feedback', {
                courses: results,
                feedbackedCourses: Array.from(feedbackedCourses),
                successMessage: null,
                userType
            });
        });
    });
});

// POST :/feedback
app.post('/feedback', authorizeRole(['Student']), (req, res) => {
    const { cid, feedback_des } = req.body;
    const [courseCid, semester] = cid.split('-'); // Parse course ID and semester
    const studentId = req.session.user_id;
    const userType = req.session.user_type;

    // Step 1: Validate if the student is eligible to provide feedback for this course
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

        // If the student isn't eligible for feedback on this course
        if (results.length === 0) {
            res.status(400).send('You are not eligible to provide feedback for this course.');
            return;
        }

        // Step 2: Insert or update the feedback
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

            // Step 3: Fetch all courses that the student can give feedback for
            const coursesQuery = `
                SELECT c.cid, c.name, c.semester, c.instructor
                FROM History_courses h
                JOIN Course c ON h.course_cid = c.cid AND h.semester = c.semester
                WHERE h.user_id = ?
                ORDER BY h.semester DESC
            `;

            connection.query(coursesQuery, [studentId], (err, courses) => {
                if (err) {
                    console.error('Error fetching past courses for feedback:', err);
                    res.status(500).send('Error fetching past courses for feedback.');
                    return;
                }

                // Step 4: Check which courses already have feedback
                const feedbackQueryCheck = `
                    SELECT course_cid, semester
                    FROM Feed_Back
                    WHERE user_id = ?
                `;

                connection.query(feedbackQueryCheck, [studentId], (err, feedbackResults) => {
                    if (err) {
                        console.error('Error checking feedback status:', err);
                        res.status(500).send('Error checking feedback status.');
                        return;
                    }

                    // Create a set of courses that already have feedback
                    const feedbackedCourses = new Set();
                    feedbackResults.forEach(feedback => {
                        feedbackedCourses.add(`${feedback.course_cid}-${feedback.semester}`);
                    });

                    // Step 5: Render the view with the courses and feedbackedCourses
                    res.render('feedback/submit-feedback', {
                        courses: courses, // Pass the list of courses
                        feedbackedCourses: Array.from(feedbackedCourses), // Pass feedbackedCourses as an array
                        successMessage: 'Your feedback has been submitted successfully!',
                        userType
                    });
                });
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

app.post('/create-user', authorizeRole(['Admin']), async (req, res) => {
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

    try {
        // Hash the password before saving it
        const hashedPassword = await bcrypt.hash(password, 10);  // Salt rounds set to 10

        // Insert into Users table with hashed password
        const userQuery = `
            INSERT INTO Users (user_id, username, password, email, pnumber, nationality, fname, mname, lname, user_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        connection.query(
            userQuery,
            [user_id, username, hashedPassword, email, pnumber, nationality, fname, mname || null, lname, user_type],
            (err, result) => {
                if (err) {
                    console.error('Error creating user:', err);
                    res.redirect(`/create-user?errorMessage=${encodeURIComponent('Error creating user. Please try again.')}`);
                    return;
                }

                // Handle role-specific insertion (same as before)
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
    } catch (error) {
        console.error('Error hashing password:', error);
        res.status(500).send('Internal server error');
    }
});

function extractTimetableObject(data) {
    for (let i = 0; i < data.length; i++) {
        // Check if the element is a string and appears to be valid JSON
        if (typeof data[i] === 'string') {
            try {
                // Try parsing the string to check if it's valid JSON
                const parsedObject = JSON.parse(data[i]);
                return parsedObject;  // Return the parsed object if valid
            } catch (error) {
                // If parsing fails, continue to the next element
                continue;
            }
        }
    }
    return null;  // Return null if no valid JSON string was found
}

// GET :/add-course
app.get('/add-course', authorizeRole(['Admin', 'Staff', 'Faculty']), (req, res) => {
    const userType = req.session.user_type; // Retrieve the user role from the session
    res.render('course/add-course', {
        userType,
        successMessage: null,
        errorMessage: null, // No messages initially
    }); // Renders the add-course.ejs form
});

// POST: /add-course
app.post('/add-course', authorizeRole(['Admin', 'Staff', 'Faculty']), (req, res) => {
    const { cid, semester, name, credit, instructor, timetable } = req.body;

    // Step 1: Extract and clean timetable data (assumed to be a custom function)
    const timetableJSON = extractTimetableObject(timetable);
    console.log('Raw Timetable Data:', timetableJSON);

    // Ensure timetable is in correct object format (should be an object already)
    if (typeof timetableJSON !== 'object' || Array.isArray(timetableJSON)) {
        return res.status(400).send('Invalid timetable format.');
    }

    // Step 2: Process timetable and check if it has valid data
    const timetableEntries = [];
    for (let day in timetableJSON) {
        for (let period in timetableJSON[day]) {
            timetableEntries.push([
                cid,
                semester,
                parseInt(day),  // Days are 0-indexed, so we convert to 1-indexed (e.g., Monday -> 1)
                parseInt(period)     // Ensure period is a number
            ]);
        }
    }

    // Check if timetable entries were generated
    if (timetableEntries.length === 0) {
        return res.status(400).send('No timetable data provided.');
    }

    // Step 3: Insert the course into the 'Course' table
    const insertCourseQuery = `
        INSERT INTO Course (cid, semester, name, credit, instructor)
        VALUES (?, ?, ?, ?, ?)
    `;

    connection.query(insertCourseQuery, [cid, semester, name, credit, instructor], (err, result) => {
        if (err) {
            console.error('Error inserting course:', err);
            return res.status(500).send('Error inserting course.');
        }

        console.log('Course inserted successfully');

        // Step 4: Insert timetable data into the 'Timetable' table
        const insertTimetableQuery = 'INSERT INTO Timetable (course_cid, semester, week_day, class_period) VALUES ?';

        // Insert timetable data into the database (using batch insert for efficiency)
        connection.query(insertTimetableQuery, [timetableEntries], (err, result) => {
            if (err) {
                console.error('Error inserting timetable:', err);
                return res.status(500).send('Error inserting timetable.');
            }
            console.log('Timetable inserted successfully');
            res.render('course/add-course', {
                userType: req.session.user_type,
                successMessage: "Successfully add a new course!",
                errorMessage: null, // No messages initially
            }); // Renders the add-course.ejs form
        });
    });
});


//POST :/delete-course
app.post('/delete-course/:cid/:semester', authorizeRole(['Admin', 'Staff', 'Faculty']), (req, res) => {
    const { cid, semester } = req.params;

    // Start a transaction to ensure atomicity (all-or-nothing operation)
    connection.beginTransaction(err => {
        if (err) {
            console.error('Transaction error:', err);
            return res.status(500).send('Transaction start failed.');
        }

        // Step 1: Delete feedback entries related to the course
        const deleteFeedbackQuery = 'DELETE FROM feed_back WHERE course_cid = ? AND semester = ?';
        connection.query(deleteFeedbackQuery, [cid, semester], (err) => {
            if (err) {
                console.error('Error deleting feedback:', err);
                return connection.rollback(() => res.status(500).send('Error deleting feedback.'));
            }

            // Step 2: Delete timetable entries related to the course
            const deleteTimetableQuery = 'DELETE FROM Timetable WHERE course_cid = ? AND semester = ?';
            connection.query(deleteTimetableQuery, [cid, semester], (err) => {
                if (err) {
                    console.error('Error deleting timetable:', err);
                    return connection.rollback(() => res.status(500).send('Error deleting timetable.'));
                }

                // Step 3: Delete registration entries related to the course
                const deleteRegistrationQuery = 'DELETE FROM Registration WHERE course_cid = ? AND semester = ?';
                connection.query(deleteRegistrationQuery, [cid, semester], (err) => {
                    if (err) {
                        console.error('Error deleting registration:', err);
                        return connection.rollback(() => res.status(500).send('Error deleting registration.'));
                    }

                    // Step 4: Delete the course itself
                    const deleteCourseQuery = 'DELETE FROM Course WHERE cid = ? AND semester = ?';
                    connection.query(deleteCourseQuery, [cid, semester], (err) => {
                        if (err) {
                            console.error('Error deleting course:', err);
                            return connection.rollback(() => res.status(500).send('Error deleting course.'));
                        }

                        // Commit the transaction if all deletions are successful
                        connection.commit(err => {
                            if (err) {
                                console.error('Commit error:', err);
                                return connection.rollback(() => res.status(500).send('Transaction commit failed.'));
                            }

                            // Redirect to the courses list after successful deletion
                            res.redirect('/courses');
                        });
                    });
                });
            });
        });
    });
});

app.get('/users', authorizeRole(['Admin']), (req, res) => {
    const userType = req.session.user_type; // Retrieve the user role from the session
    const { query, criteria } = req.query; // Capture search query and selected criteria

    const validCriteria = ['user_id', 'username', 'fname', 'lname', 'email', 'user_type', 'all']; // Include 'all' as valid criteria
    const selectedCriteria = validCriteria.includes(criteria) ? criteria : 'username'; // Default to 'username'

    const baseQuery = `
        SELECT u.user_id, u.username, u.fname, u.lname, u.email, u.user_type
        FROM Users u
    `;

    let finalQuery;
    let queryParams = [];

    if (selectedCriteria === 'all') {
        // Ignore searchCondition if 'all' is selected
        finalQuery = `${baseQuery} ORDER BY u.user_id`;
    } else {
        const searchCondition = `WHERE u.${selectedCriteria} LIKE ?`;
        finalQuery = query
            ? `${baseQuery} ${searchCondition} ORDER BY u.user_id`
            : `${baseQuery} ORDER BY u.user_id`;
        queryParams = query ? [`%${query}%`] : [];
    }

    connection.query(finalQuery, queryParams, (err, results) => {
        if (err) {
            console.error('Error fetching users:', err);
            res.status(500).send('Error fetching users.');
            return;
        }

        res.render('user/list-users', {
            users: results,
            query: query || '',
            criteria: criteria || 'username',
            userType, // Pass the role to the EJS template
        });
    });
});

// View details of a single user
app.get('/user-details/:user_id', authorizeRole(['Admin']), (req, res) => {
    const userId = req.params.user_id;

    const getUserQuery = `
        SELECT * FROM Users WHERE user_id = ?
    `;

    connection.query(getUserQuery, [userId], (err, userResults) => {
        if (err) {
            console.error('Error fetching user details:', err);
            return res.status(500).send('Error fetching user details');
        }
        const user = userResults[0];
        let extraInfoQuery = '';
        let extraInfo = {};

        if (user.user_type === 'Student') {
            extraInfoQuery = `SELECT * FROM Student WHERE user_id = ?`;
        } else if (user.user_type === 'Staff') {
            extraInfoQuery = `SELECT * FROM Staff WHERE user_id = ?`;
        } else if (user.user_type === 'Faculty') {
            extraInfoQuery = `SELECT * FROM Faculty WHERE user_id = ?`;
        }

        if (extraInfoQuery) {
            connection.query(extraInfoQuery, [userId], (err, extraInfoResults) => {
                if (err) {
                    console.error('Error fetching extra user info:', err);
                    return res.status(500).send('Error fetching additional user info');
                }

                extraInfo = extraInfoResults[0] || {};
                res.render('user/user-details', { user, extraInfo, userType: req.session.user_type });
            });
        } else {
            res.render('user/user-details', { user, extraInfo, userType: req.session.user_type });
        }
    });
});

// GET Route to display the user edit form
app.get('/edit-user/:user_id', authorizeRole(['Admin']), (req, res) => {
    const { user_id } = req.params;

    // Fetch basic user information
    const userQuery = 'SELECT * FROM Users WHERE user_id = ?';
    connection.query(userQuery, [user_id], (err, userResults) => {
        if (err || userResults.length === 0) {
            console.error('Error fetching user data:', err);
            return res.status(404).send('User not found');
        }

        const user = userResults[0];
        let extraInfoQuery = '';
        let extraInfo = {};

        // Based on the user type, fetch additional information
        if (user.user_type === 'Student') {
            extraInfoQuery = 'SELECT * FROM Student WHERE user_id = ?';
        } else if (user.user_type === 'Staff') {
            extraInfoQuery = 'SELECT * FROM Staff WHERE user_id = ?';
        } else if (user.user_type === 'Faculty') {
            extraInfoQuery = 'SELECT * FROM Faculty WHERE user_id = ?';
        }

        // Fetch additional info if required
        if (extraInfoQuery) {
            connection.query(extraInfoQuery, [user_id], (err, extraInfoResults) => {
                if (err) {
                    console.error('Error fetching additional user info:', err);
                    return res.status(500).send('Error fetching additional user info');
                }

                extraInfo = extraInfoResults[0] || {};
                res.render('user/edit-user', { user, extraInfo, message: null });
            });
        } else {
            res.render('user/edit-user', { user, extraInfo, message: null });
        }
    });
});

// POST Route to update the user details
app.post('/edit-user/:user_id', authorizeRole(['Admin']), (req, res) => {
    const { user_id } = req.params;
    const { username, fname, mname, lname, nationality, email, enroll_year, study_status, position, department } = req.body;

    const userQuery = 'SELECT * FROM Users WHERE user_id = ?';

    connection.query(userQuery, [user_id], (err, userResults) => {
        if (err || userResults.length === 0) {
            console.error('Error fetching user data:', err);
            return res.status(404).send('User not found');
        }

        const user = userResults[0]; // Get the user object

        const user_type = user.user_type;

        let extraInfoQuery = '';
        let extraInfoValues = [];

        // Adjust the update query based on the user type
        let updateQuery = `
            UPDATE Users 
            SET username = ?, fname = ?, mname = ?, lname = ?, nationality = ?, email = ?, user_type = ? 
            WHERE user_id = ?
        `;

        let queryValues = [username, fname, mname, lname, nationality, email, user_type, user_id];

        if (user_type === 'Student') {
            // Add extra information for students
            extraInfoQuery = `UPDATE Student SET enroll_year = ?, study_status = ? WHERE user_id = ?`;
            extraInfoValues = [enroll_year, study_status, user_id];
        } else if (user_type === 'Staff') {
            // Add extra information for staff
            extraInfoQuery = `UPDATE Staff SET position = ? WHERE user_id = ?`;
            extraInfoValues = [position, user_id];
        } else if (user_type === 'Faculty') {
            // Add extra information for faculty
            extraInfoQuery = `UPDATE Faculty SET department = ? WHERE user_id = ?`;
            extraInfoValues = [department, user_id];
        }

        connection.beginTransaction(err => {
            if (err) {
                console.error('Transaction start error:', err);
                return res.status(500).send('Error starting transaction');
            }

            // Update user data
            connection.query(updateQuery, queryValues, (err, result) => {
                if (err) {
                    return connection.rollback(() => {
                        console.error('Error updating user:', err);
                        res.status(500).send('Error updating user data');
                    });
                }

                // Update extra info based on user type
                if (extraInfoQuery) {
                    connection.query(extraInfoQuery, extraInfoValues, (err, result) => {
                        if (err) {
                            return connection.rollback(() => {
                                console.error('Error updating extra info:', err);
                                res.status(500).send('Error updating extra information');
                            });
                        }

                        // Commit transaction if everything went well
                        connection.commit(err => {
                            if (err) {
                                return connection.rollback(() => {
                                    console.error('Error committing transaction:', err);
                                    res.status(500).send('Error committing transaction');
                                });
                            }

                            // Send success message to the frontend instead of redirecting
                            res.render('user/edit-user', {
                                user: user,
                                extraInfo: req.body,
                                message: 'User updated successfully!' // Passing success message
                            });
                        });
                    });
                } else {
                    // If no extra info to update, just commit the user data update
                    connection.commit(err => {
                        if (err) {
                            return connection.rollback(() => {
                                console.error('Error committing transaction:', err);
                                res.status(500).send('Error committing transaction');
                            });
                        }

                        // Send success message to the frontend instead of redirecting
                        res.render('user/edit-user', {
                            user: user,
                            extraInfo: req.body,
                            message: 'User updated successfully!' // Passing success message
                        });
                    });
                }
            });
        });
    });
});

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

                                res.redirect('/users'); // Redirect back to the user list
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
    const { criteria = 'course_name', query = '' } = req.query; // Default to search by name if no criteria specified
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
            COUNT(DISTINCT r.user_id) AS total_students, -- Count unique students
            t.week_day, t.class_period
        FROM Users u
        LEFT JOIN Registration r ON u.user_id = r.user_id
        LEFT JOIN Course c ON r.course_cid = c.cid AND r.semester = c.semester
        LEFT JOIN Timetable t ON c.cid = t.course_cid AND c.semester = t.semester
        WHERE u.user_type = 'Student'
        ${whereClause ? `AND ${whereClause.substring(6)}` : ''}
        GROUP BY c.cid, c.semester, t.week_day, t.class_period, u.user_id
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
                const existingRegistration = students[row.user_id].registrations.find(
                    reg => reg.course_id === row.cid
                );

                if (existingRegistration) {
                    // Add timetable slot if it exists
                    if (row.week_day && row.class_period) {
                        existingRegistration.timetable.push({
                            week_day: row.week_day,
                            class_period: row.class_period
                        });
                    }
                } else {
                    // Add a new registration
                    students[row.user_id].registrations.push({
                        course_id: row.cid,
                        course_name: row.course_name,
                        semester: row.semester,
                        total_students: row.total_students, // Correct total students count
                        timetable: row.week_day && row.class_period
                            ? [{ week_day: row.week_day, class_period: row.class_period }]
                            : []
                    });
                }
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
// Assuming your database is set up with mysql2 or a similar module
app.post('/edit-course/:cid/:semester', (req, res) => {
    const { cid, semester } = req.params;  // Get course id and semester from the URL
    const { instructor, timetable } = req.body;  // Get course data from the form submission
    const timetableJSON = extractTimetableObject(timetable);
    console.log('Raw Timetable Data:', timetableJSON);

    // Ensure timetable is in correct object format (should be an object already)
    if (typeof timetableJSON !== 'object' || Array.isArray(timetableJSON)) {
        return res.status(400).send('Invalid timetable format.');
    }

    // Step 2: Process timetable and check if it has valid data
    const timetableEntries = [];
    for (let day in timetableJSON) {
        for (let period in timetableJSON[day]) {
            timetableEntries.push([
                cid,
                semester,
                parseInt(day),  // Days are 0-indexed, so we convert to 1-indexed (e.g., Monday -> 1)
                parseInt(period)     // Ensure period is a number
            ]);
        }
    }

    // Step 2: Update the course information
    const updateCourseQuery = `
        UPDATE Course
        SET instructor = ?
        WHERE cid = ? AND semester = ?
    `;
    connection.query(updateCourseQuery, [instructor, cid, semester], (err, result) => {
        if (err) {
            console.error('Error updating course:', err);
            return res.status(500).send('Error updating course.');
        }

        // Step 3: Delete old timetable entries for this course
        const deleteTimetableQuery = `
            DELETE FROM Timetable WHERE course_cid = ? AND semester = ?
        `;
        connection.query(deleteTimetableQuery, [cid, semester], (err, result) => {
            if (err) {
                console.error('Error deleting old timetable entries:', err);
                return res.status(500).send('Error deleting old timetable entries.');
            }

            // Step 4: Insert the new timetable entries

            if (timetableEntries.length > 0) {
                const insertTimetableQuery = `
                    INSERT INTO Timetable (course_cid, semester, week_day, class_period) 
                    VALUES ?
                `;
                connection.query(insertTimetableQuery, [timetableEntries], (err, result) => {
                    if (err) {
                        console.error('Error inserting new timetable entries:', err);
                        return res.status(500).send('Error inserting new timetable entries.');
                    }

                    // Step 5: Redirect back to the course list or course details page with success
                    res.redirect('/courses');
                });
            } else {
                res.status(400).send('No valid timetable data provided.');
            }
        });
    });
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
    const studentId = req.session.user_id; // Assuming student ID is stored in session
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

    // Query to get the list of courses
    connection.query(finalQuery, queryParams, (err, courseResults) => {
        if (err) {
            console.error('Error fetching courses:', err);
            res.status(500).send('Error fetching courses.');
            return;
        }

        // For Admin, skip the registration check as they don't register for courses
        if (userType === 'Admin' || userType === 'Staff' || userType === 'Faculty') {
            // Admins are not registering for courses, simply render the courses
            res.render('course/list-courses', {
                courses: courseResults,
                successMessage: null,
                errorMessage: null,
                query: query || '',
                criteria: criteria || 'cid',
                userType, // Pass the role to the EJS template
                registeredCourses: new Set() // No registered courses for Admin
            });
            return;
        }

        // If the user is a student or faculty, check which courses they are registered for
        let registrationCheckQuery = '';
        let registrationParams = [];
        if (userType === 'Student' || userType === 'Faculty' || userType === 'Staff') {
            registrationCheckQuery = `
                SELECT course_cid, semester
                FROM Registration
                WHERE user_id = ?`;  // Corrected table name to 'Registration'
            registrationParams = [studentId];
        }

        connection.query(registrationCheckQuery, registrationParams, (err, registrationResults) => {
            if (err) {
                console.error('Error fetching registration status:', err);
                res.status(500).send('Error checking registration status.');
                return;
            }

            // Map the registrations to easily check if the student is registered
            const registeredCourses = new Set();
            registrationResults.forEach(registration => {
                registeredCourses.add(`${registration.course_cid}-${registration.semester}`);
            });

            // Pass courses and registration status to the view
            res.render('course/list-courses', {
                courses: courseResults,
                successMessage: null,
                errorMessage: null,
                query: query || '',
                criteria: criteria || 'cid',
                userType, // Pass the role to the EJS template
                registeredCourses // Pass the registered courses to the view
            });
        });
    });
});



//GET :/course-details/:cid/:semester
app.get('/course-details/:cid/:semester', (req, res) => {
    const { cid, semester } = req.params;
    const userType = req.session.user_type;

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

        res.render('course/course-details', { course, userType });
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

// GET :/past-courses
app.get('/past-courses', authorizeRole(['Student']), (req, res) => {
    const studentId = req.session.user_id;
    const userType = req.session.user_type;

    // Get the current year and semester
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1; // Months are 0-indexed
    const currentSemester = Math.ceil(currentMonth / 4); // Divide the year into 4 semesters (Spring, Summer, Fall, Winter)
    const currentSemesterCode = `${currentYear % 100}${currentSemester}`; // Format: YY + Semester (e.g., 231)

    // Get the search criteria and query from the request
    const { criteria, query } = req.query;

    // Base SQL query for fetching past courses
    let queryStr = `
        SELECT c.cid, c.name, c.instructor, c.credit, c.semester
        FROM History_courses h
        JOIN Course c ON h.course_cid = c.cid AND h.semester = c.semester
        WHERE h.user_id = ?
        AND (
            -- This condition ensures that courses are from semesters earlier than the current semester
            CONCAT(SUBSTRING(c.semester, 1, 2), '') < ?
            OR
            (
                SUBSTRING(c.semester, 1, 2) = ?
                AND SUBSTRING(c.semester, 3, 1) < ?
            )
        )
    `;

    // Modify the query based on search criteria
    if (criteria && query) {
        switch (criteria) {
            case 'cid':
                queryStr += ` AND c.cid LIKE ?`;  // Search by Course ID
                break;
            case 'name':
                queryStr += ` AND c.name LIKE ?`;  // Search by Course Name
                break;
            case 'semester':
                queryStr += ` AND c.semester LIKE ?`;  // Search by Semester
                break;
            case 'instructor':
                queryStr += ` AND c.instructor LIKE ?`;  // Search by Instructor
                break;
            default:
                break;
        }
    }

    queryStr += ` ORDER BY c.semester DESC`;  // Sort by semester in descending order

    // Execute the query with parameters
    connection.query(queryStr, [studentId, currentSemesterCode, currentYear % 100, currentSemester, `%${query}%`], (err, results) => {
        if (err) {
            console.error('Error fetching past courses:', err);
            res.status(500).send('Error fetching past courses.');
            return;
        }

        // Calculate the total credits for the past courses
        const totalCredits = results.reduce((sum, course) => sum + course.credit, 0);

        // Render the past-courses page with the filtered results
        res.render('course/past-courses', {
            courses: results,
            userType,
            totalCredits,
            criteria: criteria || 'all',  // Send back the selected criteria for the search form
            query: query || ''           // Send back the query for the search form
        });
    });
});

// GET :/view-calendar
app.get('/view-calendar', authorizeRole(['Student']), (req, res) => {
    const studentId = req.session.user_id;
    const userType = req.session.user_type;

    // Calculate the current semester code
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1; // Months are 0-indexed
    const currentSemester = Math.ceil(currentMonth / 4); // Divide the year into 3 semesters
    const currentSemesterCode = `${currentYear % 100}${currentSemester}`; // Format: YY + Semester (e.g., 231)
    let nextSemesterCode = currentSemesterCode;

    // Step 1: Query to get the unique courses and their credits
    const courseQuery = `
        SELECT DISTINCT c.cid, c.name, c.credit
        FROM Registration r
        JOIN Course c ON r.course_cid = c.cid AND r.semester = c.semester
        WHERE r.user_id = ? AND r.semester = ?
    `;

    connection.query(courseQuery, [studentId, currentSemesterCode], (err, courses) => {
        if (err) {
            console.error('Error fetching registered courses:', err);
            res.status(500).send('Error fetching registered courses.');
            return;
        }

        // Step 2: Calculate total credits
        const totalCredit = courses.reduce((sum, row) => sum + row.credit, 0);

        // Step 3: Query to get the timetable data for the student's courses
        const timetableQuery = `
SELECT t.course_cid, t.week_day, t.class_period, c.name
FROM Timetable t
JOIN Course c ON t.course_cid = c.cid
WHERE t.course_cid IN (SELECT r.course_cid FROM Registration r WHERE r.user_id = ? AND r.semester = ?)
`;

        connection.query(timetableQuery, [studentId, currentSemesterCode], (err, timetableEntries) => {
            if (err) {
                console.error('Error fetching timetable:', err);
                res.status(500).send('Error fetching timetable.');
                return;
            }

            // Step 4: Build the timetable object for rendering
            const timetable = {};

            // Initialize timetable object for periods 1 to 12, and days 2 to 8 (Monday to Sunday)
            for (let period = 1; period <= 12; period++) {
                timetable[period] = {};  // Initialize empty object for each period
                for (let day = 2; day <= 8; day++) {
                    timetable[period][day] = '';  // Empty by default (no course)
                }
            }

            // Fill timetable with actual courses based on `timetableEntries`
            timetableEntries.forEach(entry => {
                const { course_cid, week_day, class_period, name } = entry;

                // Assign the combined course name and ID to the timetable slot
                const courseInfo = `${name} - ${course_cid}`;
                timetable[class_period][week_day] = courseInfo;
            });

            // Step 5: Render the timetable
            res.render('course/view-calendar', {
                timetable,
                userType,
                nextSemesterCode,
                totalCredit,
                courses // Ensure courses are also passed to the view
            });
        });
    });
});

// GET :/
app.get('/', (req, res) => {
    res.render('home'); // Render home page with navbar
});

//GET :/*
app.get("/*", (req, res) => {
    const userType = req.session.user_type;
    if (userType === 'Admin') {
        res.redirect('/admin-homepage');
    } else if (userType === 'Faculty') {
        res.redirect('/faculty-homepage');
    } else if (userType === 'Staff') {
        res.redirect('/staff-homepage');
    } else if (userType === 'Student') {
        res.redirect('/student-homepage')
    }
    res.redirect('/login')
});

// Start Server
app.listen(3000, function () {
    console.log("Starting at port 3000...");
    connection.connect(function (err) {
        if (err) throw err;
        console.log("Database connected!");
    });
});