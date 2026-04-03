/* ============================================================
   CONFIG
   ============================================================ */

const POSITIONS = {
  brent: {
    symbol:    'BRENT',        // Ticker sur trade.xyz / Hyperliquid (HIP-3)
    entry:     109.515,
    qty:       210,
    side:      'long',         // Profit quand le prix monte
    decimals:  3,
    priceElId: 'brentPrice',
    pnlElId:   'brentPnl',
    pctElId:   'brentPct',
    cardElId:  'cardBrent',
  },
  btc: {
    symbol:    'BTC',          // Ticker sur Hyperliquid
    entry:     67806.75,
    qty:       0.51,
    side:      'short',        // Profit quand le prix descend
    decimals:  2,
    priceElId: 'btcPrice',
    pnlElId:   'btcPnl',
    pctElId:   'btcPct',
    cardElId:  'cardBtc',
  },
};

const REFRESH_INTERVAL_MS = 5_000; // Rafraîchissement ultra rapide (5 secondes)

/* ============================================================
   API HYPERLIQUID
   ============================================================ */

/**
 * Récupère tous les prix directement depuis le L1 d'Hyperliquid.
 * Une seule requête POST ultra légère pour tout récupérer d'un coup.
 */
async function fetchAllPrices() {
  const res = await fetch('https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // On demande le "mid price" de tous les contrats
    body: JSON.stringify({ type: 'allMids' })
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  return await res.json();
}

/* ============================================================
   P&L CALCULATION
   ============================================================ */

function calcPnl(position, currentPrice) {
  const diff = position.side === 'long'
    ? currentPrice - position.entry
    : position.entry - currentPrice;

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

function renderCard(position, currentPrice) {
  const { pnl, pct } = calcPnl(position, currentPrice);
  const direction    = cls(pnl);

  document.getElementById(position.priceElId).textContent = fmt(currentPrice, position.decimals) + ' $';
  
  const pnlEl = document.getElementById(position.pnlElId);
  pnlEl.textContent = sign(pnl) + fmt(pnl, 2) + ' $';
  pnlEl.className   = `result__usd ${direction}`;

  const pctEl = document.getElementById(position.pctElId);
  pctEl.textContent = sign(pct) + pct.toFixed(2) + ' %';
  pctEl.className   = `result__pct ${direction}`;

  document.getElementById(position.cardElId).className = `card ${direction}`;
}

function renderTotal(total) {
  const totalEl = document.getElementById('totalPnl');
  totalEl.textContent = sign(total) + fmt(total, 2) + ' $';
  totalEl.className   = `summary__amount ${cls(total)}`;

  document.getElementById('totalTime').textContent =
    'Mis à jour à ' + new Date().toLocaleTimeString('fr-FR');
}

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
  try {
    const prices = await fetchAllPrices();
    
    let total = 0;
    let resolved = 0;
    const entries = Object.values(POSITIONS);

    for (const p of entries) {
      // Hyperliquid renvoie les prix sous forme de string (ex: "67500.5")
      const currentPriceStr = prices[p.symbol];
      
      if (!currentPriceStr) {
        console.warn(`[${p.symbol}] Prix introuvable sur l'API Hyperliquid`);
        continue;
      }

      const currentPrice = parseFloat(currentPriceStr);
      renderCard(p, currentPrice);
      total += calcPnl(p, currentPrice).pnl;
      resolved++;
    }

    if (resolved > 0) renderTotal(total);

    if (resolved === entries.length) renderStatus('live');
    else if (resolved > 0)           renderStatus('partial');
    else                             renderStatus('error');

  } catch (err) {
    console.error('Erreur réseau Hyperliquid:', err);
    renderStatus('error');
  }
}

// Initial fetch + polling
refresh();
setInterval(refresh, REFRESH_INTERVAL_MS);