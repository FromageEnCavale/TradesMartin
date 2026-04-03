/* ============================================================
   CONFIG
   Free plan: 800 calls/day, 8 calls/min.
   With 2 symbols, 60s interval = ~2 calls/min → safe.
   ============================================================ */

const POSITIONS = {
  brent: {
    symbol:    'BZ=F',        // ✅ Yahoo Brent
    entry:     109.515,
    qty:       210,
    side:      'long',
    decimals:  3,
    priceElId: 'brentPrice',
    pnlElId:   'brentPnl',
    pctElId:   'brentPct',
    cardElId:  'cardBrent',
  },
  btc: {
    symbol:    'BTC-USD',     // ✅ Yahoo BTC
    entry:     67806.75,
    qty:       0.51,
    side:      'short',
    decimals:  2,
    priceElId: 'btcPrice',
    pnlElId:   'btcPnl',
    pctElId:   'btcPct',
    cardElId:  'cardBtc',
  },
};

const REFRESH_INTERVAL_MS = 60_000; // 60 seconds


/* ============================================================
   API
   ============================================================ */

/**
 * Fetch the current price for a given symbol via our Vercel
 * serverless proxy (/api/price), which hides the API key.
 *
 * @param {string} symbol
 * @returns {Promise<number>}
 */
async function fetchPrice(symbol) {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`
  );

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const data = await res.json();

  const price =
    data?.quoteResponse?.result?.[0]?.regularMarketPrice;

  if (typeof price !== 'number') {
    throw new Error('Invalid price');
  }

  return price;
}


/* ============================================================
   P&L CALCULATION
   ============================================================ */

/**
 * @param {{ entry: number, qty: number, side: 'long'|'short' }} position
 * @param {number} currentPrice
 * @returns {{ pnl: number, pct: number }}
 */
function calcPnl(position, currentPrice) {
  const diff = position.side === 'long'
    ? currentPrice - position.entry     // long:  profit when price rises
    : position.entry - currentPrice;    // short: profit when price falls

  const pnl = diff * position.qty;
  const pct = (diff / position.entry) * 100;

  return { pnl, pct };
}


/* ============================================================
   RENDER
   ============================================================ */

function fmt(value, decimals) {
  return value.toLocaleString('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function sign(value) {
  return value >= 0 ? '+' : '';
}

function cls(value) {
  return value >= 0 ? 'profit' : 'loss';
}

/**
 * Update a single position card with live data.
 *
 * @param {object}  position
 * @param {number}  currentPrice
 */
function renderCard(position, currentPrice) {
  const { pnl, pct } = calcPnl(position, currentPrice);
  const direction     = cls(pnl);

  // Live price
  document.getElementById(position.priceElId).textContent =
    fmt(currentPrice, position.decimals) + ' $';

  // P&L in USD
  const pnlEl = document.getElementById(position.pnlElId);
  pnlEl.textContent = sign(pnl) + fmt(pnl, 2) + ' $';
  pnlEl.className   = `result__usd ${direction}`;

  // P&L in %
  const pctEl = document.getElementById(position.pctElId);
  pctEl.textContent = sign(pct) + pct.toFixed(2) + ' %';
  pctEl.className   = `result__pct ${direction}`;

  // Card accent color
  document.getElementById(position.cardElId).className = `card ${direction}`;
}

/**
 * Update the total P&L header.
 *
 * @param {number} total
 */
function renderTotal(total) {
  const totalEl = document.getElementById('totalPnl');
  totalEl.textContent = sign(total) + fmt(total, 2) + ' $';
  totalEl.className   = `summary__amount ${cls(total)}`;

  document.getElementById('totalTime').textContent =
    'Mis à jour à ' + new Date().toLocaleTimeString('fr-FR');
}

/**
 * Update the status bar.
 *
 * @param {'live'|'partial'|'error'} state
 */
function renderStatus(state) {
  const dot  = document.getElementById('dot');
  const text = document.getElementById('statusTxt');

  const states = {
    live:    { dotClass: 'dot live', label: 'Prix en direct' },
    partial: { dotClass: 'dot live', label: 'Données partielles' },
    error:   { dotClass: 'dot err',  label: 'Erreur de connexion' },
  };

  const { dotClass, label } = states[state] ?? states.error;
  dot.className   = dotClass;
  text.textContent = label;
}


/* ============================================================
   MAIN REFRESH LOOP
   ============================================================ */

async function refresh() {
  const entries = Object.values(POSITIONS);

  const results = await Promise.allSettled(
    entries.map(p => fetchPrice(p.symbol))
  );

  let total    = 0;
  let resolved = 0;

  results.forEach((result, i) => {
    if (result.status !== 'fulfilled') {
      console.warn(`[${entries[i].symbol}] fetch failed:`, result.reason);
      return;
    }

    const currentPrice = result.value;
    renderCard(entries[i], currentPrice);
    total += calcPnl(entries[i], currentPrice).pnl;
    resolved++;
  });

  if (resolved > 0)  renderTotal(total);

  if (resolved === entries.length) renderStatus('live');
  else if (resolved > 0)           renderStatus('partial');
  else                             renderStatus('error');
}

// Initial fetch + polling
refresh();
setInterval(refresh, REFRESH_INTERVAL_MS);