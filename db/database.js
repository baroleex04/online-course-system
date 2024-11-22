const dotenv = require('dotenv');
dotenv.config();

var mysql      = require('mysql2');
var connection = mysql.createConnection({
  host     : '127.0.0.1',
  port     : 3306,
  database: process.env["DB_DATABASE"],
  user     : process.env["DB_ADMIN"],
  password : process.env["DB_PASSWORD"]
});
 
module.exports = connection;