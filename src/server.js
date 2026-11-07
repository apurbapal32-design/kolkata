require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { getAdminPin, generateToken, authMiddleware } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, '..', 'data', 'results.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Helper to safely read database
function readData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading data file:', err);
    return null;
  }
}

// Helper to safely write database atomically
function writeData(data) {
  try {
    const tempFile = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempFile, DATA_FILE);
    return true;
  } catch (err) {
    console.error('Error writing data file:', err);
    return false;
  }
}

// Format local date YYYY-MM-DD
function getTodayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Check and rollover date if day changed
function checkDateRollover(data) {
  const todayStr = getTodayString();
  if (data.today.date !== todayStr) {
    // Archive current today to history
    const existingIndex = data.history.findIndex(h => h.date === data.today.date);
    if (existingIndex >= 0) {
      data.history[existingIndex] = { ...data.today };
    } else {
      data.history.unshift({ ...data.today });
    }

    // Keep history clean (last 30 days)
    if (data.history.length > 30) {
      data.history = data.history.slice(0, 30);
    }

    // Reset today
    data.today = {
      date: todayStr,
      rounds: Array.from({ length: 8 }, (_, i) => ({
        bazi: i + 1,
        patti: '***',
        single: '*',
        status: 'waiting',
        updatedAt: '-'
      }))
    };
    writeData(data);
  }
  return data;
}

// ------------------- PUBLIC ENDPOINTS -------------------

// Get current live results & timetable
app.get('/api/results/today', (req, res) => {
  let data = readData();
  if (!data) return res.status(500).json({ error: 'Database read error' });
  data = checkDateRollover(data);

  res.json({
    success: true,
    serverTime: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }),
    date: data.today.date,
    notice: data.notice || '',
    timetable: data.timetable,
    rounds: data.today.rounds
  });
});

// Get historical results chart
app.get('/api/results/history', (req, res) => {
  const data = readData();
  if (!data) return res.status(500).json({ error: 'Database read error' });

  const { date } = req.query;
  if (date) {
    const record = data.history.find(h => h.date === date);
    if (!record && data.today.date === date) {
      return res.json({ success: true, record: data.today });
    }
    return res.json({ success: true, record: record || null });
  }

  res.json({
    success: true,
    today: data.today,
    history: data.history
  });
});

// Timetable schedule
app.get('/api/timetable', (req, res) => {
  const data = readData();
  if (!data) return res.status(500).json({ error: 'Database read error' });
  res.json({ success: true, timetable: data.timetable });
});

// ------------------- ADMIN AUTH & MANAGEMENT -------------------

// Admin PIN Login
app.post('/api/admin/login', (req, res) => {
  const { pin } = req.body;
  if (!pin) {
    return res.status(400).json({ error: 'Access PIN is required.' });
  }

  const data = readData();
  const configuredPin = getAdminPin(data && data.adminPinOverride);

  if (String(pin).trim() !== String(configuredPin).trim()) {
    return res.status(401).json({ error: 'Incorrect Access PIN. Please try again.' });
  }

  const token = generateToken(pin);
  res.json({
    success: true,
    message: 'Authentication successful',
    token
  });
});

// Verify Admin Session Token
app.get('/api/admin/verify', authMiddleware, (req, res) => {
  res.json({ success: true, message: 'Session is valid' });
});

// Update specific round result
app.post('/api/admin/update-round', authMiddleware, (req, res) => {
  const { bazi, patti, single, status } = req.body;
  const baziNum = parseInt(bazi, 10);

  if (isNaN(baziNum) || baziNum < 1 || baziNum > 8) {
    return res.status(400).json({ error: 'Invalid Bazi number (must be 1-8).' });
  }

  let data = readData();
  data = checkDateRollover(data);

  const round = data.today.rounds.find(r => r.bazi === baziNum);
  if (!round) {
    return res.status(404).json({ error: `Bazi ${baziNum} not found.` });
  }

  if (patti !== undefined) round.patti = String(patti).trim();
  if (single !== undefined) round.single = String(single).trim();
  if (status !== undefined) round.status = status;

  round.updatedAt = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  if (writeData(data)) {
    res.json({ success: true, message: `Bazi ${baziNum} updated successfully`, round });
  } else {
    res.status(500).json({ error: 'Failed to save changes.' });
  }
});

// Update ticker notice
app.post('/api/admin/update-notice', authMiddleware, (req, res) => {
  const { notice } = req.body;
  const data = readData();
  data.notice = String(notice || '').trim();

  if (writeData(data)) {
    res.json({ success: true, message: 'Notice updated successfully', notice: data.notice });
  } else {
    res.status(500).json({ error: 'Failed to update notice.' });
  }
});

// Update timetable
app.post('/api/admin/update-timetable', authMiddleware, (req, res) => {
  const { timetable } = req.body;
  if (!Array.isArray(timetable)) {
    return res.status(400).json({ error: 'Invalid timetable format.' });
  }

  const data = readData();
  data.timetable = timetable;

  if (writeData(data)) {
    res.json({ success: true, message: 'Timetable updated successfully' });
  } else {
    res.status(500).json({ error: 'Failed to save timetable.' });
  }
});

// Reset today's board
app.post('/api/admin/reset-today', authMiddleware, (req, res) => {
  const data = readData();
  data.today.rounds = Array.from({ length: 8 }, (_, i) => ({
    bazi: i + 1,
    patti: '***',
    single: '*',
    status: 'waiting',
    updatedAt: '-'
  }));

  if (writeData(data)) {
    res.json({ success: true, message: "Today's board reset to waiting." });
  } else {
    res.status(500).json({ error: 'Failed to reset board.' });
  }
});

// Change Admin PIN
app.post('/api/admin/change-pin', authMiddleware, (req, res) => {
  const { newPin } = req.body;
  if (!newPin || String(newPin).trim().length < 4) {
    return res.status(400).json({ error: 'New PIN must be at least 4 digits.' });
  }

  const data = readData();
  data.adminPinOverride = String(newPin).trim();

  if (writeData(data)) {
    res.json({ success: true, message: 'Access PIN changed successfully.' });
  } else {
    res.status(500).json({ error: 'Failed to change PIN.' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Catch-all route for frontend navigation
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(` Kolkata Fatafat Results Portal & Admin Server `);
  console.log(` Server running on http://localhost:${PORT}      `);
  console.log(` Admin Dashboard: http://localhost:${PORT}/admin `);
  console.log(` Default PIN: ${getAdminPin()}                  `);
  console.log(`===============================================`);
});
