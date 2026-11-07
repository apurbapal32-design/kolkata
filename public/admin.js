// DOM Elements
const loginOverlay = document.getElementById('loginOverlay');
const mainLayout = document.getElementById('mainLayout');
const loginForm = document.getElementById('loginForm');
const pinInput = document.getElementById('pinInput');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const toast = document.getElementById('toast');

// Drawer Elements
const sideDrawer = document.getElementById('sideDrawer');
const drawerBackdrop = document.getElementById('drawerBackdrop');
const openDrawerBtn = document.getElementById('openDrawerBtn');
const closeDrawerBtn = document.getElementById('closeDrawerBtn');
const currentPageTitle = document.getElementById('currentPageTitle');
const navItems = document.querySelectorAll('.nav-item');

const TOKEN_KEY = 'kff_admin_token';
let activeView = 'wallet-requests';
let allWalletRequests = [];

// ----------------- TOAST & AUTH HELPERS -----------------

function showToast(msg, isError = false) {
  toast.textContent = msg;
  toast.style.borderColor = isError ? 'var(--accent-red)' : 'var(--accent-green)';
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(tok) {
  localStorage.setItem(TOKEN_KEY, tok);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function authFetch(url, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, { ...options, headers });
  if (res.status === 401 || res.status === 403) {
    clearToken();
    showLogin();
    throw new Error('Session expired');
  }
  return res;
}

// ----------------- DRAWER & VIEW NAVIGATION -----------------

function openDrawer() {
  sideDrawer.classList.add('open');
  drawerBackdrop.classList.add('active');
}

function closeDrawer() {
  sideDrawer.classList.remove('open');
  drawerBackdrop.classList.remove('active');
}

openDrawerBtn.addEventListener('click', openDrawer);
closeDrawerBtn.addEventListener('click', closeDrawer);
drawerBackdrop.addEventListener('click', closeDrawer);

// View Switching
function switchView(viewName) {
  activeView = viewName;

  // Update Drawer Active Item
  navItems.forEach(item => {
    if (item.getAttribute('data-view') === viewName) {
      item.classList.add('active');
      const text = item.innerText.trim();
      currentPageTitle.textContent = text;
    } else {
      item.classList.remove('active');
    }
  });

  // Hide all view panels, show active
  document.querySelectorAll('.view-panel').forEach(panel => {
    panel.style.display = 'none';
  });

  const targetPanel = document.getElementById(`view-${viewName}`);
  if (targetPanel) {
    targetPanel.style.display = 'block';
  }

  // Close mobile drawer on item click
  closeDrawer();

  // Load view-specific data
  loadViewData(viewName);
}

navItems.forEach(item => {
  item.addEventListener('click', () => {
    const view = item.getAttribute('data-view');
    if (view) switchView(view);
  });
});

function loadViewData(view) {
  switch (view) {
    case 'dashboard':
      loadDashboardKPIs();
      break;
    case 'wallet-requests':
      loadWalletRequests();
      break;
    case 'players':
      loadPlayers();
      break;
    case 'publish-result':
      loadPublishRounds();
      break;
    case 'wallet-config':
      loadWalletConfig();
      break;
    case 'bids':
      loadBids();
      break;
    case 'games':
    case 'categories':
      loadGames();
      break;
    case 'transactions':
      loadTransactions();
      break;
    case 'download-apk':
      loadDistribution();
      break;
  }
}

// ----------------- AUTHENTICATION -----------------

function showLogin() {
  loginOverlay.style.display = 'flex';
  mainLayout.style.display = 'none';
  pinInput.value = '';
  pinInput.focus();
}

function showDashboard() {
  loginOverlay.style.display = 'none';
  mainLayout.style.display = 'flex';
  switchView('wallet-requests');
  updatePendingBadge();
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.style.display = 'none';
  const pin = pinInput.value.trim();

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin })
    });
    const data = await res.json();

    if (res.ok && data.token) {
      setToken(data.token);
      showDashboard();
      showToast('Welcome to Starline Control Menu');
    } else {
      loginError.textContent = data.error || 'Invalid Access PIN';
      loginError.style.display = 'block';
    }
  } catch (err) {
    loginError.textContent = 'Server connection error';
    loginError.style.display = 'block';
  }
});

