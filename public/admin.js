const loginSection = document.getElementById('loginSection');
const dashboardSection = document.getElementById('dashboardSection');
const loginForm = document.getElementById('loginForm');
const pinInput = document.getElementById('pinInput');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const toast = document.getElementById('toast');
const adminDateBadge = document.getElementById('adminDateBadge');
const adminRoundsGrid = document.getElementById('adminRoundsGrid');
const adminNoticeInput = document.getElementById('adminNoticeInput');
const saveNoticeBtn = document.getElementById('saveNoticeBtn');
const resetTodayBtn = document.getElementById('resetTodayBtn');
const changePinToggleBtn = document.getElementById('changePinToggleBtn');
const changePinBox = document.getElementById('changePinBox');
const newPinInput = document.getElementById('newPinInput');
const savePinBtn = document.getElementById('savePinBtn');

const TOKEN_KEY = 'kff_admin_token';

// Show Toast Alert
function showToast(msg, isError = false) {
  toast.textContent = msg;
  toast.style.borderColor = isError ? 'var(--accent-red)' : 'var(--accent-green)';
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// Token Helpers
function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(tok) {
  localStorage.setItem(TOKEN_KEY, tok);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// API Fetch Wrapper with Auth Header
async function authFetch(url, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401 || res.status === 403) {
    clearToken();
    showLogin();
    throw new Error('Session expired. Please log in.');
  }
  return res;
}

// UI State Toggles
function showLogin() {
  loginSection.style.display = 'block';
  dashboardSection.style.display = 'none';
  logoutBtn.style.display = 'none';
  pinInput.value = '';
  pinInput.focus();
}

function showDashboard() {
  loginSection.style.display = 'none';
  dashboardSection.style.display = 'block';
  logoutBtn.style.display = 'inline-block';
  loadAdminData();
}

// Login Submission
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
      showToast('Welcome to Admin Control Hub');
    } else {
      loginError.textContent = data.error || 'Invalid PIN';
      loginError.style.display = 'block';
    }
  } catch (err) {
    loginError.textContent = 'Server connection error';
    loginError.style.display = 'block';
  }
});

// Logout
logoutBtn.addEventListener('click', () => {
  clearToken();
  showLogin();
  showToast('Logged out successfully');
});

// Load Admin Data
async function loadAdminData() {
  try {
    const res = await fetch('/api/results/today');
    const data = await res.json();
    if (!data.success) return;

    adminDateBadge.textContent = data.date;
    adminNoticeInput.value = data.notice || '';

    // Render 8 Round Control Cards
    adminRoundsGrid.innerHTML = '';
    data.rounds.forEach(round => {
      const card = document.createElement('div');
      card.className = 'round-card';
      card.style.textAlign = 'left';

      card.innerHTML = `
        <div class="round-header">
          <span style="font-size: 1rem; color: #fff;">Bazi ${round.bazi}</span>
          <span style="font-size: 0.75rem; color: var(--text-muted);">${round.updatedAt ? `Last: ${round.updatedAt}` : ''}</span>
        </div>

        <div style="display: flex; gap: 8px; margin: 12px 0;">
          <div style="flex: 2;">
            <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Patti (3 Digits)</label>
            <input type="text" id="patti_${round.bazi}" class="admin-input" value="${round.patti === '***' ? '' : round.patti}" maxlength="3" placeholder="e.g. 129" style="font-weight: 700; font-size: 1.1rem; color: #fbbf24;">
          </div>
          <div style="flex: 1;">
            <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Single</label>
            <input type="text" id="single_${round.bazi}" class="admin-input" value="${round.single === '*' ? '' : round.single}" maxlength="1" placeholder="2" style="font-weight: 700; font-size: 1.1rem; color: #38bdf8;">
          </div>
        </div>

        <div style="margin-bottom: 12px;">
          <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Status</label>
          <select id="status_${round.bazi}" class="admin-input" style="font-size: 0.85rem;">
            <option value="waiting" ${round.status === 'waiting' ? 'selected' : ''}>⏳ Waiting</option>
            <option value="live" ${round.status === 'live' ? 'selected' : ''}>🔴 Live Now</option>
            <option value="declared" ${round.status === 'declared' ? 'selected' : ''}>✅ Declared</option>
          </select>
        </div>

        <button onclick="publishRound(${round.bazi})" class="btn btn-primary" style="width: 100%; padding: 8px; font-size: 0.85rem;">
          Publish Bazi ${round.bazi}
        </button>
      `;

      adminRoundsGrid.appendChild(card);

      // Add auto-calc single when patti 3 digits typed
      const pInput = card.querySelector(`#patti_${round.bazi}`);
      const sInput = card.querySelector(`#single_${round.bazi}`);
      pInput.addEventListener('input', (e) => {
        const val = e.target.value.replace(/\D/g, '');
        e.target.value = val;
        if (val.length === 3) {
          const sum = (parseInt(val[0], 10) + parseInt(val[1], 10) + parseInt(val[2], 10)) % 10;
          sInput.value = sum;
          card.querySelector(`#status_${round.bazi}`).value = 'declared';
        }
      });
    });

  } catch (err) {
    showToast('Failed to load rounds', true);
  }
}

