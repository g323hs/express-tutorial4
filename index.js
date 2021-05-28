var express = require("express");
var app = express();
var bodyParser = require("body-parser");
var multer = require("multer");
var upload = multer();
var session = require("express-session");
var cookieParser = require("cookie-parser");
var sqlite3 = require("sqlite3").verbose();

app.set("view engine", "pug");
app.set("views", "./views");

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(upload.array());
app.use(cookieParser());
app.use(
	session({ secret: "Your secret key", resave: false, saveUninitialized: true })
);

function connect() {
	var path =	"Users.db";
	const db = new sqlite3.Database(path, sqlite3.OPEN_READWRITE, err => {
		if (err) {
			console.error(err.message);
		} else {
			//console.log("Connected to database.");
		}
	});
	return db;
}

function close(db) {
	db.close(err => {
		if (err) {
			console.error(err.message);
		} else {
			//console.log("Closed the database connection.\n");
		}
	});
}

app.get("/signup", function(req, res) {
	res.render("signup");
});

app.post("/signup", function(req, res) {
	var db = connect();

	let sql = `SELECT * FROM Users WHERE ID == '` + req.body.id + `'`;
	db.all(sql, (err, rows) => {
		if (err) {
			console.error(err.message);
		} else {
			if (rows.length == 0) {
				//no user has that username => create new user
				var newUser = { id: req.body.id, password: req.body.password };
				db.run(
					`INSERT INTO Users(ID, password) VALUES(?,?)`,
					[newUser.id, newUser.password],
					function(err) {
						if (err) {
							return console.log(err.message);
							console.log(newUser.id, newUser.password);
							res.render("signup",{message: "Error submiting user data"});
						} else {
							console.log("User: " + newUser.id + " signed up and logged in");
							req.session.user = newUser;
							res.redirect("/protected_page");
						}
					}
				);
				
			} else {
				res.render("signup", {
					message: "User Already Exists! Login or choose another user id"
				});
			}
		}
	});
	close(db);
});

app.get("/login", function(req, res) {
	res.render("login");
});

app.post("/login", function(req, res) {
	var valid = false;
	var user;
	var db = connect();

	let sql =
		`SELECT * FROM Users WHERE ID = '` +
		req.body.id +
		`' AND password = '` +
		req.body.password +
		`'`;

	db.all(sql, (err, rows) => {
		if (err) {
			console.error(err.message);
		} else {
			if (rows.length == 1) {
				// valid login
				user = { id: req.body.id, password: req.body.password };
				console.log("user: " + user.id + " logged in.");
				req.session.user = user;
				res.redirect("/protected_page");
			} else if (rows.length > 1){
				console.log("There is more than one user with that name!");
			} else {
				// invalid login
				res.render("login", { message: "Invalid credentials!", invalid: true });
			}
		}
	});
	close(db);
});

app.get("/logout", function(req, res) {
	if (req.session.user) {
		var id = req.session.user.id;
		req.session.destroy(function() {
			console.log("user: " + id + " logged out.\n");
		});
	}
	res.redirect("/login");
});

app.get("/failed_attempt", function(req, res) {
	res.render("failed_attempt");
});

function checkSignIn(req, res, next) {
	if (req.session.user) {
		console.log("user: " + req.session.user.id + " successful attempt to view webpage");
		next();
	} else {
		res.redirect("/failed_attempt");
	}
}

app.get("/protected_page", checkSignIn, function(req, res, next) {
	res.render("protected_page", { id: req.session.user.id });
});

app.get("/admin_protected", checkAdminSignIn, function(req, res) {
	res.render("admin_protected")
});

app.get("/admin_protected/remove", function(req, res) {
	res.redirect("/admin_protected");
});

app.post("/admin_protected/remove", function(req, res) {
	var id = req.body.id;

	var db = connect();

	let sql = `SELECT * FROM Users WHERE ID == '` + id + `'`;
	db.all(sql, (err, rows) => {
		if (err) {
			console.error(err.message);
		} else {
			if (rows.length == 0) {
				//no user has that username => report no user with that name
				res.redirect("/admin_protected");
			} else {
				// remove user with that id
				var sql = `DELETE FROM Users WHERE ID == (?)`;
				db.run(sql, id, function(err) {
					if (err) {
						console.error(err.message);
					} else {
						console.log("User: " + id + " deleted from the system\n");
					}
				});
				res.redirect("/admin_protected");
			}
		}
	});
	close(db);
});

app.get("/admin_protected/add", function(req, res) {
	res.redirect("/admin_protected");
});

app.post("/admin_protected/add", function(req, res) {
	var id = req.body.id;
	var password = req.body.password;
	var db = connect();

	let sql = 'SELECT * FROM Users WHERE ID == (?)';
	db.all(sql, id, (err, rows) => {
		if (err) {
			console.error(err.message);
		} else {
			if (rows.length == 0) {
				//no user has that username => create new user
				var newUser = { id: id, password: password };
				db.run(
					`INSERT INTO Users(ID, password) VALUES(?,?)`,
					[newUser.id, newUser.password],
					function(err) {
						if (err) {
							return console.log(err.message);
						} else {
							console.log("User: " + newUser.id + " signed up");
							res.redirect("/admin_protected");
						}
					}
				);
				
			} else {
				// a user has that name => don't make new user
				res.redirect("/admin_protected")
			}
		}
	});
	close(db);
});

app.post("/get_data", function(req, res) {
	var db = connect();
	let sql = `SELECT * FROM Users`;
	db.all(sql, (err, rows) => {
		if (err) {
			console.error(err.message);
		}	else {
			res.send(rows);
		}
	});
	close(db);
});

///admin login
app.get("/admin_login", function(req, res) {
	res.render("admin_login");
});

app.post("/admin_login", function(req, res) {
	var id = req.body.id;
	var password = req.body.password;
	if (id == "g" & password == "g") {
		var admin = {id: id, password: password}
		console.log("admin: " + admin.id + " logged in.");
		req.session.admin = admin;
		res.redirect("/admin_protected");
	} else {
		res.render("admin_login", {message: "invalid login"})
	}
});

app.get("/admin_logout", function(req, res) {
	if (req.session.admin) {
		var id = req.session.admin.id;
		req.session.destroy(function() {
			console.log("admin: " + id + " logged out.\n");
		});
	}
	res.redirect("/admin_login");
});

app.get("/admin_failed", function(req, res) {
	res.render("admin_failed");
});

function checkAdminSignIn(req, res, next) {
	if (req.session.admin) {
		next();
	} else {
		res.redirect("/admin_failed");
	}
}


app.get("/", function(req, res) {
	res.redirect("/login");
});

app.listen(3000, () => console.log("Listening on port 3000"));
