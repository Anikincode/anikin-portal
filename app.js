/* Anikin Technologies — SEO Progress Portal
   Vanilla JS, hash routing, static JSON data. No build step, no dependencies.
   Routes:
     #/                -> staff dashboard (all clients)
     #/<client-slug>   -> single client board
*/

const app = document.getElementById("app");

// ---- helpers ----------------------------------------------------------

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---- auth (per-client password gate) ---------------------------------
// Passwords are stored as SHA-256 hashes (never plain text). A client's board
// stays hidden until they enter the matching password. Unlocks are remembered
// in localStorage so they don't re-enter it every visit.

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function unlockKey(scope) { return "anikin_portal_unlock_" + scope; }

// A scope (client slug or "staff") is unlocked if we stored its hash and it
// still matches the expected hash (so rotating a password re-locks it).
function isUnlocked(scope, expectedHash) {
  if (!expectedHash) return true; // no password set on this board = open
  return localStorage.getItem(unlockKey(scope)) === expectedHash;
}

function setUnlocked(scope, hash) {
  try { localStorage.setItem(unlockKey(scope), hash); } catch (e) {}
}

// Renders a password prompt. onSuccess() runs when the right password is typed.
function renderGate(scope, label, expectedHash, onSuccess) {
  app.innerHTML = `
    <div class="gate">
      <div class="gate-card">
        <div class="gate-mark">A</div>
        <h1 class="gate-title">${esc(label)}</h1>
        <p class="gate-sub">Enter your access password to view this progress board.</p>
        <form id="gate-form">
          <input type="password" id="gate-pw" placeholder="Password" autocomplete="current-password" autofocus />
          <button type="submit">Unlock</button>
          <div class="gate-error" id="gate-error"></div>
        </form>
        <p class="gate-help">Lost your password? Contact Anikin Technologies.</p>
      </div>
    </div>`;
  document.getElementById("gate-form").addEventListener("submit", async e => {
    e.preventDefault();
    const pw = document.getElementById("gate-pw").value;
    const err = document.getElementById("gate-error");
    err.textContent = "";
    const h = await sha256(pw);
    if (h === expectedHash) {
      setUnlocked(scope, h);
      onSuccess();
    } else {
      err.textContent = "Incorrect password. Please try again.";
      document.getElementById("gate-pw").value = "";
      document.getElementById("gate-pw").focus();
    }
  });
}