logoutBtn.addEventListener('click', () => {
  clearToken();
  showLogin();
  showToast('Logged out');
});

// Update Pending Badge in Drawer
async function updatePendingBadge() {
  try {
    const res = await authFetch('/api/admin/overview');
    const data = await res.json();
    if (data.success && data.stats) {
      const badge = document.getElementById('pendingRequestsBadge');
      const count = data.stats.pendingRequestsCount || 0;
      if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }
  } catch (err) {}
}

// ----------------- VIEW 1: DASHBOARD -----------------

async function loadDashboardKPIs() {
  try {
    const res = await authFetch('/api/admin/overview');
    const data = await res.json();
    if (!data.success) return;

    document.getElementById('kpiTotalPlayers').textContent = data.stats.totalPlayers || 0;
    document.getElementById('kpiPendingAmount').textContent = `Rs. ${(data.stats.pendingAmount || 0).toLocaleString()}`;
    document.getElementById('kpiTodayBids').textContent = data.stats.todayBidsCount || 0;
    document.getElementById('kpiTodayVolume').textContent = `Rs. ${(data.stats.todayVolume || 0).toLocaleString()}`;

    // Load Quick Rounds Table
    const roundsRes = await fetch('/api/results/today');
    const roundsData = await roundsRes.json();
    if (roundsData.success) {
      const table = document.getElementById('dashRoundsTable');
      table.innerHTML = '';
      roundsData.rounds.forEach(r => {
        const row = document.createElement('tr');
        const isDone = r.status === 'declared';
        row.innerHTML = `
          <td><strong>Bazi ${r.bazi}</strong></td>
          <td>${getBaziTime(r.bazi, roundsData.timetable)}</td>
          <td>
            <span style="font-weight: 700; color: ${isDone ? '#fbbf24' : '#94a3b8'};">
              ${r.patti} - ${r.single}
            </span>
          </td>
          <td>
            <span class="badge ${isDone ? 'badge-approved' : 'badge-pending'}">
              ${r.status.toUpperCase()}
            </span>
          </td>
        `;
        table.appendChild(row);
      });
    }
  } catch (err) {
    console.error(err);
  }
}

function getBaziTime(baziNum, timetable) {
  if (!timetable) return 'Scheduled';
  const match = timetable.find(t => t.bazi === baziNum);
  return match ? match.time : 'Scheduled';
}

// ----------------- VIEW 2: WALLET REQUESTS -----------------

async function loadWalletRequests() {
  try {
    const res = await authFetch('/api/admin/wallet-requests');
    const data = await res.json();
    if (!data.success) return;

    allWalletRequests = data.walletRequests || [];
    renderWalletRequests(allWalletRequests);
    updatePendingBadge();
  } catch (err) {
    showToast('Failed to load wallet requests', true);
  }
}

function filterWalletRequests(filter) {
  document.getElementById('btnFilterAll').className = filter === 'all' ? 'btn btn-primary' : 'btn btn-outline';
  document.getElementById('btnFilterPending').className = filter === 'pending' ? 'btn btn-primary' : 'btn btn-outline';

  if (filter === 'pending') {
    renderWalletRequests(allWalletRequests.filter(r => r.status === 'pending'));
  } else {
    renderWalletRequests(allWalletRequests);
  }
}

