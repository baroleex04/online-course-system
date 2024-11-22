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
            res.redirect('/');
        } else {
            // Invalid credentials
            res.status(401).send('Invalid username or password.');
        }
    });
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

// GET :/
app.get('/', (req, res) => {
    res.render('home'); // Render home page with navbar
});

// GET :/register-course
app.get('/register-course', authorizeRole(['Student']), (req, res) => {
    const studentId = req.session.user_id;

    const query = `
        SELECT c.cid, c.name, c.credit, c.semester, t.week_day, t.class_period
        FROM Course c
        JOIN Timetable t ON c.cid = t.course_cid AND c.semester = t.semester
        WHERE NOT EXISTS (
            SELECT 1 FROM Registration r
            WHERE r.course_cid = c.cid AND r.semester = c.semester AND r.user_id = ?
        )
        ORDER BY c.cid, t.week_day, t.class_period
    `;

    connection.query(query, [studentId], (err, results) => {
        if (err) {
            console.error('Error fetching courses:', err);
            res.status(500).send('Error fetching courses.');
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

        res.render('course/register-course', { courses: Object.values(courses), errorMessage: null });
    });
});

// POST :/register-course
app.post('/register-course', authorizeRole(['Student']), (req, res) => {
    const { cid, semester } = req.body;
    const studentId = req.session.user_id;

    // Query to check for overlapping timetable entries
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

                res.render('course/register-course', { courses: Object.values(courses), errorMessage });
            });
            return;
        }

        // If no overlap, proceed with registration
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

            res.redirect('/register-course');
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

    const query = `
        SELECT c.cid, c.name, c.semester
        FROM Registration r
        JOIN Course c ON r.course_cid = c.cid AND r.semester = c.semester
        WHERE r.user_id = ?
    `;

    connection.query(query, [studentId], (err, results) => {
        if (err) {
            console.error('Error fetching registered courses:', err);
            res.status(500).send('Error fetching registered courses.');
            return;
        }

        res.render('feedback/submit-feedback', { courses: results });
    });
});

// POST :/feedback
app.post('/feedback', authorizeRole(['Student']), (req, res) => {
    const { cid, semester, feedback_des } = req.body;
    const studentId = req.session.user_id;

    const query = `
        INSERT INTO Feed_Back (user_id, course_cid, semester, feedback_des)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE feedback_des = VALUES(feedback_des)
    `;

    connection.query(query, [studentId, cid, semester, feedback_des], (err) => {
        if (err) {
            console.error('Error submitting feedback:', err);
            res.status(500).send('Error submitting feedback.');
            return;
        }

        // Log the activity
        const userId = req.session.user_id;
        logActivity(userId, `Feedback course: ${cid} for semester ${semester}`);

        res.redirect('/feedback'); // Redirect back to the feedback page
    });
});

// GET :/view-feedback/:cid/:semester
app.get('/view-feedback/:cid/:semester', authorizeRole(['Admin', 'Faculty', 'Student']), (req, res) => {
    const { cid, semester } = req.params;

    const query = `
        SELECT f.feedback_des, u.fname, u.lname
        FROM Feed_Back f
        JOIN Users u ON f.user_id = u.user_id
        WHERE f.course_cid = ? AND f.semester = ?
    `;

    connection.query(query, [cid, semester], (err, results) => {
        if (err) {
            console.error('Error fetching feedback:', err);
            res.status(500).send('Error fetching feedback.');
            return;
        }

        res.render('feedback/view-feedback', {
            feedback: results,
            course: { cid, semester },
        });
    });
});

// GET :/create-user
app.get('/create-user', authorizeRole(['Admin']), (req, res) => {
    res.render('user/create-user'); // Render the form template
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
                res.status(500).send('Error creating user. Please try again.');
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
                                res.status(500).send('Error creating student. Please try again.');
                                return;
                            }
                            res.send('Student created successfully!');
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
                                res.status(500).send('Error creating staff. Please try again.');
                                return;
                            }
                            res.send('Staff created successfully!');
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
                                res.status(500).send('Error creating faculty. Please try again.');
                                return;
                            }
                            res.send('Faculty created successfully!');
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
                                res.status(500).send('Error creating admin. Please try again.');
                                return;
                            }
                            res.send('Admin created successfully!');
                        }
                    );
                    break;
            }
        }
    );
    // Log the activity
    const userId = req.session.user_id;
    logActivity(userId, `Created new user`);
});

