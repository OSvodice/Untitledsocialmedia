const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const db = new sqlite3.Database('database.sqlite');

// EJS and Public Folder
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'mysecret',
  resave: false,
  saveUninitialized: false
}));

// Home Route
app.get('/', (req, res) => {
  if (req.session.username) {
    res.redirect('/feed');
  } else {
    res.redirect('/login');
  }
});

// Login Page
app.get('/login', (req, res) => {
  res.render('login');
});

// Login Handler
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  db.get('SELECT * FROM users WHERE username = ? AND password = ?', [username, password], (err, row) => {
    if (err) {
      console.error(err);
      return res.send('Database error.');
    }

    if (row) {
      req.session.username = username;
      res.redirect('/feed');
    } else {
      res.send('Invalid username or password.');
    }
  });
});

// Register Page
app.get('/register', (req, res) => {
  res.render('register');
});

// Register Handler
app.post('/register', (req, res) => {
  const { username, password } = req.body;

  db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, password], function (err) {
    if (err) {
      console.error(err);
      return res.send('Error during registration.');
    }

    req.session.username = username;
    res.redirect('/feed');
  });
});

// Feed Page
app.get('/feed', (req, res) => {
  if (!req.session.username) return res.redirect('/login');

  db.all('SELECT * FROM posts ORDER BY created_at DESC', (err, posts) => {
    if (err) {
      console.error(err);
      return res.send('Failed to load posts.');
    }

    res.render('feed', { posts, username: req.session.username });
  });
});

// Post Handler
app.post('/post', (req, res) => {
  const username = req.session.username;
  const content = req.body.content;

  if (!username || !content.trim()) return res.redirect('/feed');

  db.run('INSERT INTO posts (username, content, created_at) VALUES (?, ?, datetime("now"))',
    [username, content],
    (err) => {
      if (err) {
        console.error(err);
        return res.send('Failed to create post.');
      }

      res.redirect('/feed');
    }
  );
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
});