function renderWalletRequests(list) {
  const table = document.getElementById('walletRequestsTable');
  table.innerHTML = '';

  document.getElementById('wrTotalCount').textContent = list.length;
  const pendingSum = list.filter(r => r.status === 'pending').reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
  document.getElementById('wrPendingAmount').textContent = `Rs. ${pendingSum.toLocaleString()}`;

  if (list.length === 0) {
    table.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 24px;">No requests found</td></tr>`;
    return;
  }

  list.forEach(req => {
    const isPending = req.status === 'pending';
    const isDeposit = req.type === 'deposit';

    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>${req.id}</strong></td>
      <td>
        <div>${req.playerName}</div>
        <small style="color: var(--text-muted);">${req.playerId}</small>
      </td>
      <td>
        <span class="badge ${isDeposit ? 'badge-approved' : 'badge-pending'}">
          ${req.type.toUpperCase()}
        </span>
      </td>
      <td><strong style="color: #fff; font-size: 1rem;">Rs. ${Number(req.amount).toLocaleString()}</strong></td>
      <td><code style="background: #0d1322; padding: 2px 6px; border-radius: 4px;">${req.utr || '-'}</code></td>
      <td><small style="color: var(--text-muted);">${req.createdAt}</small></td>
      <td>
        <span class="badge ${req.status === 'approved' ? 'badge-approved' : (req.status === 'rejected' ? 'badge-rejected' : 'badge-pending')}">
          ${req.status.toUpperCase()}
        </span>
      </td>
      <td>
        ${isPending ? `
          <div style="display: flex; gap: 6px;">
            <button onclick="handleWalletAction('${req.id}', 'approve')" class="btn btn-success" style="padding: 4px 10px; font-size: 0.75rem;">Approve</button>
            <button onclick="handleWalletAction('${req.id}', 'reject')" class="btn btn-danger" style="padding: 4px 10px; font-size: 0.75rem;">Reject</button>
          </div>
        ` : `<span style="color: var(--text-muted); font-size: 0.8rem;">Processed</span>`}
      </td>
    `;
    table.appendChild(row);
  });
}

window.handleWalletAction = async function(requestId, action) {
  if (!confirm(`Are you sure you want to ${action.toUpperCase()} request ${requestId}?`)) return;

  try {
    const res = await authFetch('/api/admin/wallet-requests/action', {
      method: 'POST',
      body: JSON.stringify({ requestId, action })
    });
    const data = await res.json();
    if (res.ok) {
      showToast(`Request ${requestId} ${action}d!`);
      loadWalletRequests();
    } else {
      showToast(data.error || 'Action failed', true);
    }
  } catch (err) {
    showToast('Network error processing request', true);
  }
};

// ----------------- VIEW 3: PLAYERS -----------------

let allPlayersList = [];

async function loadPlayers() {
  try {
    const res = await authFetch('/api/admin/players');
    const data = await res.json();
    if (data.success) {
      allPlayersList = data.players || [];
      renderPlayers(allPlayersList);
    }
  } catch (err) {
    showToast('Failed to load players', true);
  }
}

function renderPlayers(list) {
  const table = document.getElementById('playersTableBody');
  table.innerHTML = '';

  if (list.length === 0) {
    table.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 24px;">No players found</td></tr>`;
    return;
  }

  list.forEach(p => {
    const row = document.createElement('tr');
    const isActive = p.status === 'active';

    row.innerHTML = `
      <td><strong>${p.id}</strong></td>
      <td>${p.name}</td>
      <td>${p.phone}</td>
      <td><strong style="color: #34d399; font-size: 1rem;">Rs. ${(p.balance || 0).toLocaleString()}</strong></td>
      <td>
        <span class="badge ${isActive ? 'badge-approved' : 'badge-rejected'}">
          ${p.status.toUpperCase()}
        </span>
      </td>
      <td><small style="color: var(--text-muted);">${p.joinedAt}</small></td>
      <td>
        <div style="display: flex; gap: 6px;">
          <button onclick="promptBalanceChange('${p.id}', '${p.name}', 500)" class="btn btn-outline" style="padding: 4px 8px; font-size: 0.75rem;">+ Add Rs.500</button>
          <button onclick="togglePlayerStatus('${p.id}', '${isActive ? 'blocked' : 'active'}')" class="btn ${isActive ? 'btn-danger' : 'btn-success'}" style="padding: 4px 8px; font-size: 0.75rem;">
            ${isActive ? 'Block' : 'Unblock'}
          </button>
        </div>
      </td>
    `;
    table.appendChild(row);
  });
}

document.getElementById('playerSearchInput').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase();
  const filtered = allPlayersList.filter(p => p.name.toLowerCase().includes(q) || p.phone.includes(q) || p.id.toLowerCase().includes(q));
  renderPlayers(filtered);
});

