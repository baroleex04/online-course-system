const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
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

// middleware function
function authorizeRole(allowedRoles) {
    return (req, res, next) => {
        const userType = req.session.user_type;

        if (!userType) {
            return res.redirect('/login');
        }

        if (!allowedRoles.includes(userType)) {
            return res.status(403).send('Access denied');
        }

        next();
    };
}

// Middleware to Pass Session Data to Templates
app.use((req, res, next) => {
    res.locals.user_type = req.session.user_type || null;
    res.locals.user_id = req.session.user_id || null;
    next();
});


// Route to Render Login Page
app.get('/login', (req, res) => {
    res.render('user/login'); // Render login form
});

// Route to Handle Login Submission
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

// Route to Logout
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

// Route to Render the Home Page
app.get('/', (req, res) => {
    res.render('home'); // Render home page with navbar
});

// Route to Render Available Courses for Registration
app.get("/register-course", authorizeRole(['Student']), (req, res) => {
    const { cid } = req.body;
    const studentId = req.session.user_id; // Assuming user_id is stored in the session

    if (!studentId) {
        return res.status(400).send("User ID is not found.")
    }
    const query = `
        SELECT cid, name, credit
        FROM Course
        WHERE cid NOT IN (
            SELECT course_cid FROM Registration WHERE user_id = ?
        )
    `;

    connection.query(query, [studentId], (err, results) => {
        if (err) {
            console.error("Error fetching available courses:", err);
            res.status(500).send("Error fetching available courses.");
            return;
        }

        res.render("course/register-course", { courses: results });
    });
});

// Route to Handle Course Registration
app.post("/register-course", authorizeRole(['Student']), (req, res) => {
    const { cid } = req.body;
    const studentId = req.session.user_id; // Assuming user_id is stored in the session

    const query = `
        INSERT INTO Registration (user_id, course_cid)
        VALUES (?, ?)
    `;

    connection.query(query, [studentId, cid], (err) => {
        if (err) {
            console.error("Error registering for course:", err);
            res.status(500).send("Error registering for course.");
            return;
        }

        res.send("Course registered successfully!");
    });
});

// Route to Render Registered Courses for Cancellation
app.get("/cancel-course", authorizeRole(['Student']), (req, res) => {
    const studentId = req.session.user_id; // Assuming user_id is stored in the session
    const query = `
        SELECT c.cid, c.name, c.credit
        FROM Course c
        JOIN Registration r ON c.cid = r.course_cid
        WHERE r.user_id = ?
    `;

    connection.query(query, [studentId], (err, results) => {
        if (err) {
            console.error("Error fetching registered courses:", err);
            res.status(500).send("Error fetching registered courses.");
            return;
        }

        res.render("course/cancel-course", { courses: results });
    });
});

// Route to Handle Course Cancellation
app.post("/cancel-course", authorizeRole(['Student']), (req, res) => {
    const { cid } = req.body;
    const studentId = req.session.user_id; // Assuming user_id is stored in the session

    const query = `
        DELETE FROM Registration
        WHERE user_id = ? AND course_cid = ?
    `;

    connection.query(query, [studentId, cid], (err) => {
        if (err) {
            console.error("Error canceling course:", err);
            res.status(500).send("Error canceling course.");
            return;
        }

        res.send("Course canceled successfully!");
    });
});


// Route to Render the Create User Form
app.get('/create-user', authorizeRole(['Admin']), (req, res) => {
    res.render('user/create-user'); // Render the form template
});

// Route to Handle Form Submission
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
                    res.send('Admin created successfully!');
            }
        }
    );
});

// Display Add Course Form
app.get("/add-course", authorizeRole(['Admin', 'Staff', 'Faculty']), (req, res) => {
    res.render("course/add-course"); // EJS template for adding a course
});

// Handle Course Creation
app.post("/add-course", (req, res) => {
    const { cid, curversion, name, credit, instructor, classperiod, semester_id } = req.body;

    // Insert into Course table
    let courseQuery = `
        INSERT INTO Course (cid, curversion, name, credit, instructor, classperiod)
        VALUES (?, ?, ?, ?, ?, ?)
    `;
    connection.query(
        courseQuery,
        [cid, curversion, name, credit, instructor, classperiod || null],
        (err, result) => {
            if (err) {
                console.error("Error adding course:", err);
                res.status(500).send("Error adding course. Please try again later.");
                return;
            }

            // Initialize course in Semester table
            if (semester_id) {
                let semesterQuery = `
                    INSERT INTO Semester (semester_id, course_cid, class_period)
                    VALUES (?, ?, ?)
                `;
                connection.query(
                    semesterQuery,
                    [semester_id, cid, classperiod], // Defaulting class_period to 1; adjust as needed
                    (err, result) => {
                        if (err) {
                            console.error("Error initializing course in semester:", err);
                            res.status(500).send("Course added, but semester initialization failed.");
                            return;
                        }
                        res.send("Course and semester initialized successfully!");
                    }
                );
            } else {
                res.send("Course added successfully!");
            }
        }
    );
});

