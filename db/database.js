const dotenv = require('dotenv');
dotenv.config();

var mysql      = require('mysql');
var connection = mysql.createConnection({
  host     : process.env["DB_HOST"],
  database: process.env["DB_DATABASE"],
  user     : process.env["DB_ADMIN"],
  password : process.env["DB_PASSWORD"]
});
 
module.exports = connection;

// connection.connect(function(err) {
//   if (err) {
//     console.error('error connecting: ' + err.stack);
//     return;
//   }
 
//   console.log('connected as id ' + connection.threadId);
// });