window.promptBalanceChange = async function(playerId, name, defaultAmt) {
  const amtStr = prompt(`Enter balance adjustment for ${name} (positive to add, negative to deduct):`, defaultAmt);
  if (!amtStr) return;
  const amount = Number(amtStr);
  if (isNaN(amount) || amount === 0) {
    alert('Please enter a valid amount.');
    return;
  }

  try {
    const res = await authFetch('/api/admin/players/update', {
      method: 'POST',
      body: JSON.stringify({ playerId, action: 'adjust_balance', amount })
    });
    if (res.ok) {
      showToast(`Updated balance for ${name}`);
      loadPlayers();
    }
  } catch (err) {
    showToast('Failed to update balance', true);
  }
};

window.togglePlayerStatus = async function(playerId, newStatus) {
  try {
    const res = await authFetch('/api/admin/players/update', {
      method: 'POST',
      body: JSON.stringify({ playerId, status: newStatus })
    });
    if (res.ok) {
      showToast(`Player ${newStatus.toUpperCase()}`);
      loadPlayers();
    }
  } catch (err) {
    showToast('Failed to update player status', true);
  }
};

// ----------------- VIEW 4: PUBLISH RESULT -----------------

async function loadPublishRounds() {
  try {
    const res = await fetch('/api/results/today');
    const data = await res.json();
    if (!data.success) return;

    const grid = document.getElementById('publishRoundsGrid');
    grid.innerHTML = '';

    data.rounds.forEach(r => {
      const card = document.createElement('div');
      card.className = 'kpi-card';
      card.style.background = '#182133';

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <h4 style="color: #fff; font-size: 1.05rem;">Bazi ${r.bazi}</h4>
          <span style="font-size: 0.75rem; color: var(--text-muted);">${getBaziTime(r.bazi, data.timetable)}</span>
        </div>

        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 8px; margin-bottom: 10px;">
          <div>
            <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 2px;">Patti (3 Digits)</label>
            <input type="text" id="pub_patti_${r.bazi}" class="admin-input" value="${r.patti === '***' ? '' : r.patti}" maxlength="3" placeholder="358" style="font-size: 1.1rem; font-weight: 700; color: #fbbf24;">
          </div>
          <div>
            <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 2px;">Single</label>
            <input type="text" id="pub_single_${r.bazi}" class="admin-input" value="${r.single === '*' ? '' : r.single}" maxlength="1" placeholder="6" style="font-size: 1.1rem; font-weight: 700; color: #38bdf8;">
          </div>
        </div>

        <div style="margin-bottom: 12px;">
          <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 2px;">Status</label>
          <select id="pub_status_${r.bazi}" class="admin-input" style="font-size: 0.85rem;">
            <option value="waiting" ${r.status === 'waiting' ? 'selected' : ''}>⏳ Waiting</option>
            <option value="live" ${r.status === 'live' ? 'selected' : ''}>🔴 Live Now</option>
            <option value="declared" ${r.status === 'declared' ? 'selected' : ''}>✅ Declared</option>
          </select>
        </div>

        <button onclick="publishBaziResult(${r.bazi})" class="btn btn-gold" style="width: 100%; padding: 8px; font-size: 0.85rem;">
          Publish Bazi ${r.bazi}
        </button>
      `;

      grid.appendChild(card);

      // Auto compute single digit when patti entered
      const pInput = card.querySelector(`#pub_patti_${r.bazi}`);
      const sInput = card.querySelector(`#pub_single_${r.bazi}`);
      pInput.addEventListener('input', (e) => {
        const val = e.target.value.replace(/\D/g, '');
        e.target.value = val;
        if (val.length === 3) {
          const sum = (parseInt(val[0], 10) + parseInt(val[1], 10) + parseInt(val[2], 10)) % 10;
          sInput.value = sum;
          card.querySelector(`#pub_status_${r.bazi}`).value = 'declared';
        }
      });
    });

  } catch (err) {
    showToast('Failed to load rounds', true);
  }
}

