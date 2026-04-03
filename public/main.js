/* ============================================================
   CONFIG
   ============================================================ */
const POSITIONS = {
  brent: {
    symbol: 'BRENT', 
    // Liste des symboles testés automatiquement si "BRENT" ne marche pas
    aliases:['UKOIL', 'OIL', '@xyz/BRENT', '@1/BRENT', '@trade/BRENT', 'WTI'], 
    entry: 109.515,
    qty: 210,
    side: 'long',
    decimals: 3,
    priceElId: 'brentPrice',
    pnlElId: 'brentPnl',
    pctElId: 'brentPct',
    cardElId: 'cardBrent',
  },
  btc: {
    symbol: 'BTC',
    entry: 67806.75,
    qty: 0.51,
    side: 'short',
    decimals: 2,
    priceElId: 'btcPrice',
    pnlElId: 'btcPnl',
    pctElId: 'btcPct',
    cardElId: 'cardBtc',
  },
};

const REFRESH_INTERVAL_MS = 5_000;

/* ============================================================
   API HYPERLIQUID (PERPS + SPOT)
   ============================================================ */
async function fetchHyperliquidPrices() {
  try {
    // 1. Récupérer les Perpétuels
    const resPerps = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'allMids' })
    }).then(r => r.json());

    // 2. Récupérer les Spot / HIP-3 (Au cas où le Brent soit là-dedans)
    const resSpot = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'spotMids' })
    }).then(r => r.json()).catch(() => ({}));

    // On fusionne les deux listes de prix
    return { ...resPerps, ...resSpot };
  } catch (err) {
    throw new Error('Erreur de connexion API Hyperliquid');
  }
}

/* ============================================================
   CALCULS & RENDU
   ============================================================ */
function calcPnl(position, currentPrice) {
  const diff = position.side === 'long'
    ? currentPrice - position.entry
    : position.entry - currentPrice;
  return { pnl: diff * position.qty, pct: (diff / position.entry) * 100 };
}

function fmt(value, dec) { return value.toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec }); }
function sign(value) { return value >= 0 ? '+' : ''; }
function cls(value) { return value >= 0 ? 'profit' : 'loss'; }

function renderCard(position, currentPrice) {
  const { pnl, pct } = calcPnl(position, currentPrice);
  const direction = cls(pnl);

  document.getElementById(position.priceElId).textContent = fmt(currentPrice, position.decimals) + ' $';
  
  const pnlEl = document.getElementById(position.pnlElId);
  pnlEl.textContent = sign(pnl) + fmt(pnl, 2) + ' $';
  pnlEl.className = `result__usd ${direction}`;

  const pctEl = document.getElementById(position.pctElId);
  pctEl.textContent = sign(pct) + pct.toFixed(2) + ' %';
  pctEl.className = `result__pct ${direction}`;

  document.getElementById(position.cardElId).className = `card ${direction}`;
}

function renderTotal(total) {
  const totalEl = document.getElementById('totalPnl');
  totalEl.textContent = sign(total) + fmt(total, 2) + ' $';
  totalEl.className = `summary__amount ${cls(total)}`;
  document.getElementById('totalTime').textContent = 'Mis à jour à ' + new Date().toLocaleTimeString('fr-FR');
}

function renderStatus(state) {
  const dot = document.getElementById('dot');
  const text = document.getElementById('statusTxt');
  const states = {
    live: { dotClass: 'dot live', label: 'Prix en direct' },
    partial: { dotClass: 'dot live', label: 'Données partielles' },
    error: { dotClass: 'dot err', label: 'Erreur de connexion' },
  };
  dot.className = states[state].dotClass;
  text.textContent = states[state].label;
}

/* ============================================================
   BOUCLE PRINCIPALE
   ============================================================ */
async function refresh() {
  try {
    const prices = await fetchHyperliquidPrices();
    let total = 0;
    let resolved = 0;

    for (const p of Object.values(POSITIONS)) {
      let currentPriceStr = prices[p.symbol];

      // Si le symbole principal ne marche pas, on teste les aliases (pour le BRENT)
      if (!currentPriceStr && p.aliases) {
        for (const alias of p.aliases) {
          if (prices[alias]) {
            currentPriceStr = prices[alias];
            console.log(`[Succès] Ticker trouvé pour le Brent : ${alias}`);
            p.symbol = alias; // On le sauvegarde pour la prochaine fois
            break;
          }
        }
      }

      if (!currentPriceStr) {
        console.warn(`[${p.symbol}] Introuvable. Voici la liste des actifs dispos :`, Object.keys(prices));
        continue;
      }

      const currentPrice = parseFloat(currentPriceStr);
      renderCard(p, currentPrice);
      total += calcPnl(p, currentPrice).pnl;
      resolved++;
    }

    if (resolved > 0) renderTotal(total);
    renderStatus(resolved === 2 ? 'live' : (resolved > 0 ? 'partial' : 'error'));

  } catch (err) {
    console.error(err);
    renderStatus('error');
  }
}

refresh();
setInterval(refresh, REFRESH_INTERVAL_MS);