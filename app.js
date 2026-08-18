/* ==========================================================================
   אפליקציית מפת גירוש ורצח יהודים – לוגיקה ראשית
   ========================================================================== */

/* ------------------------- שמות מדינות בעברית ------------------------- */
const HE_NAMES = {
  EG: "מצרים", IQ: "עיראק", IT: "איטליה", ES: "ספרד", PT: "פורטוגל",
  FR: "צרפת", GB: "בריטניה", DE: "גרמניה", AT: "אוסטריה", HU: "הונגריה",
  LT: "ליטא", LV: "לטביה", PL: "פולין", UA: "אוקראינה", RU: "רוסיה",
  SA: "ערב הסעודית", YE: "תימן", MA: "מרוקו", DZ: "אלג'יריה", TN: "תוניסיה",
  LY: "לוב", SY: "סוריה", LB: "לבנון", JO: "ירדן", IR: "איראן",
  TR: "טורקיה", PS: "הרשות הפלסטינית / עזה", IL: "ישראל", CH: "שווייץ",
  BE: "בלגיה", RO: "רומניה", HR: "קרואטיה", US: "ארצות הברית",
  UG: "אוגנדה", ET: "אתיופיה", PK: "פקיסטן", GR: "יוון", CZ: "צ'כיה",
  SK: "סלובקיה", NL: "הולנד", SE: "שוודיה", NO: "נורווגיה", DK: "דנמרק",
  FI: "פינלנד", IE: "אירלנד", BY: "בלארוס", MD: "מולדובה", RS: "סרביה",
  BG: "בולגריה", AL: "אלבניה", MK: "מקדוניה", BA: "בוסניה", SI: "סלובניה",
  EE: "אסטוניה", GE: "גאורגיה", AM: "ארמניה", AZ: "אזרבייג'ן",
  KZ: "קזחסטן", UZ: "אוזבקיסטן", AF: "אפגניסטן", IN: "הודו", CN: "סין",
  JP: "יפן", KR: "דרום קוריאה", AU: "אוסטרליה", NZ: "ניו זילנד",
  CA: "קנדה", MX: "מקסיקו", BR: "ברזיל", AR: "ארגנטינה", CL: "צ'ילה",
  CO: "קולומביה", PE: "פרו", VE: "ונצואלה", UY: "אורוגוואי", CU: "קובה",
  ZA: "דרום אפריקה", NG: "ניגריה", KE: "קניה", SD: "סודן", SS: "דרום סודן",
  SO: "סומליה", ER: "אריתריאה", DJ: "ג'יבוטי", OM: "עומאן", AE: "איחוד האמירויות",
  QA: "קטר", KW: "כווית", BH: "בחריין", CY: "קפריסין", MT: "מלטה",
  PY: "פרגוואי", GT: "גואטמלה", KH: "קמבודיה", RW: "רואנדה",
  BI: "בורונדי", DO: "הרפובליקה הדומיניקנית",
  IS: "איסלנד", LU: "לוקסמבורג", MC: "מונקו", TH: "תאילנד", VN: "וייטנאם",
  ID: "אינדונזיה", MY: "מלזיה", PH: "הפיליפינים", MM: "מיאנמר", BD: "בנגלדש",
  LK: "סרי לנקה", NP: "נפאל", MN: "מונגוליה", TM: "טורקמניסטן", TJ: "טג'יקיסטן",
  KG: "קירגיזסטן"
};

/* ----------------------------- ניהול מצב ----------------------------- */
const LS_KEY = "jewish-history-map-v1";

let state = {
  lang: "he",             // "he" | "en"
  people: "jews",         // העם הנבחר ("מפת השנאה כלפי...")
  customEvents: [],       // אירועים שהוסיף המשתמש (עם שדה p = מזהה העם)
  customTypes: [],        // סוגי אירוע שהוסיף המשתמש
  removedIds: [],         // אירועים מובנים שהוסרו
  activeTypes: EVENT_TYPES.filter(t => !t.defaultOff).map(t => t.id),  // סוגים הנכללים בצביעה ובתצוגה
  includeUnverified: true,
  globe: false
};