// Publish Round Function
window.publishRound = async function(bazi) {
  const patti = document.getElementById(`patti_${bazi}`).value.trim() || '***';
  const single = document.getElementById(`single_${bazi}`).value.trim() || '*';
  const status = document.getElementById(`status_${bazi}`).value;

  try {
    const res = await authFetch('/api/admin/update-round', {
      method: 'POST',
      body: JSON.stringify({ bazi, patti, single, status })
    });
    const data = await res.json();
    if (res.ok) {
      showToast(`Bazi ${bazi} updated to ${patti}-${single}!`);
      loadAdminData();
    } else {
      showToast(data.error || 'Update failed', true);
    }
  } catch (err) {
    showToast('Network error while updating round', true);
  }
};

// Update Notice
saveNoticeBtn.addEventListener('click', async () => {
  const notice = adminNoticeInput.value.trim();
  try {
    const res = await authFetch('/api/admin/update-notice', {
      method: 'POST',
      body: JSON.stringify({ notice })
    });
    const data = await res.json();
    if (res.ok) {
      showToast('Ticker notice updated successfully');
    } else {
      showToast(data.error || 'Failed to update notice', true);
    }
  } catch (err) {
    showToast('Network error updating notice', true);
  }
});

// Reset Board
resetTodayBtn.addEventListener('click', async () => {
  if (!confirm("Are you sure you want to reset all 8 rounds for today to 'Waiting'?")) return;
  try {
    const res = await authFetch('/api/admin/reset-today', {
      method: 'POST'
    });
    const data = await res.json();
    if (res.ok) {
      showToast("Today's board has been reset");
      loadAdminData();
    } else {
      showToast(data.error || 'Reset failed', true);
    }
  } catch (err) {
    showToast('Error resetting board', true);
  }
});

// Change PIN toggle
changePinToggleBtn.addEventListener('click', () => {
  const isShown = changePinBox.style.display === 'block';
  changePinBox.style.display = isShown ? 'none' : 'block';
});

// Save New PIN
savePinBtn.addEventListener('click', async () => {
  const newPin = newPinInput.value.trim();
  if (newPin.length < 4) {
    showToast('PIN must be at least 4 digits', true);
    return;
  }
  try {
    const res = await authFetch('/api/admin/change-pin', {
      method: 'POST',
      body: JSON.stringify({ newPin })
    });
    const data = await res.json();
    if (res.ok) {
      showToast('Admin Access PIN changed successfully!');
      newPinInput.value = '';
      changePinBox.style.display = 'none';
    } else {
      showToast(data.error || 'Failed to change PIN', true);
    }
  } catch (err) {
    showToast('Error changing PIN', true);
  }
});

// Init Check
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
