const BACKEND_URL = `${location.protocol}//${location.hostname}:${location.port}`;
const socket = io(BACKEND_URL);

// DOM Elements
const connectionIndicator = document.getElementById('connection-indicator');
const connectionText = document.getElementById('connection-text');
const scanIndicator = document.getElementById('scan-indicator');
const uidInput = document.getElementById('uid');
const amountInput = document.getElementById('amount');
const topupBtn = document.getElementById('topup-btn');
const logList = document.getElementById('log-list');
const cardVisual = document.getElementById('card-visual');
const cardNumberDisplay = document.getElementById('card-number-display');
const cardUidDisplay = document.getElementById('card-uid-display');
const cardBalanceDisplay = document.getElementById('card-balance-display');
const cardStatus = document.getElementById('card-status');
const lastActivity = document.getElementById('last-activity');
const clearLogBtn = document.getElementById('clear-log-btn');
const currentTimeDisplay = document.getElementById('current-time');

let lastScannedUid = null;

// Update current time
function updateTime() {
  const now = new Date();
  currentTimeDisplay.textContent = now.toLocaleTimeString();
}
updateTime();
setInterval(updateTime, 1000);

// Load saved amount from localStorage
const savedAmount = localStorage.getItem('topupAmount');
if (savedAmount) {
  amountInput.value = savedAmount;
}

// Save amount to localStorage whenever it changes
amountInput.addEventListener('input', (e) => {
  if (e.target.value) {
    localStorage.setItem('topupAmount', e.target.value);
  }
});

// Clear log button
clearLogBtn.addEventListener('click', () => {
  logList.innerHTML = '<li class="log-empty">No activity yet. Scan a card to get started.</li>';
});

// -------------------------------
// Socket.IO events
// -------------------------------
socket.on('connect', () => {
  connectionIndicator.classList.add('connected');
  connectionText.textContent = 'Connected';
  addLog('✓ Connected to backend server');
});

socket.on('disconnect', () => {
  connectionIndicator.classList.remove('connected');
  connectionText.textContent = 'Disconnected';
  addLog('✗ Disconnected from backend server');
});

socket.on('card-status', (data) => {
  addLog(`💳 Card detected: ${data.uid}`);
  lastScannedUid = data.uid;
  uidInput.value = data.uid;

  // Check if card already exists in localStorage
  const storedBalance = localStorage.getItem(`card_${data.uid}`);
  let balance;

  if (storedBalance) {
    balance = parseFloat(storedBalance);
    addLog(`📊 Loaded saved balance: $${balance.toFixed(2)}`);
  } else {
    balance = data.balance;
    addLog(`🆕 New card initialized with balance: $${balance.toFixed(2)}`);
  }

  // Store/update card balance
  localStorage.setItem(`card_${data.uid}`, balance);

  // Update card visual
  cardVisual.classList.add('active');
  scanIndicator.classList.add('active');
  scanIndicator.querySelector('span').textContent = 'Card detected';
  
  // Format card number display
  const uidFormatted = data.uid.match(/.{1,4}/g)?.join(' ') || data.uid;
  cardNumberDisplay.textContent = uidFormatted;
  cardUidDisplay.textContent = data.uid;
  cardBalanceDisplay.textContent = `$${balance.toFixed(2)}`;
  
  // Update stats
  cardStatus.textContent = 'Active';
  cardStatus.style.color = 'var(--success)';
  updateLastActivity();

  topupBtn.disabled = false;
});

socket.on('card-balance', (data) => {
  addLog(`💰 Balance updated: $${data.new_balance.toFixed(2)}`);

  if (data.uid === lastScannedUid) {
    cardBalanceDisplay.textContent = `$${data.new_balance.toFixed(2)}`;
    
    // Brief pulse effect
    cardVisual.style.transform = 'scale(1.05)';
    setTimeout(() => { cardVisual.style.transform = ''; }, 300);
  }
});

socket.on('topup-success', (data) => {
  if (data.uid === lastScannedUid) {
    addLog(`✓ Top-up successful: +$${data.amount.toFixed(2)} → New balance: $${data.newBalance.toFixed(2)}`);
    localStorage.setItem(`card_${data.uid}`, data.newBalance);
    cardBalanceDisplay.textContent = `$${data.newBalance.toFixed(2)}`;
    updateLastActivity();
    
    // Success animation
    cardVisual.style.transform = 'scale(1.1)';
    setTimeout(() => { cardVisual.style.transform = ''; }, 400);
  }
});

// -------------------------------
// Top-up button click
// -------------------------------
topupBtn.addEventListener('click', async () => {
  const amount = parseFloat(amountInput.value);
  if (isNaN(amount) || amount <= 0) {
    alert('Please enter a valid amount');
    return;
  }

  if (!lastScannedUid) {
    alert('Please scan a card first');
    return;
  }

  try {
    const currentBalance = parseFloat(localStorage.getItem(`card_${lastScannedUid}`) || 0);
    
    addLog(`⏳ Processing top-up: $${amount.toFixed(2)}...`);

    const response = await fetch(`${BACKEND_URL}/topup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid: lastScannedUid,
        amount,
        currentBalance
      })
    });

    const result = await response.json();
    if (result.success) {
      amountInput.value = '';
      localStorage.removeItem('topupAmount');
    } else {
      addLog(`✗ Error: ${result.error}`);
    }
  } catch (err) {
    addLog('✗ Failed to connect to backend for top-up');
    console.error(err);
  }
});

// -------------------------------
// Helper functions
// -------------------------------
function addLog(message) {
  // Remove empty placeholder if exists
  const emptyLog = logList.querySelector('.log-empty');
  if (emptyLog) {
    emptyLog.remove();
  }

  const li = document.createElement('li');
  const now = new Date();
  
  const timeSpan = document.createElement('span');
  timeSpan.className = 'log-time';
  timeSpan.textContent = now.toLocaleTimeString();
  
  const messageSpan = document.createElement('span');
  messageSpan.textContent = message;
  
  li.appendChild(timeSpan);
  li.appendChild(messageSpan);
  logList.prepend(li);

  // Keep only last 20 logs
  if (logList.children.length > 20) {
    logList.removeChild(logList.lastChild);
  }
}

function updateLastActivity() {
  const now = new Date();
  lastActivity.textContent = now.toLocaleTimeString();
}