/* ----------------------------- עמים ----------------------------- */
function peoples() {
  const jews = { id: "jews", name: "היהודים", events: BUILTIN_EVENTS };
  const civs = (typeof CIV_PEOPLES !== "undefined") ? CIV_PEOPLES : [];
  const world = (typeof WORLD_PEOPLES !== "undefined") ? WORLD_PEOPLES : [];
  const rest = civs.concat(world).sort((a, b) =>
    peopleName(a).localeCompare(peopleName(b), isHe() ? "he" : "en"));
  return [jews].concat(rest);
}
function currentPeople() {
  return peoples().find(p => p.id === state.people) || peoples()[0];
}
function setPeople(id) {
  state.people = id;
  saveState();
  closePanel();
  updatePeopleTitle();
  repaint();
}
function updatePeopleTitle() {
  const p = currentPeople();
  const el = document.getElementById("title-people");
  if (el) el.textContent = peopleName(p);
  document.title = `${t("titlePrefix")} – ${peopleName(p)}`;
  const sel = document.getElementById("people-select");
  if (sel && sel.value !== p.id) sel.value = p.id;
}
function populatePeopleSelect() {
  const sel = document.getElementById("people-select");
  sel.innerHTML = peoples().map(p =>
    `<option value="${p.id}">${peopleName(p)}${p.civ ? ` (${p.civ})` : ""}</option>`).join("");
  sel.value = state.people;
}

/* --------------------------- דירוג העמים --------------------------- */
/* מדד השנאה: כמה מדינות/עמים שונים ביצעו אירועי גירוש/רצח נגד העם
   (הצבעות או"ם וסוגים באחוזים אינם נספרים – רק אירועים פיזיים). */
