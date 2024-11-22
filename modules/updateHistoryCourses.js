const connection = require('../db/database'); // Adjust the path to your database connection

const updateHistoryCourses = () => {
    // Calculate the current semester code
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1; // Months are 0-indexed
    const currentSemester = Math.ceil(currentMonth / 4); // Divide the year into 3 semesters
    const currentSemesterCode = `${currentYear % 100}${currentSemester}`; // Format: YY + Semester (e.g., 231)

    // Query to move past courses into History_courses
    const query = `
        INSERT INTO History_courses (user_id, course_cid, semester)
        SELECT r.user_id, r.course_cid, r.semester
        FROM Registration r
        JOIN Course c ON r.course_cid = c.cid AND r.semester = c.semester
        WHERE c.semester < ?
          AND NOT EXISTS (
              SELECT 1 
              FROM History_courses h
              WHERE h.user_id = r.user_id 
              AND h.course_cid = r.course_cid 
              AND h.semester = r.semester
          )
    `;

    connection.query(query, [currentSemesterCode], (err, results) => {
        if (err) {
            console.error('Error updating history courses:', err);
            return;
        }
        console.log(`Updated ${results.affectedRows} rows in History_courses.`);
    });
};

module.exports = updateHistoryCourses;
