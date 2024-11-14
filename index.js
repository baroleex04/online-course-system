var express = require('express');
var bodyParser = require('body-parser');
var connection = require('./db/database');
var app = express();
app.use(bodyParser.urlencoded({extended: true}));
app.set('view engine', 'ejs');
app.set('views', './views');

// Website routes
app.get("/", (req,res) => {
    let sql = "SELECT * FROM test"
    connection.query(sql, function(err, results) {
        if (err) throw err;
        res.send(results);
    })
});

app.get("/*", (req, res) => {
    res.render("404");
});

app.listen(3000, function () {
    console.log("Starting at port 3000...");
    connection.connect(function(err) {
        if (err) throw err;
        console.log("Database connected!");
    })
});