window.publishBaziResult = async function(bazi) {
  const patti = document.getElementById(`pub_patti_${bazi}`).value.trim() || '***';
  const single = document.getElementById(`pub_single_${bazi}`).value.trim() || '*';
  const status = document.getElementById(`pub_status_${bazi}`).value;

  try {
    const res = await authFetch('/api/admin/update-round', {
      method: 'POST',
      body: JSON.stringify({ bazi, patti, single, status })
    });
    const data = await res.json();
    if (res.ok) {
      showToast(`Bazi ${bazi} result published: ${patti}-${single}`);
      loadPublishRounds();
    } else {
      showToast(data.error || 'Failed to publish', true);
    }
  } catch (err) {
    showToast('Error publishing round', true);
  }
};

document.getElementById('adminResetTodayBtn').addEventListener('click', async () => {
  if (!confirm("Are you sure you want to reset all today's rounds to 'Waiting'?")) return;
  try {
    const res = await authFetch('/api/admin/reset-today', { method: 'POST' });
    if (res.ok) {
      showToast("Today's board reset successfully");
      loadPublishRounds();
    }
  } catch (err) {
    showToast('Error resetting board', true);
  }
});

// ----------------- VIEW 5: WALLET CONFIG -----------------

async function loadWalletConfig() {
  try {
    const res = await authFetch('/api/admin/wallet-config');
    const data = await res.json();
    if (data.success && data.config) {
      document.getElementById('cfgUpiId').value = data.config.upiId || '';
      document.getElementById('cfgAccountHolder').value = data.config.accountHolder || '';
      document.getElementById('cfgMinDeposit').value = data.config.minDeposit || 100;
      document.getElementById('cfgMinWithdraw').value = data.config.minWithdraw || 300;
    }
  } catch (err) {
    showToast('Failed to load wallet config', true);
  }
}

document.getElementById('walletConfigForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const upiId = document.getElementById('cfgUpiId').value.trim();
  const accountHolder = document.getElementById('cfgAccountHolder').value.trim();
  const minDeposit = Number(document.getElementById('cfgMinDeposit').value);
  const minWithdraw = Number(document.getElementById('cfgMinWithdraw').value);

  try {
    const res = await authFetch('/api/admin/wallet-config', {
      method: 'POST',
      body: JSON.stringify({ upiId, accountHolder, minDeposit, minWithdraw })
    });
    if (res.ok) {
      showToast('Wallet configuration saved successfully');
    }
  } catch (err) {
    showToast('Error saving configuration', true);
  }
});

// ----------------- VIEW 6: BIDS -----------------

