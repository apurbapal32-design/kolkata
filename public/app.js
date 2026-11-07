// DOM Elements
const roundsGrid = document.getElementById('roundsGrid');
const todayDateBadge = document.getElementById('todayDateBadge');
const tickerNotice = document.getElementById('tickerNotice');
const timetableBody = document.getElementById('timetableBody');
const historyTableBody = document.getElementById('historyTableBody');
const historyDateInput = document.getElementById('historyDateInput');
const searchHistoryBtn = document.getElementById('searchHistoryBtn');
const liveClock = document.getElementById('liveClock');
const pwaBanner = document.getElementById('pwaBanner');
const installBtn = document.getElementById('installBtn');

let deferredPrompt;

// PWA Install Prompt Handler
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (pwaBanner) pwaBanner.style.display = 'flex';
});

if (installBtn) {
  installBtn.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        pwaBanner.style.display = 'none';
      }
      deferredPrompt = null;
    }
  });
}

// Service Worker Registration
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js').catch(err => {
    console.log('SW registration failed:', err);
  });
}

// Update Live Clock
function updateClock() {
  const now = new Date();
  liveClock.textContent = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
}
setInterval(updateClock, 1000);
updateClock();

// Fetch Today's Live Results
async function loadTodayResults() {
  try {
    const res = await fetch('/api/results/today');
    const data = await res.json();

    if (!data.success) return;

    // Set Date & Ticker
    todayDateBadge.textContent = data.date;
    if (data.notice) {
      tickerNotice.textContent = data.notice;
    }

    // Render 8 Round Cards
    roundsGrid.innerHTML = '';
    data.rounds.forEach(round => {
      const isDeclared = round.status === 'declared';
      const card = document.createElement('div');
      card.className = `round-card ${isDeclared ? 'declared' : ''}`;

      const badgeClass = round.status === 'declared' ? 'badge-declared' : (round.status === 'live' ? 'badge-live' : 'badge-waiting');
      const badgeText = round.status === 'declared' ? 'DECLARED' : (round.status === 'live' ? 'LIVE NOW' : 'WAITING');

      card.innerHTML = `
        <div class="round-header">
          <span>Bazi ${round.bazi}</span>
          <span class="round-badge ${badgeClass}">${badgeText}</span>
        </div>
        <div class="round-score">
          <span class="score-patti">${round.patti || '***'}</span>
          <span class="score-divider">-</span>
          <span class="score-single">${round.single || '*'}</span>
        </div>
        <div class="round-time">
          ${isDeclared ? `Declared at: ${round.updatedAt}` : `Expected: ${getBaziTime(round.bazi, data.timetable)}`}
        </div>
      `;
      roundsGrid.appendChild(card);
    });

    // Render Timetable
    if (data.timetable && timetableBody) {
      timetableBody.innerHTML = '';
      data.timetable.forEach(t => {
        const round = data.rounds.find(r => r.bazi === t.bazi);
        const status = round ? round.status : 'waiting';
        const isDone = status === 'declared';

        const row = document.createElement('tr');
        row.innerHTML = `
          <td><strong>${t.label}</strong></td>
          <td>${t.time}</td>
          <td>
            <span class="round-badge ${isDone ? 'badge-declared' : 'badge-waiting'}">
              ${isDone ? `Result: ${round.patti}-${round.single}` : 'Pending'}
            </span>
          </td>
        `;
        timetableBody.appendChild(row);
      });
    }

  } catch (err) {
    console.error('Error fetching today results:', err);
  }
}

function getBaziTime(baziNum, timetable) {
  if (!timetable) return 'Scheduled';
  const match = timetable.find(t => t.bazi === baziNum);
  return match ? match.time : 'Scheduled';
}

// Fetch History Table
async function loadHistory(selectedDate = null) {
  try {
    const url = selectedDate ? `/api/results/history?date=${selectedDate}` : '/api/results/history';
    const res = await fetch(url);
    const data = await res.json();

    if (!data.success) return;

    historyTableBody.innerHTML = '';

    if (selectedDate && data.record) {
      renderHistoryRow(data.record);
    } else if (data.history) {
      // Also show today as the top row
      if (data.today) renderHistoryRow(data.today);
      data.history.forEach(item => renderHistoryRow(item));
    } else {
      historyTableBody.innerHTML = `<tr><td colspan="9" style="padding: 20px; color: var(--text-muted);">No records found for ${selectedDate}</td></tr>`;
    }
  } catch (err) {
    console.error('Error fetching history:', err);
  }
}

function renderHistoryRow(item) {
  const row = document.createElement('tr');
  const roundsMap = {};
  (item.rounds || []).forEach(r => {
    roundsMap[r.bazi] = `${r.patti}-${r.single}`;
  });

  let cells = `<td><strong>${item.date}</strong></td>`;
  for (let i = 1; i <= 8; i++) {
    cells += `<td>${roundsMap[i] || '***'}</td>`;
  }
  row.innerHTML = cells;
  historyTableBody.appendChild(row);
}

// Search History by Date
if (searchHistoryBtn) {
  searchHistoryBtn.addEventListener('click', () => {
    const d = historyDateInput.value;
    if (d) {
      loadHistory(d);
    } else {
      loadHistory();
    }
  });
}

// Initial Load & Auto Poll every 10 seconds
loadTodayResults();
loadHistory();
setInterval(loadTodayResults, 10000);
