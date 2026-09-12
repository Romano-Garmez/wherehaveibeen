// Inputs stay metric (OwnTracks and Turf produce km, km², m, km/h); display is
// imperial-first with the metric value underneath.
const KM_PER_MI = 1.609344;
const SQKM_PER_SQMI = 2.589988;
const FT_PER_M = 3.28084;
// Combined land area of Washington, Oregon, and California.
const WEST_COAST_KM2 = 863428;

const STAT_DEFINITIONS = [
    { id: "totalDist", label: "Distance driven", flightsLabel: "Distance travelled", everyoneLabel: "Combined distance", unit: "mi" },
    { id: "totalArea", label: "Area explored", unit: "mi²" },
    { id: "totalAreaPct", label: "West coast covered", unit: "%", accent: true, bar: true },
    { id: "highestAltitude", label: "Highest altitude", unit: "ft" },
    { id: "highestVelocity", label: "Top speed", unit: "mph" },
];

let statContext = { variant: "mine" };

function setStatContext(context) {
    statContext = Object.assign({}, statContext, context);
}

function formatNumber(n, decimals) {
    return Number(n).toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}

function formatMeasure(n) {
    const abs = Math.abs(n);
    const decimals = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
    return formatNumber(n, decimals);
}

function renderStatPanels(container, { variant = "mine" } = {}) {
    if (!container) return;
    setStatContext({ variant });
    container.innerHTML = "";

    STAT_DEFINITIONS.forEach((def) => {
        const stat = document.createElement("div");
        stat.className = "stat" + (def.accent ? " stat--accent" : "");

        const label = document.createElement("span");
        label.className = "stat__label";
        label.id = def.id + "Label";
        label.textContent = variant === "everyone" && def.everyoneLabel ? def.everyoneLabel : def.label;

        const value = document.createElement("span");
        value.className = "stat__value";
        const number = document.createElement("span");
        number.id = def.id;
        number.textContent = "—";
        const unit = document.createElement("span");
        unit.className = "stat__unit";
        unit.id = def.id + "Unit";
        unit.textContent = def.unit;
        value.append(number, def.unit === "%" ? "" : " ", unit);

        stat.append(label, value);

        if (def.bar && variant === "everyone") {
            const bar = document.createElement("span");
            bar.className = "stat__bar";
            const fill = document.createElement("span");
            fill.id = def.id + "Bar";
            bar.appendChild(fill);
            stat.appendChild(bar);
        } else {
            const sub = document.createElement("span");
            sub.className = "stat__sub";
            sub.id = def.id + "Sub";
            sub.textContent = " ";
            stat.appendChild(sub);
        }

        container.appendChild(stat);
    });
}

function setStat(id, value, sub) {
    const valueEl = document.getElementById(id);
    if (!valueEl) return;
    valueEl.textContent = value;
    const subEl = document.getElementById(id + "Sub");
    if (subEl) subEl.textContent = sub || " ";
}

function setStatBar(id, pct) {
    const fill = document.getElementById(id + "Bar");
    if (fill) fill.style.width = Math.max(0, Math.min(100, pct)) + "%";
}

function showDistanceStat(km, flightsIncluded = false) {
    const notes = [formatMeasure(km) + " km"];
    if (statContext.variant === "everyone") {
        notes.push("everyone on this server");
    } else {
        notes.push(flightsIncluded ? "flights included" : "flights excluded");
        const def = STAT_DEFINITIONS.find((d) => d.id === "totalDist");
        const labelEl = document.getElementById("totalDistLabel");
        if (labelEl) labelEl.textContent = flightsIncluded ? def.flightsLabel : def.label;
    }
    setStat("totalDist", formatMeasure(km / KM_PER_MI), notes.join(" · "));
}

function blankDistanceStat() {
    const def = STAT_DEFINITIONS.find((d) => d.id === "totalDist");
    const labelEl = document.getElementById("totalDistLabel");
    if (labelEl) labelEl.textContent = def.label;
    setStat("totalDist", "—", "not measured in heatmap mode");
}

function showAreaStat(km2) {
    setStat("totalArea", formatMeasure(km2 / SQKM_PER_SQMI), formatMeasure(km2) + " km²");
    showCoverageStat(km2);
}

function showCoverageStat(km2) {
    const pct = (km2 / WEST_COAST_KM2) * 100;
    const sub = formatMeasure(km2 / SQKM_PER_SQMI) + " of " +
        formatNumber(Math.round(WEST_COAST_KM2 / SQKM_PER_SQMI), 0) + " mi² · WA + OR + CA";
    setStat("totalAreaPct", formatNumber(pct, 2), sub);
    setStatBar("totalAreaPct", pct);
}

function showAltitudeStat(m) {
    const note = statContext.variant === "everyone" ? " · server record" : "";
    setStat("highestAltitude", formatNumber(Math.round(m * FT_PER_M), 0), formatNumber(Math.round(m), 0) + " m" + note);
}

function showSpeedStat(kmh, flightThresholdKmh) {
    let note = "";
    if (flightThresholdKmh && kmh > flightThresholdKmh) {
        note = statContext.variant === "everyone" ? " · someone was flying" : " · on a flight";
    }
    setStat("highestVelocity", formatNumber(Math.round(kmh / KM_PER_MI), 0), formatNumber(Math.round(kmh), 0) + " km/h" + note);
}