// Route to Delete a Course
app.post("/delete-course", authorizeRole(['Admin', 'Staff', 'Faculty']), (req, res) => {
    const { cid } = req.body;

    let deleteQuery = `DELETE FROM Course WHERE cid = ?`;
    connection.query(deleteQuery, [cid], (err, result) => {
        if (err) {
            console.error("Error deleting course:", err);
            res.status(500).send("Error deleting course. Please try again later.");
            return;
        }
        res.send("Course deleted successfully!");
    });
});

// Route to Render Edit Course Form
app.get("/edit-course/:cid", authorizeRole(['Admin', 'Staff', 'Faculty']), (req, res) => {
    const { cid } = req.params;

    let selectQuery = `SELECT * FROM Course WHERE cid = ?`;
    connection.query(selectQuery, [cid], (err, results) => {
        if (err) {
            console.error("Error fetching course details:", err);
            res.status(500).send("Error fetching course details. Please try again later.");
            return;
        }

        if (results.length === 0) {
            res.status(404).send("Course not found.");
            return;
        }

        res.render("course/edit-course", { course: results[0] }); // Pass course details to EJS template
    });
});

// Route to Handle Course Updates
app.post("/edit-course/:cid", authorizeRole(['Admin', 'Staff', 'Faculty']), (req, res) => {
    const { cid } = req.params;
    const { curversion, name, credit, instructor, classperiod } = req.body;

    let updateQuery = `
        UPDATE Course
        SET curversion = ?, name = ?, credit = ?, instructor = ?, classperiod = ?
        WHERE cid = ?
    `;

    connection.query(
        updateQuery,
        [curversion, name, credit, instructor, classperiod, cid],
        (err, result) => {
            if (err) {
                console.error("Error updating course:", err);
                res.status(500).send("Error updating course. Please try again later.");
                return;
            }
            res.send("Course updated successfully!");
        }
    );
});

// Route to Display Courses by Semester
app.get("/courses/:semester_id", authorizeRole(['Admin', 'Staff', 'Faculty', 'Student']), (req, res) => {
    const { semester_id } = req.params;

    let query = `
        SELECT c.cid, c.name, c.credit
        FROM Course c
        JOIN Semester s ON c.cid = s.course_cid
        WHERE s.semester_id = ?
    `;

    connection.query(query, [semester_id], (err, results) => {
        if (err) {
            console.error("Error fetching courses for semester:", err);
            res.status(500).send("Error fetching courses. Please try again later.");
            return;
        }

        res.render("course/list-courses", { courses: results, semester_id });
    });
});

// Route to Display Full Details of a Course
app.get("/course-details/:cid", authorizeRole(['Admin', 'Staff', 'Faculty', 'Student']), (req, res) => {
    const { cid } = req.params;

    let query = `SELECT * FROM Course WHERE cid = ?`;
    connection.query(query, [cid], (err, results) => {
        if (err) {
            console.error("Error fetching course details:", err);
            res.status(500).send("Error fetching course details. Please try again later.");
            return;
        }

        if (results.length === 0) {
            res.status(404).send("Course not found.");
            return;
        }

        res.render("course/course-details", { course: results[0] });
    });
});

// Route to Search for Courses
app.get("/search-courses", authorizeRole(['Admin', 'Staff', 'Faculty', 'Student']), (req, res) => {
    const { query } = req.query;

    let searchQuery = `
        SELECT cid, name, credit
        FROM Course
        WHERE cid LIKE ? OR name LIKE ?
    `;

    connection.query(searchQuery, [`%${query}%`, `%${query}%`], (err, results) => {
        if (err) {
            console.error("Error searching for courses:", err);
            res.status(500).send("Error searching for courses. Please try again later.");
            return;
        }

        res.render("course/search-results", { courses: results, query });
    });
});


// 404 Page
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
