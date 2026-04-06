const POSITIONS = {
    brent: {
        symbol: "xyz:CL",
        entry: 109.55,
        qty: 211,
        side: "long",
        decimals: 2,
        priceElId: "brentPrice",
        pnlElId: "brentPnl",
        pctElId: "brentPct",
        cardElId: "cardBrent",
    },
    btc: {
        symbol: "BTC",
        entry: 67805,
        qty: 0.505,
        side: "short",
        decimals: 2,
        priceElId: "btcPrice",
        pnlElId: "btcPnl",
        pctElId: "btcPct",
        cardElId: "cardBtc",
    },
};

const REFRESH_INTERVAL_MS = 30_000; // 30 secondes, illimité sur Hyperliquid

async function fetchPrice(coin) {
    const res = await fetch("https://api.hyperliquid.xyz/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "l2Book", coin: coin }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (
        data &&
        data.levels &&
        data.levels[0].length > 0 &&
        data.levels[1].length > 0
    ) {
        const bid = parseFloat(data.levels[0][0].px);
        const ask = parseFloat(data.levels[1][0].px);
        return (bid + ask) / 2;
    }

    throw new Error(`Carnet d'ordres vide pour ${coin}`);
}

function calcPnl(position, currentPrice) {
    const diff =
        position.side === "long"
            ? currentPrice - position.entry
            : position.entry - currentPrice;
    return { pnl: diff * position.qty, pct: (diff / position.entry) * 100 };
}

function fmt(value, dec) {
    return value.toLocaleString("fr-FR", {
        minimumFractionDigits: dec,
        maximumFractionDigits: dec,
    });
}
function sign(value) {
    return value >= 0 ? "+" : "";
}
function cls(value) {
    return value >= 0 ? "profit" : "loss";
}

function renderCard(position, currentPrice) {
    const { pnl, pct } = calcPnl(position, currentPrice);
    const direction = cls(pnl);

    document.getElementById(position.priceElId).textContent =
        fmt(currentPrice, position.decimals) + " $";

    const pnlEl = document.getElementById(position.pnlElId);
    pnlEl.textContent = sign(pnl) + fmt(pnl, 2) + " $";
    pnlEl.className = `result__usd ${direction}`;

    const pctEl = document.getElementById(position.pctElId);
    pctEl.textContent = sign(pct) + pct.toFixed(2) + " %";
    pctEl.className = `result__pct ${direction}`;

    document.getElementById(position.cardElId).className = `card ${direction}`;
}

function renderTotal(total) {
    const totalEl = document.getElementById("totalPnl");
    totalEl.textContent = sign(total) + fmt(total, 2) + " $";
    totalEl.className = `summary__amount ${cls(total)}`;
    document.getElementById("totalTime").textContent =
        "Mis à jour à " + new Date().toLocaleTimeString("fr-FR");
}

function renderStatus(state) {
    const states = {
        live: { c: "dot live", t: "Prix en direct" },
        partial: { c: "dot live", t: "Données partielles" },
        error: { c: "dot err", t: "Erreur réseau" },
    };
    document.getElementById("dot").className = states[state].c;
    document.getElementById("statusTxt").textContent = states[state].t;
}

async function refresh() {
    const entries = Object.values(POSITIONS);

    const results = await Promise.allSettled(
        entries.map((p) => fetchPrice(p.symbol)),
    );

    let total = 0;
    let resolved = 0;

    results.forEach((res, i) => {
        if (res.status === "fulfilled") {
            renderCard(entries[i], res.value);
            total += calcPnl(entries[i], res.value).pnl;
            resolved++;
        } else {
            console.warn(`[${entries[i].symbol}] Erreur fetch :`, res.reason);
        }
    });

    if (resolved > 0) renderTotal(total);

    if (resolved === entries.length) renderStatus("live");
    else if (resolved > 0) renderStatus("partial");
    else renderStatus("error");
}

refresh();
setInterval(refresh, REFRESH_INTERVAL_MS);