async function loadBids() {
  try {
    const res = await authFetch('/api/admin/bids');
    const data = await res.json();
    if (data.success) {
      const table = document.getElementById('bidsTableBody');
      table.innerHTML = '';
      (data.bids || []).forEach(b => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td><strong>${b.id}</strong></td>
          <td>${b.playerName}</td>
          <td>${b.game}</td>
          <td><strong style="color: #fbbf24;">${b.type}</strong></td>
          <td>Rs. ${b.amount}</td>
          <td><span style="color: #34d399;">Rs. ${b.potentialWin}</span></td>
          <td><small style="color: var(--text-muted);">${b.time}</small></td>
          <td>
            <span class="badge ${b.status === 'won' ? 'badge-approved' : 'badge-pending'}">
              ${b.status.toUpperCase()}
            </span>
          </td>
        `;
        table.appendChild(row);
      });
    }
  } catch (err) {}
}

// ----------------- VIEW 7: GAMES & CATEGORIES -----------------

async function loadGames() {
  try {
    const res = await fetch('/api/results/today');
    const data = await res.json();
    if (data.success && data.timetable) {
      const table = document.getElementById('gamesScheduleTable');
      table.innerHTML = '';
      data.timetable.forEach(t => {
        const round = data.rounds.find(r => r.bazi === t.bazi);
        const row = document.createElement('tr');
        row.innerHTML = `
          <td><strong>Kolkata Fatafat - ${t.label}</strong></td>
          <td>${t.time}</td>
          <td>
            <span class="badge ${round && round.status === 'declared' ? 'badge-approved' : 'badge-pending'}">
              ${round && round.status === 'declared' ? 'COMPLETED' : 'OPEN FOR BIDS'}
            </span>
          </td>
        `;
        table.appendChild(row);
      });
    }
  } catch (err) {}
}

// ----------------- VIEW 8: STAFF ACCESS (PIN CHANGE) -----------------

document.getElementById('saveStaffPinBtn').addEventListener('click', async () => {
  const newPin = document.getElementById('staffNewPin').value.trim();
  if (newPin.length < 4) {
    showToast('PIN must be at least 4 digits', true);
    return;
  }
  try {
    const res = await authFetch('/api/admin/change-pin', {
      method: 'POST',
      body: JSON.stringify({ newPin })
    });
    if (res.ok) {
      showToast('Master Access PIN changed successfully!');
      document.getElementById('staffNewPin').value = '';
    }
  } catch (err) {
    showToast('Error changing PIN', true);
  }
});

// ----------------- VIEW 9: TRANSACTIONS -----------------

async function loadTransactions() {
  try {
    const res = await authFetch('/api/admin/transactions');
    const data = await res.json();
    if (data.success) {
      const table = document.getElementById('txnsTableBody');
      table.innerHTML = '';
      (data.transactions || []).forEach(tx => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td><strong>${tx.id}</strong></td>
          <td>${tx.playerName}</td>
          <td>${tx.type}</td>
          <td><strong style="color: #fff;">Rs. ${tx.amount}</strong></td>
          <td><small style="color: var(--text-muted);">${tx.timestamp}</small></td>
          <td><span class="badge badge-approved">${tx.status}</span></td>
        `;
        table.appendChild(row);
      });
    }
  } catch (err) {}
}

// ----------------- VIEW 10: DISTRIBUTION (DOWNLOAD APK) -----------------

async function loadDistribution() {
  try {
    const res = await authFetch('/api/admin/distribution');
    const data = await res.json();
    if (data.success && data.distribution) {
      const dist = data.distribution;
      document.getElementById('distApkName').textContent = dist.apkName || 'Starline-Live.apk';
      document.getElementById('distVersion').textContent = dist.version || 'v1.4.2';
      document.getElementById('distSize').textContent = dist.fileSize || '8.4 MB';
      document.getElementById('distDownloadLink').href = dist.downloadUrl || '#';
      document.getElementById('apkVersionInput').value = dist.version || '';
      document.getElementById('apkUrlInput').value = dist.downloadUrl || '';
    }
  } catch (err) {}
}

document.getElementById('distributionForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const version = document.getElementById('apkVersionInput').value.trim();
  const downloadUrl = document.getElementById('apkUrlInput').value.trim();
  try {
    const res = await authFetch('/api/admin/distribution', {
      method: 'POST',
      body: JSON.stringify({ version, downloadUrl })
    });
    if (res.ok) {
      showToast('Distribution settings updated');
      loadDistribution();
    }
  } catch (err) {
    showToast('Failed to update distribution', true);
  }
});

// ----------------- INITIALIZATION -----------------

(async function init() {
  const token = getToken();
  if (!token) {
    showLogin();
    return;
  }
  try {
    const res = await authFetch('/api/admin/verify');
    if (res.ok) {
      showDashboard();
    } else {
      showLogin();
    }
  } catch (err) {
    showLogin();
  }
})();