async function loadJSON(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error("Not found: " + path);
  return res.json();
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

function progressOf(client) {
  const tasks = client.tasks || [];
  if (!tasks.length) return 0;
  const done = tasks.filter(t => t.status === "done").length;
  return Math.round((done / tasks.length) * 100);
}

// Hours delivered = sum of hours on tasks marked "done".
function hoursDelivered(client) {
  return (client.tasks || [])
    .filter(t => t.status === "done")
    .reduce((sum, t) => sum + (Number(t.hours) || 0), 0);
}

function fmtHours(n) {
  if (!n) return "0";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

// Days between two ISO dates (whole days, min 0).
function daysBetween(startISO, endISO) {
  if (!startISO || !endISO) return null;
  const a = new Date(startISO + "T00:00:00");
  const b = new Date(endISO + "T00:00:00");
  if (isNaN(a) || isNaN(b)) return null;
  return Math.max(0, Math.round((b - a) / 86400000));
}

function fmtTurnaround(days) {
  if (days == null) return "";
  if (days === 0) return "same day";
  if (days === 1) return "1 day";
  return days + " days";
}

const STATUS_LABEL = {
  done: "Done",
  "in-progress": "In Progress",
  upcoming: "Up Next"
};

// ---- staff dashboard --------------------------------------------------

async function renderDashboard() {
  app.innerHTML = `<div class="loading">Loading clients…</div>`;
  let index;
  try {
    index = await loadJSON("data/clients.json");
  } catch (e) {
    app.innerHTML = `<div class="notice">Could not load client list.</div>`;
    return;
  }

  // Staff dashboard is gated by a master password (staffPasswordHash in
  // clients.json). Until unlocked, the client list is never rendered — so a
  // client can't reach the roster of other clients.
  if (index.staffPasswordHash && !isUnlocked("staff", index.staffPasswordHash)) {
    renderGate("staff", "Staff Dashboard", index.staffPasswordHash, renderDashboard);
    return;
  }

  // Load each client's data to compute progress
  const cards = await Promise.all((index.clients || []).map(async c => {
    try {
      const full = await loadJSON(`data/clients/${c.slug}.json`);
      const pct = progressOf(full);
      const done = (full.tasks || []).filter(t => t.status === "done").length;
      const total = (full.tasks || []).length;
      const hrs = hoursDelivered(full);
      return `
        <a class="dash-card" href="#/${esc(c.slug)}">
          <h3>${esc(c.name)}</h3>
          <div class="dash-meta">${esc(c.industry || "")}${c.location ? " · " + esc(c.location) : ""}</div>
          <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
          <div class="dash-pct">${pct}% complete · ${done}/${total} tasks · ${fmtHours(hrs)}h delivered</div>
        </a>`;
    } catch (e) {
      return `
        <a class="dash-card" href="#/${esc(c.slug)}">
          <h3>${esc(c.name)}</h3>
          <div class="dash-meta">Data file missing</div>
        </a>`;
    }
  }));

  app.innerHTML = `
    <h1 style="margin:0 0 4px;font-size:24px;">Client Portfolio</h1>
    <p class="intro">Staff overview of all active SEO engagements. Click a client to open their board.</p>
    <div class="dash-grid">${cards.join("")}</div>
  `;
}

// ---- client board -----------------------------------------------------

function renderTimeline(phases) {
  if (!phases || !phases.length) return "";
  const chips = phases.map(p => `
    <div class="phase-chip">
      <div class="phase-name">${esc(p.name)}</div>
      <div class="phase-time">${esc(p.timeframe || "")}</div>
      <span class="phase-status st-${esc(p.status)}">${esc(STATUS_LABEL[p.status] || p.status)}</span>
    </div>`).join("");
  return `<div class="section-title">Roadmap</div><div class="timeline">${chips}</div>`;
}

function renderColumn(title, dotClass, tasks, emptyText) {
  const cards = tasks.map(t => `
    <div class="card">
      <div class="card-top">
        <div class="card-title">${esc(t.title)}</div>
        ${t.hours ? `<span class="card-hours">${esc(fmtHours(Number(t.hours)))}h</span>` : ""}
      </div>
      ${t.detail ? `<div class="card-detail">${esc(t.detail)}</div>` : ""}
      ${t.status === "done" && t.completedDate
        ? `<div class="card-date">✓ Completed ${esc(fmtDate(t.completedDate))}</div>` : ""}
    </div>`).join("");
  return `
    <div class="col">
      <div class="col-head"><span class="dot ${dotClass}"></span>${esc(title)}
        <span class="col-count">${tasks.length}</span></div>
      ${cards || `<div class="col-empty">${esc(emptyText)}</div>`}
    </div>`;
}

function renderBoard(tasks) {
  const done = tasks.filter(t => t.status === "done");
  const prog = tasks.filter(t => t.status === "in-progress");
  const next = tasks.filter(t => t.status === "upcoming");
  return `
    <div class="section-title">Task Board</div>
    <div class="board">
      ${renderColumn("Done", "dot-done", done, "Nothing completed yet.")}
      ${renderColumn("In Progress", "dot-progress", prog, "Nothing in progress right now.")}
      ${renderColumn("Up Next", "dot-next", next, "No upcoming tasks queued.")}
    </div>`;
}

function renderKeywords(keywords) {
  if (!keywords || !keywords.length) return "";
  const rows = keywords.map(k => {
    let move = "", cls = "kw-flat";
    if (typeof k.previous === "number" && typeof k.current === "number") {
      const delta = k.previous - k.current; // positive = moved up (lower number is better)
      if (delta > 0) { move = `▲ ${delta}`; cls = "kw-up"; }
      else if (delta < 0) { move = `▼ ${Math.abs(delta)}`; cls = "kw-down"; }
      else { move = "—"; cls = "kw-flat"; }
    }
    return `
      <tr>
        <td>${esc(k.term)}</td>
        <td class="kw-pos">${k.current != null ? "#" + esc(k.current) : "—"}</td>
        <td class="kw-move ${cls}">${move}</td>
        <td>${k.target != null ? "#" + esc(k.target) : "—"}</td>
      </tr>`;
  }).join("");
  return `
    <div class="section-title">Keyword Rankings</div>
    <table class="kw-table">
      <thead><tr><th>Keyword</th><th>Current</th><th>Change</th><th>Goal</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function renderUpdates(updates) {
  if (!updates || !updates.length) return "";
  const items = updates.map(u => `
    <div class="update">
      <div class="update-date">${esc(fmtDate(u.date))}</div>
      <div class="update-note">${esc(u.note)}</div>
    </div>`).join("");
  return `<div class="section-title">Recent Updates</div><div>${items}</div>`;
}

// ---- requests (Firebase-backed) --------------------------------------

const REQ_STATUS_LABEL = {
  new: "New",
  "in-progress": "In Progress",
  done: "Done"
};

// Renders the requests block. `requests` = array (or null = still loading).
function renderRequests(requests, slug) {
  const formEnabled = firebaseReady();

  let listHTML;
  if (requests === null) {
    listHTML = `<div class="col-empty">Loading requests…</div>`;
  } else if (!requests.length) {
    listHTML = `<div class="col-empty">No requests yet. Use the form below to send us one.</div>`;
  } else {
    listHTML = requests.map(r => {
      const status = r.status || "new";
      // Turnaround: prefer completed - requested; else show "open for N days".
      let meta = "";
      if (status === "done" && r.requestedDate && r.completedDate) {
        const d = daysBetween(r.requestedDate, r.completedDate);
        meta = `<span class="req-turn req-turn-done">Completed in ${esc(fmtTurnaround(d))}</span>`;
      } else if (r.requestedDate) {
        const d = daysBetween(r.requestedDate, todayISO());
        meta = `<span class="req-turn">Open ${esc(fmtTurnaround(d))}</span>`;
      }
      return `
        <div class="req-card">
          <div class="req-top">
            <div class="req-title">${esc(r.title)}</div>
            <span class="req-status rs-${esc(status)}">${esc(REQ_STATUS_LABEL[status] || status)}</span>
          </div>
          ${r.detail ? `<div class="req-detail">${esc(r.detail)}</div>` : ""}
          <div class="req-meta">
            <span>Requested ${esc(fmtDate(r.requestedDate))}</span>
            ${r.completedDate ? `<span>Completed ${esc(fmtDate(r.completedDate))}</span>` : ""}
            ${meta}
          </div>
        </div>`;
    }).join("");
  }

  const form = formEnabled ? `
    <form class="req-form" onsubmit="submitRequest(event, '${esc(slug)}')">
      <div class="req-form-title">Send us a request</div>
      <input type="text" id="req-title" name="title" placeholder="What do you need? (e.g. Add a new service page)" required maxlength="120" />
      <textarea id="req-detail" name="detail" placeholder="Any details (optional)" maxlength="1000" rows="3"></textarea>
      <button type="submit" id="req-submit">Submit request</button>
      <div class="req-form-note" id="req-form-note"></div>
    </form>` : `
    <div class="req-disabled-note">
      Request submissions aren't set up yet. Add your Firebase config in <code>firebase-config.js</code> to enable the form.
    </div>`;

  return `
    <div class="section-title">Your Requests</div>
    <div class="req-list">${listHTML}</div>
    ${form}`;
}

function todayISO() {
  const d = new Date();
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ---- Firebase glue ----------------------------------------------------
// Config lives in firebase-config.js (window.FIREBASE_CONFIG).
// If not configured, the requests form is disabled but everything else works.

let _db = null;

function firebaseReady() {
  return !!(window.firebase && window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.projectId
    && window.FIREBASE_CONFIG.projectId !== "YOUR_PROJECT_ID");
}

function getDB() {
  if (_db) return _db;
  if (!firebaseReady()) return null;
  if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
  _db = firebase.firestore();
  return _db;
}

async function loadRequests(slug) {
  const section = document.getElementById("requests-section");
  if (!section) return;
  const db = getDB();
  if (!db) {
    // Firebase not configured — show empty state with disabled form.
    section.innerHTML = renderRequests([], slug);
    return;
  }
  try {
    const snap = await db.collection("requests")
      .where("clientSlug", "==", slug)
      .orderBy("requestedDate", "desc")
      .get();
    const requests = snap.docs.map(d => d.data());
    section.innerHTML = renderRequests(requests, slug);
  } catch (e) {
    // Missing index or rules issue — degrade gracefully.
    section.innerHTML = renderRequests([], slug);
    console.warn("Could not load requests:", e);
  }
}

async function submitRequest(event, slug) {
  event.preventDefault();
  const titleEl = document.getElementById("req-title");
  const detailEl = document.getElementById("req-detail");
  const btn = document.getElementById("req-submit");
  const note = document.getElementById("req-form-note");
  const title = (titleEl.value || "").trim();
  if (!title) return;

  const db = getDB();
  if (!db) {
    note.textContent = "Request form isn't connected yet.";
    return;
  }

  btn.disabled = true;
  note.textContent = "Sending…";
  try {
    await db.collection("requests").add({
      clientSlug: slug,
      title: title,
      detail: (detailEl.value || "").trim(),
      status: "new",
      requestedDate: todayISO(),
      completedDate: null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    titleEl.value = "";
    detailEl.value = "";
    note.textContent = "✓ Request sent. We'll get on it.";
    await loadRequests(slug);
  } catch (e) {
    note.textContent = "Something went wrong — please email us instead.";
    console.error(e);
  } finally {
    btn.disabled = false;
  }
}

async function renderClient(slug) {
  app.innerHTML = `<div class="loading">Loading…</div>`;
  let c;
  try {
    c = await loadJSON(`data/clients/${slug}.json`);
  } catch (e) {
    app.innerHTML = `
      <div class="notice">
        <p>We couldn't find a progress board at this link.</p>
        <p>Please double-check the link, or contact Anikin Technologies.</p>
      </div>`;
    return;
  }

  // Password gate: if this board has a passwordHash and the visitor hasn't
  // unlocked it, show the login prompt instead of the board.
  if (c.passwordHash && !isUnlocked(slug, c.passwordHash)) {
    renderGate(slug, c.name, c.passwordHash, () => renderBoardFor(c, slug));
    return;
  }
  renderBoardFor(c, slug);
}

function renderBoardFor(c, slug) {
  const pct = progressOf(c);
  const total = (c.tasks || []).length;
  const done = (c.tasks || []).filter(t => t.status === "done").length;
  const hrs = hoursDelivered(c);

  app.innerHTML = `
    <div class="client-head">
      <div>
        <h1>${esc(c.name)}</h1>
        <div class="client-meta">
          ${c.industry ? `<span>${esc(c.industry)}</span>` : ""}
          ${c.location ? `<span>${esc(c.location)}</span>` : ""}
          ${c.website ? `<span><a href="${esc(c.website)}" target="_blank" rel="noopener">Visit site</a></span>` : ""}
        </div>
        ${c.planName ? `<div class="client-meta" style="margin-top:6px;"><strong style="color:var(--text)">${esc(c.planName)}</strong></div>` : ""}
        ${c.summary ? `<p class="client-summary">${esc(c.summary)}</p>` : ""}
      </div>
      <div class="stat-group">
        <div class="progress-wrap">
          <div class="progress-num">${pct}%</div>
          <div class="progress-label">${done} of ${total} tasks complete</div>
          <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
        </div>
        <div class="stat-tile">
          <div class="stat-num">${fmtHours(hrs)}<span class="stat-unit">hrs</span></div>
          <div class="stat-tile-label">delivered</div>
        </div>
      </div>
    </div>
    ${renderTimeline(c.phases)}
    ${renderBoard(c.tasks || [])}
    ${renderKeywords(c.keywords)}
    <div id="requests-section">${renderRequests(null, c.slug)}</div>
    ${renderUpdates(c.updates)}
  `;

  // Load requests from Firebase (if configured) after paint.
  loadRequests(c.slug);
}

// ---- router -----------------------------------------------------------

function route() {
  const hash = location.hash.replace(/^#\/?/, "").trim();
  window.scrollTo(0, 0);
  if (!hash) {
    renderDashboard();
  } else {
    renderClient(hash.replace(/[^a-z0-9\-]/gi, ""));
  }
}

window.addEventListener("hashchange", route);
window.addEventListener("DOMContentLoaded", route);
route();
