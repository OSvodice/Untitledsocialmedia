const express = require('express');
const path = require('path');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');

const app = express();
const db = new sqlite3.Database('./database.sqlite');

// Set up EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'supersecretkey',
  resave: false,
  saveUninitialized: false
}));

// Route: Home
app.get('/', (req, res) => {
  if (req.session.username) return res.redirect('/feed');
  res.redirect('/login');
});

// Route: Login page
app.get('/login', (req, res) => {
  res.render('login');
});

// Route: Register page
app.get('/register', (req, res) => {
  res.render('register');
});

// Route: Handle login
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  db.get('SELECT * FROM users WHERE username = ? AND password = ?', [username, password], (err, user) => {
    if (err) return res.send('DB error');
    if (!user) return res.send('Invalid login');

    req.session.username = user.username;
    res.redirect('/feed');
  });
});

// Route: Handle registration
app.post('/register', (req, res) => {
  const { username, password } = req.body;

  db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, password], function (err) {
    if (err) return res.send('Registration error: ' + err.message);

    req.session.username = username;
    res.redirect('/feed');
  });
});

// Route: Feed page
app.get('/feed', (req, res) => {
  if (!req.session.username) return res.redirect('/login');

  db.all('SELECT * FROM posts ORDER BY created_at DESC', (err, posts) => {
    if (err) return res.send('Error loading posts');

    res.render('feed', { posts });
  });
});

// Route: Create post
app.post('/post', (req, res) => {
  const username = req.session.username;
  const content = req.body.content;

  if (!username || !content) return res.redirect('/feed');

  db.run('INSERT INTO posts (username, content, created_at) VALUES (?, ?, datetime("now"))', [username, content], (err) => {
    if (err) return res.send('Post error: ' + err.message);

    res.redirect('/feed');
  });
});

// Route: Logout
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`App running at http://localhost:${PORT}`);
});
