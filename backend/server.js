// server.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());

// Serve static files from the parent directory
app.use(express.static(path.join(__dirname, '..')));

const usersFile = path.join(__dirname, 'users.json');
const journalsFile = path.join(__dirname, 'journals.json');

// Helper to read/write files
function readFile(file) {
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeFile(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Signup Route
app.post('/signup', async (req, res) => {
  try {
    const { phone, password } = req.body;
    const users = readFile(usersFile);
    if (users.find(u => u.phone === phone)) return res.status(400).json({ error: 'User already exists' });
    const hashedPassword = await bcrypt.hash(password, 10);
    users.push({ phone, password: hashedPassword, id: Date.now().toString() });
    writeFile(usersFile, users);
    res.json({ message: 'User created successfully!' });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login Route
app.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    const users = readFile(usersFile);
    const user = users.find(u => u.phone === phone);
    if (!user) return res.status(400).json({ error: 'User not found' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id }, 'secretkey');
    res.json({ token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Middleware to protect routes
const auth = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ error: 'Access denied' });
  try {
    const verified = jwt.verify(token, 'secretkey');
    req.user = verified;
    next();
  } catch {
    res.status(400).json({ error: 'Invalid token' });
  }
};

// Add Journal Entry
app.post('/journal', auth, async (req, res) => {
  try {
    const journals = readFile(journalsFile);
    journals.push({
      userId: req.user.id,
      entryText: req.body.entryText,
      bgColor: req.body.bgColor,
      sticker: req.body.sticker,
      fontFamily: req.body.fontFamily,
      fontSize: req.body.fontSize,
      fontColor: req.body.fontColor,
      createdAt: new Date()
    });
    writeFile(journalsFile, journals);
    res.json({ message: 'Entry saved!' });
  } catch (error) {
    console.error('Journal save error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get Past Entries
app.get('/journal', auth, async (req, res) => {
  try {
    const journals = readFile(journalsFile);
    const userEntries = journals.filter(j => j.userId === req.user.id);
    res.json(userEntries);
  } catch (error) {
    console.error('Journal get error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'login.html'));
});

app.listen(5000, () => console.log('Server running on port 5000'));
