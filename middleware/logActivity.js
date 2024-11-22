const connection = require('../db/database');

function logActivity(userId, action) {
    const dateTime = new Date().toISOString(); // Format: YYYY-MM-DDTHH:mm:ss.sssZ

    const query = `
        INSERT INTO Activity_record (user_id, record)
        VALUES (?, ?)
    `;

    const record = `${dateTime}_${userId}_${action}`;

    connection.query(query, [userId, record], (err) => {
        if (err) {
            console.error('Error logging activity:', err);
        }
    });
}

module.exports = logActivity;
