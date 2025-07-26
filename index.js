const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const db = require('./db');

const app = express();
const PORT = 3000;

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: true
}));

// Middleware to check login
function checkAuth(req, res, next) {
  if (req.session.user) return next();
  res.redirect('/login');
}

// Middleware to require login and set userId shortcut
function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  req.session.userId = req.session.user.id;
  next();
}

// Home → feed
app.get('/', requireLogin, (req, res) => {
  db.all(
    `SELECT posts.*, users.username 
     FROM posts 
     JOIN users ON posts.user_id = users.id 
     ORDER BY timestamp DESC`,
    [],
    (err, posts) => {
      if (err) return res.sendStatus(500);
      res.render('feed', { user: req.session.user, posts });
    }
  );
});

// Register
app.get('/register', (req, res) => res.render('register'));

app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  const hash = await bcrypt.hash(password, 10);
  db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, [username, hash], (err) => {
    if (err) return res.send('Username taken.');
    res.redirect('/login');
  });
});

// Login
app.get('/login', (req, res) => res.render('login'));

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, user) => {
    if (!user) return res.send('No such user.');
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.send('Wrong password.');
    req.session.user = user;
    res.redirect('/');
  });
});

// Post creation
app.post('/post', requireLogin, (req, res) => {
  const content = req.body.content;
  db.run(`INSERT INTO posts (user_id, content) VALUES (?, ?)`, [req.session.user.id, content], () => {
    res.redirect('/');
  });
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// Profile
app.get('/profile', requireLogin, (req, res) => {
  db.get('SELECT * FROM users WHERE id = ?', [req.session.userId], (err, user) => {
    if (err) return res.sendStatus(500);
    res.render('profile', { user });
  });
});

app.get('/profile/edit', requireLogin, (req, res) => {
  db.get('SELECT * FROM users WHERE id = ?', [req.session.userId], (err, user) => {
    if (err) return res.sendStatus(500);
    res.render('edit-profile', { user });
  });
});

app.post('/profile/edit', requireLogin, (req, res) => {
  const { bio, music } = req.body;
  db.run(`UPDATE users SET bio = ?, music = ? WHERE id = ?`, [bio, music, req.session.userId], (err) => {
    if (err) return res.sendStatus(500);
    res.redirect('/profile');
  });
});

// View other user's profile
app.get('/user/:username', requireLogin, (req, res) => {
  const username = req.params.username;

  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) return res.sendStatus(500);
    if (!user) return res.status(404).send('User not found');

    db.get('SELECT COUNT(*) AS count FROM followers WHERE following_id = ?', [user.id], (err, followers) => {
      if (err) return res.sendStatus(500);

      db.get('SELECT COUNT(*) AS count FROM followers WHERE follower_id = ?', [user.id], (err, following) => {
        if (err) return res.sendStatus(500);

        db.all(
          `SELECT posts.id, posts.content, posts.timestamp, users.username
           FROM posts JOIN users ON posts.user_id = users.id
           WHERE user_id = ? ORDER BY posts.timestamp DESC`,
          [user.id],
          (err, posts) => {
            if (err) return res.sendStatus(500);

            db.get(
              'SELECT * FROM followers WHERE follower_id = ? AND following_id = ?',
              [req.session.userId, user.id],
              (err, followingRelation) => {
                if (err) return res.sendStatus(500);

                res.render('user-profile', {
                  user,
                  followers: followers.count,
                  following: following.count,
                  posts,
                  isFollowing: !!followingRelation,
                  currentUserId: req.session.userId,
                });
              }
            );
          }
        );
      });
    });
  });
});

// Follow
app.post('/user/:username/follow', requireLogin, (req, res) => {
  const username = req.params.username;
  const followerId = req.session.userId;

  db.get('SELECT id FROM users WHERE username = ?', [username], (err, user) => {
    if (err) return res.sendStatus(500);
    if (!user) return res.status(404).send('User not found');
    if (user.id === followerId) return res.status(400).send("Can't follow yourself");

    db.run(
      'INSERT OR IGNORE INTO followers (follower_id, following_id) VALUES (?, ?)',
      [followerId, user.id],
      (err) => {
        if (err) return res.sendStatus(500);
        res.redirect(`/user/${username}`);
      }
    );
  });
});

// Unfollow
app.post('/user/:username/unfollow', requireLogin, (req, res) => {
  const username = req.params.username;
  const followerId = req.session.userId;

  db.get('SELECT id FROM users WHERE username = ?', [username], (err, user) => {
    if (err) return res.sendStatus(500);
    if (!user) return res.status(404).send('User not found');
    if (user.id === followerId) return res.status(400).send("Can't unfollow yourself");

    db.run(
      'DELETE FROM followers WHERE follower_id = ? AND following_id = ?',
      [followerId, user.id],
      (err) => {
        if (err) return res.sendStatus(500);
        res.redirect(`/user/${username}`);
      }
    );
  });
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
});