function hateRanking() {
  return peoples().map(p => {
    const custom = state.customEvents.filter(e => (e.p || "jews") === p.id);
    const evs = p.events.filter(e => !state.removedIds.includes(e.id)).concat(custom)
      .filter(e => {
        const ty = typeById(e.t);
        return !(ty && ty.colorBy === "pct");
      });
    const perps = new Set(evs.map(e => e.c));
    const total = evs.reduce((s, e) => s + (e.n || 0), 0);
    return { id: p.id, name: peopleName(p), civ: p.civ, perps: perps.size, total };
  }).sort((a, b) => b.perps - a.perps || b.total - a.total);
}
function openRanking() {
  const rows = hateRanking().map((r, i) => {
    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : (i + 1);
    const cur = r.id === state.people ? " rank-current" : "";
    return `<tr class="rank-row${cur}" onclick="setPeople('${r.id}'); closeModal('modal-ranking')">
      <td class="rank-pos">${medal}</td>
      <td class="rank-name">${r.name}${r.civ ? ` <span class="rank-civ">(${r.civ})</span>` : ""}</td>
      <td class="rank-perps">${r.perps}</td>
      <td class="rank-total">${r.total.toLocaleString(loc())}</td>
    </tr>`;
  }).join("");
  document.getElementById("ranking-body").innerHTML = rows;
  document.getElementById("modal-ranking").classList.add("open");
}

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      state = Object.assign(state, saved);
    }
  } catch (e) { /* מצב פגום – מתעלמים */ }
}
function saveState() {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

/* --------------------------- עזרי נתונים --------------------------- */
function allTypes() {
  return EVENT_TYPES.concat(state.customTypes);
}
function typeById(id) {
  return allTypes().find(t => t.id === id);
}
function allEvents() {
  return currentPeople().events.filter(e => !state.removedIds.includes(e.id))
    .concat(state.customEvents.filter(e => (e.p || "jews") === state.people));
}
function visibleEvents() {
  return allEvents().filter(e =>
    state.activeTypes.includes(e.t) &&
    (state.includeUnverified || e.v)
  );
}
function eventsForCountry(iso) {
  return visibleEvents().filter(e => e.c === iso);
}
function countryTotals() {
  const totals = {};
  for (const e of visibleEvents()) {
    totals[e.c] = (totals[e.c] || 0) + (e.n || 0);
  }
  return totals;
}
/* ערכי הצביעה: סוגים עם colorBy:"pct" תורמים את האחוז ולא את המספר המוחלט */
function countryColorData() {
  const values = {};
  const has = new Set();
  for (const e of visibleEvents()) {
    const ty = typeById(e.t);
    const val = ty && ty.colorBy === "pct" ? (e.pct || 0) : (e.n || 0);
    values[e.c] = (values[e.c] || 0) + val;
    has.add(e.c);
  }
  return { values, has };
}
/* האם כל הסוגים הפעילים נצבעים לפי אחוז (מצב תצוגת אחוזים) */
function pctModeActive() {
  const act = state.activeTypes.filter(id => typeById(id));
  return act.length > 0 && act.every(id => typeById(id).colorBy === "pct");
}
function heName(iso, fallback) {
  return countryName(iso, fallback);
}
function countryName(iso, fallback) {
  if (isHe()) return HE_NAMES[iso] || fallback || iso;
  return EN_NAMES[iso] || fallback || iso;
}
function peopleName(p) {
  if (!p) return "";
  if (isHe()) return p.name;
  return PEOPLE_EN[p.id] || p.name;
}
function typeLabel(ty) {
  if (!ty) return "";
  if (isHe()) return ty.label;
  return ty.labelEn || ty.label;
}
function typeUnit(ty) {
  if (!ty) return t("estimate");
  if (isHe()) return ty.unit || t("estimate");
  return ty.unitEn || ty.unit || t("estimate");
}
function eventName(e) {
  if (e.t === "unvotes") return t("unvotesName");
  if (isHe() || (e.id && String(e.id).startsWith("u-"))) return e.name;
  const tr = (typeof EVENT_EN !== "undefined") && EVENT_EN[e.id];
  return (tr && tr.name) || e.name;
}
function eventNote(e) {
  if (e.t === "unvotes") {
    const extraMap = t("unExtra") || {};
    const extra = extraMap[e.c] || "";
    const m = e.pct ? Math.round(e.n * 100 / e.pct) : e.n;
    return tf("unvotesNote", { n: fmt(e.n), m: fmt(m), pct: e.pct, extra });
  }
  if (isHe() || (e.id && String(e.id).startsWith("u-"))) return e.note || "";
  const tr = (typeof EVENT_EN !== "undefined") && EVENT_EN[e.id];
  return (tr && tr.note) || e.note || "";
}
function eventSrc(e) {
  if (e.t === "unvotes") return t("unvotesSrc");
  if (e.src === "הוסף ידנית" || e.src === "Added manually") return t("customSrc");
  if (isHe() || (e.id && String(e.id).startsWith("u-"))) return e.src || "";
  const tr = (typeof EVENT_EN !== "undefined") && EVENT_EN[e.id];
  return (tr && tr.src) || e.src || "";
}
function eventYears(e) {
  const y = String(e.years || "");
  if (isHe()) return y;
  return y
    .replace(/לפנה"?ס/g, "BCE")
    .replace(/לספירה/g, "CE")
    .replace(/לערך/g, "c.")
    .replace(/המאה ה-(\d+)/g, "$1th century")
    .replace(/מאות (\d+)–(\d+)/g, "centuries $1–$2");
}
function fmt(n) {
  return (n || 0).toLocaleString(loc());
}

function setLang(lang) {
  state.lang = lang === "en" ? "en" : "he";
  saveState();
  applyI18n();
  populateCountrySelect();
  populateTypeSelect();
  populatePeopleSelect();
  updatePeopleTitle();
  if (currentPanelIso) renderCountryPanel(currentPanelIso);
  const rank = document.getElementById("modal-ranking");
  if (rank && rank.classList.contains("open")) openRanking();
  repaint();
}
function applyI18n() {
  const he = isHe();
  document.documentElement.lang = he ? "he" : "en";
  document.documentElement.dir = he ? "rtl" : "ltr";
  document.querySelectorAll("[data-i18n]").forEach(el => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    el.placeholder = t(el.getAttribute("data-i18n-placeholder"));
  });
  const bHe = document.getElementById("btn-lang-he");
  const bEn = document.getElementById("btn-lang-en");
  if (bHe) bHe.classList.toggle("active", he);
  if (bEn) bEn.classList.toggle("active", !he);
}

/* ----------------------------- סולם צבע ----------------------------- */
/* לבן (מעט) ← אדום כהה (הרבה), בסולם לוגריתמי */
const NO_DATA_COLOR = 0xcdd6dd;
const SCALE_FROM = [255, 245, 240];
const SCALE_TO   = [80, 0, 8];

function colorForValue(v, maxV, hasData) {
  // מדינה בלי אירועים = אפור; מדינה עם אירועים בערך 0 (למשל ישראל: 0 הצבעות) = לבן
  if (!v && !hasData) return NO_DATA_COLOR;
  if (!v) v = 0;
  // בערכים קטנים (אחוזים / ספירת הצבעות) סולם ליניארי מבחין טוב יותר;
  // בערכים גדולים (נפגעים – עד מיליונים) נדרש סולם לוגריתמי
  const t = maxV <= 5000
    ? Math.min(1, v / maxV)
    : Math.min(1, Math.log10(v + 1) / Math.log10(maxV + 1));
  const r = Math.round(SCALE_FROM[0] + (SCALE_TO[0] - SCALE_FROM[0]) * t);
  const g = Math.round(SCALE_FROM[1] + (SCALE_TO[1] - SCALE_FROM[1]) * t);
  const b = Math.round(SCALE_FROM[2] + (SCALE_TO[2] - SCALE_FROM[2]) * t);
  return (r << 16) | (g << 8) | b;
}

/* ----------------------------- בניית מפה ----------------------------- */
let root, chart, polygonSeries, bgSeries, exporting;

function buildMap() {
  root = am5.Root.new("chartdiv");
  root.setThemes([am5themes_Animated.new(root)]);

  chart = root.container.children.push(am5map.MapChart.new(root, {
    panX: "rotateX",
    panY: "translateY",
    wheelY: "zoom",
    projection: am5map.geoNaturalEarth1(),
    maxZoomLevel: 32
  }));

  // רקע (ים) – חיוני לתצוגת גלובוס
  bgSeries = chart.series.push(am5map.MapPolygonSeries.new(root, {}));
  bgSeries.mapPolygons.template.setAll({
    fill: am5.color(0x0e2233),
    fillOpacity: 1,
    strokeOpacity: 0
  });
  bgSeries.data.push({ geometry: am5map.getGeoRectangle(90, 180, -90, -180) });

  polygonSeries = chart.series.push(am5map.MapPolygonSeries.new(root, {
    geoJSON: am5geodata_worldLow,
    exclude: ["AQ"]
  }));

  // הערה: בלי keepTargetHover – אחרת חלונית הריחוף חוסמת את הלחיצה על המדינה
  const tooltip = am5.Tooltip.new(root, {
    getFillFromSprite: false,
    maxWidth: 420
  });
  tooltip.get("background").setAll({
    fill: am5.color(0x101820), fillOpacity: 0.96,
    stroke: am5.color(0x8a6d3b), strokeOpacity: 0.8
  });
  polygonSeries.set("tooltip", tooltip);

  polygonSeries.mapPolygons.template.setAll({
    interactive: true,
    stroke: am5.color(0x51606d),
    strokeWidth: 0.5,
    tooltipHTML: "{name}"
  });

  polygonSeries.mapPolygons.template.adapters.add("tooltipHTML", (html, target) => {
    const dc = target.dataItem && target.dataItem.dataContext;
    if (!dc) return html;
    return buildTooltipHTML(dc.id, dc.name);
  });

  polygonSeries.mapPolygons.template.states.create("hover", {
    strokeWidth: 1.6,
    stroke: am5.color(0xf0c869)
  });

  polygonSeries.mapPolygons.template.events.on("click", ev => {
    const dc = ev.target.dataItem && ev.target.dataItem.dataContext;
    if (dc) openCountryPanel(dc.id, dc.name);
  });

  polygonSeries.events.on("datavalidated", repaint);

  // זום
  const zoomControl = chart.set("zoomControl", am5map.ZoomControl.new(root, {}));
  zoomControl.homeButton.set("visible", true);

  exporting = am5plugins_exporting.Exporting.new(root, {
    filePrefix: "hate-globe",
    pngOptions: { quality: 1, maintainPixelRatio: true }
  });

  chart.appear(800, 100);
}

function setGlobeView(globe, skipHome) {
  state.globe = globe; saveState();
  if (globe) {
    chart.set("projection", am5map.geoOrthographic());
    chart.set("panY", "rotateY");
  } else {
    chart.set("projection", am5map.geoNaturalEarth1());
    chart.set("panY", "translateY");
    chart.set("rotationY", 0);
  }
  // goHome לפני שהמפה סיימה להיטען שובר את הזום (NaN) והמפה נעלמת
  if (!skipHome && polygonSeries.inited) {
    chart.goHome();
  }
  document.getElementById("btn-flat").classList.toggle("active", !globe);
  document.getElementById("btn-globe").classList.toggle("active", globe);
}

/* --------------------------- צביעה מחדש --------------------------- */
function repaint() {
  const { values, has } = countryColorData();
  let maxV = 0;
  for (const k in values) maxV = Math.max(maxV, values[k]);
  if (maxV === 0) maxV = 1;

  polygonSeries.mapPolygons.each(polygon => {
    const dc = polygon.dataItem && polygon.dataItem.dataContext;
    if (!dc) return;
    polygon.set("fill", am5.color(colorForValue(values[dc.id] || 0, maxV, has.has(dc.id))));
  });

  updateLegend(maxV);
  renderTypeChips();
}

/* ------------------------------ מקרא ------------------------------ */
function updateLegend(maxV) {
  const pct = pctModeActive();
  const suffix = pct ? "%" : "";
  const mid = maxV <= 5000
    ? Math.round(maxV / 2)
    : Math.round(Math.pow(10, Math.log10(maxV + 1) / 2));
  document.getElementById("legend-min").textContent = "0" + suffix;
  document.getElementById("legend-max").textContent = fmt(Math.round(maxV)) + suffix;
  document.getElementById("legend-mid").textContent = "~" + fmt(mid) + suffix;
  document.querySelector("#legend .lg-title").textContent = pct
    ? t("legendPct")
    : (maxV <= 5000 ? t("legendLin") : t("legendLog"));
}

/* ---------------------------- Tooltip ---------------------------- */
function verifiedBadge(e) {
  return e.v
    ? `<span class="badge ok">${t("verified")}</span>`
    : `<span class="badge warn">${t("traditional")}</span>`;
}

function buildTooltipHTML(iso, engName) {
  const name = countryName(iso, engName);
  const evs = eventsForCountry(iso).slice().sort((a, b) => (b.n || 0) - (a.n || 0));
  let html = `<div class="tt" dir="${isHe() ? "rtl" : "ltr"}">`;
  html += `<div class="tt-title">${name}</div>`;
  if (!evs.length) {
    html += `<div class="tt-none">${t("noEvents")}</div></div>`;
    return html;
  }
  // סיכומים לפי סוג
  const sums = {};
  evs.forEach(e => { sums[e.t] = (sums[e.t] || 0) + (e.n || 0); });
  html += '<div class="tt-sums">';
  for (const tid in sums) {
    const ty = typeById(tid);
    if (!ty) continue;
    html += `<span class="tt-sum"><i style="background:${ty.color}"></i>${typeLabel(ty)}: <b>${fmt(sums[tid])}</b></span>`;
  }
  html += '</div><div class="tt-events">';
  const MAX_SHOW = 7;
  evs.slice(0, MAX_SHOW).forEach(e => {
    const ty = typeById(e.t);
    const pctStr = e.pct != null ? ` (${e.pct}%)` : "";
    html += `<div class="tt-ev">
      <i style="background:${ty ? ty.color : "#999"}"></i>
      <span class="tt-years">${eventYears(e)}</span>
      <span class="tt-name">${eventName(e)}</span>
      <span class="tt-n">${fmt(e.n)}${pctStr}${e.v ? "" : " ❔"}</span>
    </div>`;
  });
  if (evs.length > MAX_SHOW) {
    html += `<div class="tt-more">${tf("moreEvents", { n: evs.length - MAX_SHOW })}</div>`;
  } else {
    html += `<div class="tt-more">${t("clickDetail")}</div>`;
  }
  html += "</div></div>";
  return html;
}

/* ------------------------- פאנל פרטי מדינה ------------------------- */
let currentPanelIso = null;

function openCountryPanel(iso, engName) {
  currentPanelIso = iso;
  const panel = document.getElementById("side-panel");
  panel.classList.add("open");
  renderCountryPanel(iso, engName);
}

function renderCountryPanel(iso, engName) {
  const name = countryName(iso, engName);
  const evs = eventsForCountry(iso).slice()
    .sort((a, b) => (b.n || 0) - (a.n || 0));
  const totals = {};
  evs.forEach(e => { totals[e.t] = (totals[e.t] || 0) + (e.n || 0); });

  let html = `<div class="panel-head">
      <h2>${name}</h2>
      <button class="icon-btn" onclick="closePanel()" title="${t("closeTitle")}">✕</button>
    </div>`;

  html += '<div class="panel-sums">';
  if (!Object.keys(totals).length) {
    html += `<span class="muted">${t("noEvents")}</span>`;
  }
  for (const tid in totals) {
    const ty = typeById(tid);
    if (!ty) continue;
    html += `<div class="panel-sum"><i style="background:${ty.color}"></i>
      ${t("totalOf")} ${typeLabel(ty)}: <b>${fmt(totals[tid])}</b></div>`;
  }
  html += "</div>";

  html += `<button class="btn small gold" onclick="openAddModal('${iso}')">${t("addToCountry")}</button>`;

  html += '<div class="panel-events">';
  evs.forEach(e => {
    const ty = typeById(e.t);
    const custom = e.id.startsWith("u-");
    const unitLabel = typeUnit(ty);
    html += `<div class="panel-ev">
      <div class="pe-top">
        <span class="pe-type" style="background:${ty ? ty.color : "#999"}">${ty ? typeLabel(ty) : e.t}</span>
        <span class="pe-years">${eventYears(e)}</span>
        <button class="icon-btn danger" title="${t("removeTitle")}" onclick="removeEvent('${e.id}')">🗑</button>
      </div>
      <div class="pe-name">${eventName(e)}</div>
      <div class="pe-n">${unitLabel}: <b>${fmt(e.n)}</b>${e.pct != null ? ` <b>(${e.pct}%)</b>` : ""} ${verifiedBadge(e)} ${custom ? `<span class="badge custom">${t("custom")}</span>` : ""}</div>
      ${eventNote(e) ? `<div class="pe-note">${eventNote(e)}</div>` : ""}
      ${eventSrc(e) ? `<div class="pe-src">${t("source")} ${eventSrc(e)}</div>` : ""}
    </div>`;
  });
  html += "</div>";

  document.getElementById("side-panel-content").innerHTML = html;
}

function closePanel() {
  document.getElementById("side-panel").classList.remove("open");
  currentPanelIso = null;
}

function removeEvent(id) {
  if (!confirm(t("confirmRemove"))) return;
  if (id.startsWith("u-")) {
    state.customEvents = state.customEvents.filter(e => e.id !== id);
  } else if (!state.removedIds.includes(id)) {
    state.removedIds.push(id);
  }
  saveState(); repaint();
  if (currentPanelIso) renderCountryPanel(currentPanelIso);
}

function restoreRemoved() {
  if (!state.removedIds.length) { alert(t("noRemoved")); return; }
  if (!confirm(tf("confirmRestore", { n: state.removedIds.length }))) return;
  state.removedIds = [];
  saveState(); repaint();
  if (currentPanelIso) renderCountryPanel(currentPanelIso);
}

/* --------------------------- סוגי אירועים --------------------------- */
function renderTypeChips() {
  const box = document.getElementById("type-chips");
  // סוג מובנה שאינו גירוש/רצח (למשל הצבעות או"ם) מוצג רק אם יש לו נתונים לעם הנבחר
  const present = new Set(currentPeople().events.map(e => e.t));
  const shown = allTypes().filter(ty =>
    !ty.builtin || ["expulsion", "murder"].includes(ty.id) || present.has(ty.id));
  let html = "";
  shown.forEach(ty => {
    const on = state.activeTypes.includes(ty.id);
    html += `<label class="chip ${on ? "on" : ""}" style="--c:${ty.color}">
      <input type="checkbox" ${on ? "checked" : ""} onchange="toggleType('${ty.id}')">
      <i></i>${typeLabel(ty)}
      ${ty.builtin ? "" : `<button class="chip-x" title="${t("deleteTypeTitle")}" onclick="event.preventDefault();deleteType('${ty.id}')">✕</button>`}
    </label>`;
  });
  box.innerHTML = html;
}

function toggleType(id) {
  if (state.activeTypes.includes(id)) {
    state.activeTypes = state.activeTypes.filter(t => t !== id);
  } else {
    state.activeTypes.push(id);
  }
  saveState(); repaint();
  if (currentPanelIso) renderCountryPanel(currentPanelIso);
}

const TYPE_PALETTE = ["#8e44ad", "#2980b9", "#16a085", "#d4ac0d", "#7f8c8d", "#e84393"];

function addType() {
  const name = document.getElementById("new-type-name").value.trim();
  if (!name) { alert(t("needTypeName")); return; }
  const id = "ct-" + Date.now();
  const color = TYPE_PALETTE[state.customTypes.length % TYPE_PALETTE.length];
  state.customTypes.push({ id, label: name, color, builtin: false });
  state.activeTypes.push(id);
  document.getElementById("new-type-name").value = "";
  saveState(); repaint(); populateTypeSelect();
}

function deleteType(id) {
  const ty = typeById(id);
  if (!ty || ty.builtin) return;
  const count = state.customEvents.filter(e => e.t === id).length;
  if (!confirm(tf("confirmDeleteType", { name: typeLabel(ty) }) + (count ? tf("deleteTypeEvents", { n: count }) : ""))) return;
  state.customTypes = state.customTypes.filter(t => t.id !== id);
  state.activeTypes = state.activeTypes.filter(t => t !== id);
  state.customEvents = state.customEvents.filter(e => e.t !== id);
  saveState(); repaint(); populateTypeSelect();
  if (currentPanelIso) renderCountryPanel(currentPanelIso);
}

/* --------------------------- הוספת אירוע --------------------------- */
function populateCountrySelect() {
  const sel = document.getElementById("ev-country");
  const items = am5geodata_worldLow.features
    .map(f => ({ id: f.id, name: countryName(f.id, f.properties.name) }))
    .filter(x => x.id && x.id !== "AQ")
    .sort((a, b) => a.name.localeCompare(b.name, isHe() ? "he" : "en"));
  sel.innerHTML = items.map(x => `<option value="${x.id}">${x.name}</option>`).join("");
}

function populateTypeSelect() {
  const sel = document.getElementById("ev-type");
  sel.innerHTML = allTypes().map(ty => `<option value="${ty.id}">${typeLabel(ty)}</option>`).join("");
}

function openAddModal(iso) {
  populateTypeSelect();
  if (iso) document.getElementById("ev-country").value = iso;
  document.getElementById("modal-add").classList.add("open");
}

function submitEvent() {
  const c = document.getElementById("ev-country").value;
  const t = document.getElementById("ev-type").value;
  const name = document.getElementById("ev-name").value.trim();
  const years = document.getElementById("ev-years").value.trim();
  const n = parseInt(document.getElementById("ev-count").value, 10);
  const v = document.getElementById("ev-verified").checked;
  const note = document.getElementById("ev-note").value.trim();
  if (!name || !years || isNaN(n) || n < 0) {
    alert(t("fillFields"));
    return;
  }
  state.customEvents.push({
    id: "u-" + Date.now(), c, t, name, years, n, v, note,
    p: state.people,
    src: t("customSrc")
  });
  saveState(); repaint();
  closeModal("modal-add");
  ["ev-name", "ev-years", "ev-count", "ev-note"].forEach(id => document.getElementById(id).value = "");
  if (currentPanelIso === c) renderCountryPanel(c);
}

function closeModal(id) {
  document.getElementById(id).classList.remove("open");
}

/* --------------------------- ייצוא וייבוא --------------------------- */
function downloadPNG() {
  exporting.download("png");
}

function downloadJSON() {
  const payload = {
    exported: new Date().toISOString(),
    types: allTypes(),
    events: allEvents(),
    state: state
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `hate-map-${state.people}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function importJSON(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (data.state) {
        state = Object.assign(state, data.state);
        saveState(); repaint(); populateTypeSelect();
        alert(t("importOk"));
      } else {
        alert(t("importBad"));
      }
    } catch (e) {
      alert(t("importErr"));
    }
  };
  reader.readAsText(file);
  input.value = "";
}

function resetAll() {
  if (!confirm(t("confirmReset"))) return;
  localStorage.removeItem(LS_KEY);
  location.reload();
}

/* ------------------------------ אתחול ------------------------------ */
window.addEventListener("DOMContentLoaded", () => {
  loadState();
  if (state.lang !== "en") state.lang = "he";
  // ודא שסוגים פעילים קיימים
  state.activeTypes = state.activeTypes.filter(id => typeById(id));
  if (!state.activeTypes.length) state.activeTypes = EVENT_TYPES.map(ty => ty.id);

  applyI18n();
  buildMap();
  populatePeopleSelect();
  updatePeopleTitle();
  renderTypeChips();
  populateCountrySelect();
  populateTypeSelect();
  setGlobeView(!!state.globe, true);

  document.getElementById("chk-unverified").checked = state.includeUnverified;
  document.getElementById("chk-unverified").addEventListener("change", e => {
    state.includeUnverified = e.target.checked;
    saveState(); repaint();
    if (currentPanelIso) renderCountryPanel(currentPanelIso);
  });
});
