/* ============================================================
   CONFIG
   ============================================================ */
const POSITIONS = {
  brent: {
    symbol: 'xyz:UKOIL', // On commence par la syntaxe trade.xyz
    // S'il ne le trouve pas du premier coup, il testera ces variantes automatiquement
    aliases:['xyz:UKOIL', 'xyz:BRENT', 'xyz:BRENTOIL', 'xyz:OIL', 'UKOIL', 'BRENT'], 
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
    aliases:[],
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

const REFRESH_INTERVAL_MS = 5_000; // Rafraîchissement toutes les 5s (gratuit et illimité)

/* ============================================================
   API HYPERLIQUID
   ============================================================ */

// 1. Récupère tous les prix cryptos standards (BTC)
async function fetchAllMids() {
  const res = await fetch('https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'allMids' })
  });
  if (!res.ok) throw new Error('API Hyperliquid injoignable');
  return await res.json();
}

// 2. Récupère le prix via le carnet d'ordres (spécifique pour Trade.xyz)
async function fetchL2BookPrice(coin) {
  try {
    const res = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Interrogation directe du DEX
      body: JSON.stringify({ type: 'l2Book', coin: coin })
    });
    const data = await res.json();
    
    // Si le carnet d'ordres existe pour ce ticker, on calcule le prix actuel (Mid Price)
    if (data && data.levels && data.levels[0].length > 0 && data.levels[1].length > 0) {
      const bid = parseFloat(data.levels[0][0].px); // Meilleur acheteur
      const ask = parseFloat(data.levels[1][0].px); // Meilleur vendeur
      return (bid + ask) / 2; 
    }
  } catch (e) {
    // Silencieux pour permettre de tester les alias suivants
  }
  return null;
}

/* ============================================================
   LOGIQUE ET CALCULS
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
  const states = {
    live: { c: 'dot live', t: 'Prix en direct (HL L1)' },
    partial: { c: 'dot live', t: 'Données partielles' },
    error: { c: 'dot err', t: 'Recherche du marché XYZ...' },
  };
  document.getElementById('dot').className = states[state].c;
  document.getElementById('statusTxt').textContent = states[state].t;
}

/* ============================================================
   BOUCLE PRINCIPALE (AUTO-DISCOVERY)
   ============================================================ */

async function getPriceForPosition(p, allMids) {
  // 1. On regarde d'abord dans les prix standards de Hyperliquid (ex: BTC)
  if (allMids[p.symbol]) return parseFloat(allMids[p.symbol]);
  
  // 2. Sinon, on interroge le carnet d'ordres en direct
  let price = await fetchL2BookPrice(p.symbol);
  if (price !== null) return price;

  // 3. Si introuvable, on lance la sonde sur les alias (uniquement pour le BRENT)
  if (p.aliases && p.aliases.length > 0) {
    for (const alias of p.aliases) {
      if (allMids[alias]) {
        p.symbol = alias;
        return parseFloat(allMids[alias]);
      }
      const aliasPrice = await fetchL2BookPrice(alias);
      if (aliasPrice !== null) {
        console.log(`[Succès L1] Marché BRENT trouvé sous le ticker : ${alias}`);
        p.symbol = alias; // On sauvegarde ce ticker pour que la prochaine boucle soit instantanée
        return aliasPrice;
      }
    }
  }

  return null; // Ticker complètement introuvable
}

async function refresh() {
  try {
    const allMids = await fetchAllMids();
    let total = 0;
    let resolved = 0;
    const entries = Object.values(POSITIONS);

    // On traite chaque actif
    for (const p of entries) {
      const currentPrice = await getPriceForPosition(p, allMids);

      if (currentPrice !== null) {
        renderCard(p, currentPrice);
        total += calcPnl(p, currentPrice).pnl;
        resolved++;
      } else {
        console.warn(`[${p.symbol}] En attente du réseau L1...`);
      }
    }

    if (resolved > 0) renderTotal(total);
    renderStatus(resolved === entries.length ? 'live' : (resolved > 0 ? 'partial' : 'error'));

  } catch (err) {
    console.error("Erreur réseau :", err);
    renderStatus('error');
  }
}

// Lancement initial
refresh();
setInterval(refresh, REFRESH_INTERVAL_MS);