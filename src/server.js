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

function readData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading data file:', err);
    return null;
  }
}

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

function getTodayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function checkDateRollover(data) {
  const todayStr = getTodayString();
  if (data.today && data.today.date !== todayStr) {
    const existingIndex = data.history.findIndex(h => h.date === data.today.date);
    if (existingIndex >= 0) {
      data.history[existingIndex] = { ...data.today };
    } else {
      data.history.unshift({ ...data.today });
    }
    if (data.history.length > 30) data.history = data.history.slice(0, 30);

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

app.get('/api/timetable', (req, res) => {
  const data = readData();
  if (!data) return res.status(500).json({ error: 'Database read error' });
  res.json({ success: true, timetable: data.timetable });
});

// Public APK info endpoint
app.get('/api/distribution/info', (req, res) => {
  const data = readData();
  res.json({ success: true, distribution: (data && data.distribution) || {} });
});

// ------------------- ADMIN AUTH & MANAGEMENT -------------------

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

app.get('/api/admin/verify', authMiddleware, (req, res) => {
  res.json({ success: true, message: 'Session is valid' });
});

// Admin Overview KPI Stats
app.get('/api/admin/overview', authMiddleware, (req, res) => {
  const data = readData();
  const pendingRequests = (data.walletRequests || []).filter(r => r.status === 'pending');
  const pendingAmount = pendingRequests.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  res.json({
    success: true,
    stats: {
      totalPlayers: (data.players || []).length,
      pendingRequestsCount: pendingRequests.length,
      pendingAmount: pendingAmount,
      todayBidsCount: (data.bids || []).length,
      todayVolume: (data.stats && data.stats.todayVolume) || 12850
    },
    walletConfig: data.walletConfig || {},
    recentRequests: pendingRequests.slice(0, 5)
  });
});

// Players Management
app.get('/api/admin/players', authMiddleware, (req, res) => {
  const data = readData();
  res.json({ success: true, players: data.players || [] });
});

app.post('/api/admin/players/update', authMiddleware, (req, res) => {
  const { playerId, action, amount, status } = req.body;
  const data = readData();
  const player = (data.players || []).find(p => p.id === playerId);

  if (!player) return res.status(404).json({ error: 'Player not found' });

  if (action === 'adjust_balance' && amount !== undefined) {
    const delta = Number(amount);
    player.balance = Math.max(0, (player.balance || 0) + delta);
    
    // Add transaction log
    (data.transactions = data.transactions || []).unshift({
      id: `TXN-${Date.now().toString().slice(-4)}`,
      playerName: player.name,
      type: delta >= 0 ? 'Admin Credit' : 'Admin Debit',
      amount: Math.abs(delta),
      status: 'Completed',
      timestamp: new Date().toLocaleString('en-IN')
    });
  }

  if (status) {
    player.status = status;
  }

  writeData(data);
  res.json({ success: true, message: 'Player updated successfully', player });
});

// Wallet Requests Management (Deposit / Withdraw Approval)
app.get('/api/admin/wallet-requests', authMiddleware, (req, res) => {
  const data = readData();
  res.json({ success: true, walletRequests: data.walletRequests || [] });
});

app.post('/api/admin/wallet-requests/action', authMiddleware, (req, res) => {
  const { requestId, action } = req.body; // action: 'approve' or 'reject'
  const data = readData();
  const reqItem = (data.walletRequests || []).find(r => r.id === requestId);

  if (!reqItem) return res.status(404).json({ error: 'Request not found' });
  if (reqItem.status !== 'pending') return res.status(400).json({ error: 'Request is already processed' });

  const player = (data.players || []).find(p => p.id === reqItem.playerId);

  if (action === 'approve') {
    reqItem.status = 'approved';
    if (player) {
      if (reqItem.type === 'deposit') {
        player.balance = (player.balance || 0) + Number(reqItem.amount);
      } else if (reqItem.type === 'withdraw') {
        player.balance = Math.max(0, (player.balance || 0) - Number(reqItem.amount));
      }
    }
    // Log transaction
    (data.transactions = data.transactions || []).unshift({
      id: `TXN-${Date.now().toString().slice(-4)}`,
      playerName: reqItem.playerName,
      type: reqItem.type === 'deposit' ? 'Wallet Deposit' : 'Wallet Withdrawal',
      amount: Number(reqItem.amount),
      status: 'Approved',
      timestamp: new Date().toLocaleString('en-IN')
    });
  } else {
    reqItem.status = 'rejected';
  }

  writeData(data);
  res.json({ success: true, message: `Request ${action}d successfully`, request: reqItem });
});

// Wallet Config (UPI, QR, Limits)
app.get('/api/admin/wallet-config', authMiddleware, (req, res) => {
  const data = readData();
  res.json({ success: true, config: data.walletConfig || {} });
});

app.post('/api/admin/wallet-config', authMiddleware, (req, res) => {
  const { upiId, accountHolder, minDeposit, minWithdraw, autoApprove } = req.body;
  const data = readData();

  data.walletConfig = {
    ...data.walletConfig,
    upiId: upiId || data.walletConfig.upiId,
    accountHolder: accountHolder || data.walletConfig.accountHolder,
    minDeposit: Number(minDeposit) || data.walletConfig.minDeposit,
    minWithdraw: Number(minWithdraw) || data.walletConfig.minWithdraw,
    autoApprove: Boolean(autoApprove)
  };

  writeData(data);
  res.json({ success: true, message: 'Wallet configuration saved', config: data.walletConfig });
});

// Bids Monitor
app.get('/api/admin/bids', authMiddleware, (req, res) => {
  const data = readData();
  res.json({ success: true, bids: data.bids || [] });
});

// Transactions Ledger
app.get('/api/admin/transactions', authMiddleware, (req, res) => {
  const data = readData();
  res.json({ success: true, transactions: data.transactions || [] });
});

// Distribution / APK Config
app.get('/api/admin/distribution', authMiddleware, (req, res) => {
  const data = readData();
  res.json({ success: true, distribution: data.distribution || {} });
});

app.post('/api/admin/distribution', authMiddleware, (req, res) => {
  const { version, fileSize, downloadUrl } = req.body;
  const data = readData();
  data.distribution = {
    ...data.distribution,
    version: version || data.distribution.version,
    fileSize: fileSize || data.distribution.fileSize,
    downloadUrl: downloadUrl || data.distribution.downloadUrl,
    updatedAt: getTodayString()
  };
  writeData(data);
  res.json({ success: true, message: 'Distribution updated', distribution: data.distribution });
});

// Result Publishing
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
    res.json({ success: true, message: `Bazi ${baziNum} published successfully`, round });
  } else {
    res.status(500).json({ error: 'Failed to save changes.' });
  }
});

// Reset Today's Board
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

// Catch-all
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` Starline / Kolkata Fatafat Control Hub Running       `);
  console.log(` Server: http://localhost:${PORT}                      `);
  console.log(` Admin Dashboard: http://localhost:${PORT}/admin         `);
  console.log(` Access PIN: ${getAdminPin()}                           `);
  console.log(`=======================================================`);
});
