var express = require('express');
var bodyParser = require('body-parser');
var connection = require('./db/database'); // Your database connection
var app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', './views');

// Display Add Course Form
app.get("/add-course", (req, res) => {
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
app.post("/delete-course", (req, res) => {
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
app.get("/edit-course/:cid", (req, res) => {
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
app.post("/edit-course/:cid", (req, res) => {
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
