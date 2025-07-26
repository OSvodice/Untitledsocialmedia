const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const app = express();
const db = new sqlite3.Database('database.sqlite');

// Setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'mysecret',
  resave: false,
  saveUninitialized: false
}));

// Middleware to require login
function requireLogin(req, res, next) {
  if (!req.session.username) return res.redirect('/login');
  next();
}

// Register route
app.get('/register', (req, res) => {
  res.render('register');
});

app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.send('Username and password required');

  try {
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword], function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.send('Username already taken');
        }
        console.error(err);
        return res.send('Database error');
      }
      req.session.username = username;
      res.redirect('/feed');
    });
  } catch (error) {
    console.error(error);
    res.send('Server error');
  }
});

// Login route
app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.send('Username and password required');

  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, row) => {
    if (err) {
      console.error(err);
      return res.send('Database error');
    }
    if (!row) return res.send('Invalid username or password');

    const match = await bcrypt.compare(password, row.password);
    if (!match) return res.send('Invalid username or password');

    req.session.username = username;
    res.redirect('/feed');
  });
});

// Feed route (protected)
app.get('/feed', requireLogin, (req, res) => {
  db.all('SELECT * FROM posts ORDER BY created_at DESC', (err, posts) => {
    if (err) {
      console.error(err);
      return res.send('Failed to load posts.');
    }
    res.render('feed', { posts, username: req.session.username });
  });
});

// Post creation (protected)
app.post('/post', requireLogin, (req, res) => {
  const username = req.session.username;
  const content = req.body.content;
  if (!content.trim()) return res.redirect('/feed');

  db.run('INSERT INTO posts (username, content) VALUES (?, ?)', [username, content], (err) => {
    if (err) {
      console.error(err);
      return res.send('Failed to create post.');
    }
    res.redirect('/feed');
  });
});

// Logout route
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