// GET :/add-course
app.get('/add-course', authorizeRole(['Admin', 'Staff', 'Faculty']), (req, res) => {
    res.render('course/add-course'); // Renders the add-course.ejs form
});

// POST :/add-course
app.post('/add-course', authorizeRole(['Admin', 'Staff', 'Faculty']), (req, res) => {
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

            res.send('Course and timetable added successfully!');
        });
    });
    // Log the activity
    const userId = req.session.user_id;
    logActivity(userId, `Added course: ${cid} for semester ${semester}`);
});

// GET :/delete-course
app.get('/delete-course', authorizeRole(['Admin', 'Faculty', 'Staff']), (req, res) => {
    const query = `
        SELECT c.cid, c.name, c.semester, c.credit, c.instructor
        FROM Course c
    `;

    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching courses for deletion:', err);
            res.status(500).send('Error fetching courses for deletion.');
            return;
        }

        res.render('course/delete-course', { courses: results });
    });
});

//POST :/delete-course
app.post('/delete-course', authorizeRole(['Admin', 'Faculty', 'Staff']), (req, res) => {
    const { cid, semester } = req.body;

    // Delete the course and all related entries
    const deleteQuery = `
        DELETE FROM Course
        WHERE cid = ? AND semester = ?
    `;

    connection.query(deleteQuery, [cid, semester], (err, result) => {
        if (err) {
            console.error('Error deleting course:', err);
            res.status(500).send('Error deleting course. Please try again later.');
            return;
        }

        res.send('Course deleted successfully!');
    });
    // Log the activity
    const userId = req.session.user_id;
    logActivity(userId, `Deleted course: ${cid} for semester ${semester}`);
});

//GET :/edit-course/:cid/:semester
app.get('/edit-course/:cid/:semester', authorizeRole(['Admin', 'Faculty', 'Staff']), (req, res) => {
    const { cid, semester } = req.params;

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

        res.render('course/edit-course', { course });
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

                res.send('Course updated successfully!');
            });
        });
    });
    // Log the activity
    const userId = req.session.user_id;
    logActivity(userId, `Edited course: ${cid} for semester ${semester}`);
});

//GET :/courses
app.get('/courses', (req, res) => {
    const { query, criteria } = req.query; // Capture search query and selected criteria

    const validCriteria = ['cid', 'name', 'semester', 'instructor']; // Allowable criteria
    const selectedCriteria = validCriteria.includes(criteria) ? criteria : 'cid'; // Default to 'cid'

    const baseQuery = `
        SELECT c.cid, c.name, c.credit, c.semester, c.instructor
        FROM Course c
    `;

    const searchCondition = `
        WHERE c.${selectedCriteria} LIKE ?
    `;

    const orderBy = `ORDER BY c.cid, c.semester`;

    const finalQuery = query
        ? `${baseQuery} ${searchCondition} ${orderBy}`
        : `${baseQuery} ${orderBy}`;

    const queryParams = query ? [`%${query}%`] : [];

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

    const query = `
        SELECT c.cid, c.name, c.credit, h.semester, c.instructor
        FROM History_courses h
        JOIN Course c ON h.course_cid = c.cid AND h.semester = c.semester
        WHERE h.user_id = ?
        ORDER BY h.semester DESC
    `;

    connection.query(query, [studentId], (err, results) => {
        if (err) {
            console.error('Error fetching past courses:', err);
            res.status(500).send('Error fetching past courses.');
            return;
        }

        res.render('course/past-courses', { courses: results });
    });
});

//GET :/view-calendar
app.get('/view-calendar', authorizeRole(['Student']), (req, res) => {
    const studentId = req.session.user_id;

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

        res.render('course/view-calendar', { timetable });
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
