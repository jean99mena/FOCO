const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const KEY = "foco-data-v1";
const HOUR_MS = 60 * 60 * 1000;

const defaultData = () => ({
  name: "",
  createdAt: Date.now(),
  lastHourly: 0,
  lastStartupNote: 0,
  notifyOnOpen: true,
  hourlyReminders: true,
  teamsConnected: false,
  teamsClientId: "",
  pomodoro: 25 * 60,
  pomodoroRunning: false,
  projects: [
    { id: id(), name: "Colegio", color: "#0F6E6B" },
    { id: id(), name: "Personal", color: "#C9842A" }
  ],
  tasks: [
    { id: id(), title: "Revisar tareas de Teams", notes: "Pasar a FOCO lo que te enviaron hoy", projectId: null, priority: "alta", due: todayISO(), time: "08:30", done: false, source: "local", tags: ["inicio"], created: Date.now() },
    { id: id(), title: "Organizar horario de la semana", notes: "", projectId: null, priority: "media", due: todayISO(), time: "16:00", done: false, source: "local", tags: [], created: Date.now() }
  ],
  notes: [
    { id: id(), title: "Bienvenido a FOCO", content: "Este es tu espacio. Marca notas importantes para verlas en el inicio.", important: true, updated: Date.now() }
  ],
  events: [
    { id: id(), title: "Bloque de enfoque", date: todayISO(), start: "09:00", end: "10:00" }
  ],
  reminders: [
    { id: id(), text: "Mirar pendientes de hoy", time: "08:00", everyHours: 1, enabled: true }
  ],
  teamsTasks: [
    { id: "demo-1", title: "Ejemplo: actividad enviada por Teams", due: todayISO(), className: "Demo", done: false, demo: true }
  ]
});

function id() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
function todayISO() {
  const d = new Date();
  const z = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultData();
    return { ...defaultData(), ...JSON.parse(raw) };
  } catch {
    return defaultData();
  }
}
function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
}

let state = load();
let view = "inicio";
let calCursor = new Date();
let pomoLeft = state.pomodoro || 25 * 60;
let pomoTimer = null;
let filter = { q: "", status: "pendientes", priority: "todas" };

const MONTHS = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const DAYS = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
const DOW = ["L","M","X","J","V","S","D"];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}
function fmtDate(iso) {
  if (!iso) return "Sin fecha";
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${d} de ${MONTHS[m - 1]}`;
}
function prettyNow() {
  const d = new Date();
  return `${DAYS[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}
function projectName(pid) {
  return state.projects.find((p) => p.id === pid)?.name || "";
}
function pendingTasks() {
  return state.tasks.filter((t) => !t.done);
}
function overdue(t) {
  return t.due && t.due < todayISO() && !t.done;
}
function isToday(t) {
  return t.due === todayISO();
}

function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2400);
}

function setView(name) {
  view = name;
  $$(".view").forEach((v) => v.classList.toggle("active", v.dataset.view === name));
  $$(".nav-btn, .bottom-nav button").forEach((b) => b.classList.toggle("active", b.dataset.view === name));
  render();
  window.scrollTo(0, 0);
}

function openModal(html) {
  $("#modal-bg").classList.add("open");
  $("#modal").innerHTML = html;
}
function closeModal() {
  $("#modal-bg").classList.remove("open");
}

/* ---------- RENDER ---------- */
function render() {
  $("#hello").innerHTML = `${greeting()}${state.name ? ", <span>" + escapeHtml(state.name) + "</span>" : ""}`;
  $("#date-line").textContent = prettyNow();
  if (view === "inicio") renderHome();
  if (view === "tareas") renderTasks();
  if (view === "proyectos") renderProjects();
  if (view === "notas") renderNotes();
  if (view === "calendario") renderCalendar();
  if (view === "recordatorios") renderReminders();
  if (view === "teams") renderTeams();
  if (view === "ajustes") renderSettings();
  renderPomo();
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function taskRow(t, compact = false) {
  const meta = [
    t.priority ? `<span class="prio ${t.priority}">${t.priority}</span>` : "",
    t.due ? `<span class="item-meta">${overdue(t) ? "Vencida · " : ""}${fmtDate(t.due)}${t.time ? " · " + t.time : ""}</span>` : "",
    projectName(t.projectId) ? `<span class="tag">${escapeHtml(projectName(t.projectId))}</span>` : "",
    t.source === "teams" ? `<span class="tag">Teams</span>` : ""
  ].filter(Boolean).join(" ");
  return `
    <div class="item ${t.done ? "done" : ""}">
      <button class="check ${t.done ? "on" : ""}" data-act="toggle-task" data-id="${t.id}" aria-label="Completar"></button>
      <div style="flex:1">
        <div class="item-title">${escapeHtml(t.title)}</div>
        ${compact ? "" : `<div class="item-meta">${escapeHtml(t.notes || "")}</div>`}
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;align-items:center">${meta}</div>
      </div>
      <div class="row-actions">
        <button class="icon-btn" data-act="edit-task" data-id="${t.id}">Editar</button>
        <button class="icon-btn" data-act="del-task" data-id="${t.id}">Borrar</button>
      </div>
    </div>`;
}

function renderHome() {
  const pend = pendingTasks();
  const today = pend.filter(isToday);
  const high = pend.filter((t) => t.priority === "alta");
  const late = pend.filter(overdue);
  const notes = state.notes.filter((n) => n.important);
  const events = state.events.filter((e) => e.date === todayISO()).sort((a, b) => (a.start || "").localeCompare(b.start || ""));
  const teamsOpen = state.teamsTasks.filter((t) => !t.done);

  $("#home-stats").innerHTML = `
    <div class="card stat teal"><b>${pend.length}</b><span>pendientes</span></div>
    <div class="card stat gold"><b>${today.length}</b><span>para hoy</span></div>
    <div class="card stat terra"><b>${late.length}</b><span>vencidas</span></div>
    <div class="card stat"><b>${high.length}</b><span>prioridad alta</span></div>`;

  $("#home-priorities").innerHTML = high.length
    ? high.slice(0, 6).map((t) => taskRow(t, true)).join("")
    : `<div class="empty">No hay prioridades altas. Tranquilo.</div>`;

  $("#home-schedule").innerHTML = events.length
    ? events.map((e) => `<div class="tl"><div class="tl-time">${e.start || "—"}</div><div class="tl-card"><strong>${escapeHtml(e.title)}</strong><div class="item-meta">${e.start || ""} – ${e.end || ""}</div></div></div>`).join("")
    : `<div class="empty">Hoy no hay bloques en el horario.</div>`;

  $("#home-notes").innerHTML = notes.length
    ? notes.slice(0, 4).map((n) => `<div class="note important" style="min-height:auto;margin-bottom:8px"><h4>${escapeHtml(n.title)}</h4><p>${escapeHtml((n.content || "").slice(0, 160))}</p></div>`).join("")
    : `<div class="empty">Marca una nota como importante para verla aquí.</div>`;

  $("#home-reminders").innerHTML = state.reminders.filter((r) => r.enabled).length
    ? state.reminders.filter((r) => r.enabled).map((r) => `<div class="item"><div><div class="item-title">${escapeHtml(r.text)}</div><div class="item-meta">${r.time || "—"} · cada ${r.everyHours || 1} h</div></div></div>`).join("")
    : `<div class="empty">Sin recordatorios activos.</div>`;

  $("#home-teams").innerHTML = teamsOpen.length
    ? teamsOpen.map((t) => `<div class="item"><div class="check" data-act="toggle-teams" data-id="${t.id}"></div><div><div class="item-title">${escapeHtml(t.title)}</div><div class="item-meta">${escapeHtml(t.className || "Teams")} · ${t.due ? fmtDate(t.due) : "sin fecha"}</div></div></div>`).join("")
    : `<div class="empty">No hay tareas de Teams pendientes.</div>`;
}

function renderTasks() {
  let list = [...state.tasks];
  if (filter.status === "pendientes") list = list.filter((t) => !t.done);
  if (filter.status === "hechas") list = list.filter((t) => t.done);
  if (filter.priority !== "todas") list = list.filter((t) => t.priority === filter.priority);
  if (filter.q) {
    const q = filter.q.toLowerCase();
    list = list.filter((t) => (t.title + t.notes + projectName(t.projectId)).toLowerCase().includes(q));
  }
  list.sort((a, b) => Number(a.done) - Number(b.done) || (a.due || "9").localeCompare(b.due || "9"));
  $("#task-list").innerHTML = list.length ? list.map((t) => taskRow(t)).join("") : `<div class="empty">Nada por aquí. Suma una tarea.</div>`;
}

function renderProjects() {
  $("#project-list").innerHTML = state.projects.map((p) => {
    const n = state.tasks.filter((t) => t.projectId === p.id && !t.done).length;
    return `<div class="card">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
        <div>
          <div style="width:10px;height:10px;border-radius:99px;background:${p.color};display:inline-block;margin-right:8px"></div>
          <strong>${escapeHtml(p.name)}</strong>
          <div class="item-meta">${n} pendientes</div>
        </div>
        <div class="row-actions">
          <button class="icon-btn" data-act="del-project" data-id="${p.id}">Borrar</button>
        </div>
      </div>
    </div>`;
  }).join("") || `<div class="empty">Crea un proyecto (Escuela, Personal, un trabajo…).</div>`;
}

function renderNotes() {
  $("#notes-list").innerHTML = state.notes.map((n) => `
    <div class="note ${n.important ? "important" : ""}">
      <div style="display:flex;justify-content:space-between;gap:8px">
        <h4>${escapeHtml(n.title)}</h4>
        <div class="row-actions">
          <button class="icon-btn" data-act="toggle-important" data-id="${n.id}">${n.important ? "Quitar importante" : "Importante"}</button>
          <button class="icon-btn" data-act="edit-note" data-id="${n.id}">Editar</button>
          <button class="icon-btn" data-act="del-note" data-id="${n.id}">Borrar</button>
        </div>
      </div>
      <p>${escapeHtml(n.content)}</p>
    </div>`).join("") || `<div class="empty">Todavía no hay notas.</div>`;
}

function renderCalendar() {
  const y = calCursor.getFullYear();
  const m = calCursor.getMonth();
  $("#cal-title").textContent = `${MONTHS[m]} ${y}`;
  const first = new Date(y, m, 1);
  let start = first.getDay(); // 0 sun
  start = start === 0 ? 6 : start - 1; // monday first
  const days = new Date(y, m + 1, 0).getDate();
  const prevDays = new Date(y, m, 0).getDate();
  const cells = [];
  for (let i = 0; i < start; i++) cells.push({ d: prevDays - start + i + 1, out: true, iso: null });
  for (let d = 1; d <= days; d++) {
    const iso = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ d, out: false, iso });
  }
  while (cells.length % 7) cells.push({ d: cells.length, out: true, iso: null });

  $("#cal-grid").innerHTML = DOW.map((d) => `<div class="cal-dow">${d}</div>`).join("") +
    cells.map((c) => {
      const ev = c.iso ? state.events.filter((e) => e.date === c.iso) : [];
      const tk = c.iso ? state.tasks.filter((t) => t.due === c.iso && !t.done) : [];
      const today = c.iso === todayISO();
      return `<button class="cal-day ${c.out ? "out" : ""} ${today ? "today" : ""}" data-act="day" data-iso="${c.iso || ""}">
        <b>${c.d}</b>
        ${ev.slice(0, 2).map((e) => `<div class="cal-pill">${escapeHtml(e.title)}</div>`).join("")}
        ${tk.slice(0, 1).map((t) => `<div class="cal-pill">${escapeHtml(t.title)}</div>`).join("")}
      </button>`;
    }).join("");

  const selected = todayISO();
  const dayEvents = state.events.filter((e) => e.date === selected).sort((a, b) => (a.start || "").localeCompare(b.start || ""));
  $("#day-agenda").innerHTML = `<h3>Horario de hoy</h3>` + (dayEvents.length
    ? dayEvents.map((e) => `<div class="item"><div><div class="item-title">${escapeHtml(e.title)}</div><div class="item-meta">${e.start || "—"} – ${e.end || "—"}</div></div><button class="icon-btn" data-act="del-event" data-id="${e.id}">Borrar</button></div>`).join("")
    : `<div class="empty">Sin eventos hoy.</div>`);
}

function renderReminders() {
  $("#rem-list").innerHTML = state.reminders.map((r) => `
    <div class="item">
      <button class="check ${r.enabled ? "on" : ""}" data-act="toggle-rem" data-id="${r.id}"></button>
      <div style="flex:1">
        <div class="item-title">${escapeHtml(r.text)}</div>
        <div class="item-meta">A las ${r.time || "—"} · cada ${r.everyHours || 1} hora(s)</div>
      </div>
      <button class="icon-btn" data-act="del-rem" data-id="${r.id}">Borrar</button>
    </div>`).join("") || `<div class="empty">Crea un recordatorio, por ejemplo “pendientes cada hora”.</div>`;
}

function renderTeams() {
  $("#teams-status").innerHTML = state.teamsConnected
    ? `<strong>Conectado a Microsoft</strong><div>Las tareas que puedas leer se listan abajo.</div>`
    : `<strong>Todavía no está anclado a Teams</strong>
       <div>No necesito tu contraseña. Para ver de verdad las tareas de Teams hay que registrar una app en Microsoft (gratis) y pegar el ID aquí en Ajustes. Mientras tanto puedes <b>anotar a mano</b> lo que te envíen.</div>
       <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
         <button class="btn primary" data-act="add-teams">Añadir tarea de Teams</button>
         <button class="btn" data-act="goto-ajustes">Ver cómo conectar</button>
       </div>`;
  $("#teams-list").innerHTML = state.teamsTasks.map((t) => `
    <div class="item ${t.done ? "done" : ""}">
      <button class="check ${t.done ? "on" : ""}" data-act="toggle-teams" data-id="${t.id}"></button>
      <div style="flex:1">
        <div class="item-title">${escapeHtml(t.title)}</div>
        <div class="item-meta">${escapeHtml(t.className || "Teams")} · ${t.due ? fmtDate(t.due) : "sin fecha"}${t.demo ? " · ejemplo" : ""}</div>
      </div>
      <div class="row-actions">
        <button class="icon-btn" data-act="to-local" data-id="${t.id}">Pasar a mis tareas</button>
        <button class="icon-btn" data-act="del-teams" data-id="${t.id}">Borrar</button>
      </div>
    </div>`).join("") || `<div class="empty">Sin tareas de Teams.</div>`;
}

function renderSettings() {
  $("#set-name").value = state.name || "";
  $("#set-hourly").checked = !!state.hourlyReminders;
  $("#set-open").checked = !!state.notifyOnOpen;
  $("#set-client").value = state.teamsClientId || "";
  $("#backup-box").value = JSON.stringify(state, null, 2);
}

function renderPomo() {
  const m = String(Math.floor(pomoLeft / 60)).padStart(2, "0");
  const s = String(pomoLeft % 60).padStart(2, "0");
  const el = $("#pomo-time");
  if (el) el.textContent = `${m}:${s}`;
}

/* ---------- FORMS ---------- */
function taskForm(t = null) {
  const pOpts = state.projects.map((p) => `<option value="${p.id}" ${t && t.projectId === p.id ? "selected" : ""}>${escapeHtml(p.name)}</option>`).join("");
  openModal(`
    <h2 style="margin:0 0 14px;font-family:var(--display)">${t ? "Editar tarea" : "Nueva tarea"}</h2>
    <div class="field"><label>Título</label><input id="f-title" value="${escapeHtml(t?.title || "")}" /></div>
    <div class="field"><label>Notas</label><textarea id="f-notes" rows="3">${escapeHtml(t?.notes || "")}</textarea></div>
    <div class="grid grid-2">
      <div class="field"><label>Fecha</label><input id="f-due" type="date" value="${t?.due || todayISO()}" /></div>
      <div class="field"><label>Hora</label><input id="f-time" type="time" value="${t?.time || ""}" /></div>
    </div>
    <div class="grid grid-2">
      <div class="field"><label>Prioridad</label>
        <select id="f-prio">
          <option value="alta" ${t?.priority === "alta" ? "selected" : ""}>Alta</option>
          <option value="media" ${!t || t?.priority === "media" ? "selected" : ""}>Media</option>
          <option value="baja" ${t?.priority === "baja" ? "selected" : ""}>Baja</option>
        </select>
      </div>
      <div class="field"><label>Proyecto</label>
        <select id="f-proj"><option value="">Ninguno</option>${pOpts}</select>
      </div>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button class="btn ghost" data-act="close">Cancelar</button>
      <button class="btn primary" data-act="save-task" data-id="${t?.id || ""}">Guardar</button>
    </div>`);
}
function noteForm(n = null) {
  openModal(`
    <h2 style="margin:0 0 14px;font-family:var(--display)">${n ? "Editar nota" : "Nueva nota"}</h2>
    <div class="field"><label>Título</label><input id="f-ntitle" value="${escapeHtml(n?.title || "")}" /></div>
    <div class="field"><label>Contenido</label><textarea id="f-nbody" rows="6">${escapeHtml(n?.content || "")}</textarea></div>
    <label style="display:flex;gap:8px;align-items:center;margin-bottom:14px"><input type="checkbox" id="f-nimp" ${n?.important ? "checked" : ""}> Importante (sale en el inicio)</label>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button class="btn ghost" data-act="close">Cancelar</button>
      <button class="btn primary" data-act="save-note" data-id="${n?.id || ""}">Guardar</button>
    </div>`);
}
function eventForm(iso) {
  openModal(`
    <h2 style="margin:0 0 14px;font-family:var(--display)">Bloque de horario</h2>
    <div class="field"><label>Título</label><input id="f-etitle" placeholder="Clase, estudio, descanso..." /></div>
    <div class="field"><label>Fecha</label><input id="f-edate" type="date" value="${iso || todayISO()}" /></div>
    <div class="grid grid-2">
      <div class="field"><label>Desde</label><input id="f-estart" type="time" value="09:00" /></div>
      <div class="field"><label>Hasta</label><input id="f-eend" type="time" value="10:00" /></div>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button class="btn ghost" data-act="close">Cancelar</button>
      <button class="btn primary" data-act="save-event">Guardar</button>
    </div>`);
}

/* ---------- ACTIONS ---------- */
function handleAct(act, idVal, el) {
  if (act === "close") return closeModal();
  if (act === "new-task") return taskForm();
  if (act === "edit-task") return taskForm(state.tasks.find((t) => t.id === idVal));
  if (act === "save-task") {
    const payload = {
      title: $("#f-title").value.trim() || "Sin título",
      notes: $("#f-notes").value.trim(),
      due: $("#f-due").value,
      time: $("#f-time").value,
      priority: $("#f-prio").value,
      projectId: $("#f-proj").value || null
    };
    if (idVal) {
      const t = state.tasks.find((x) => x.id === idVal);
      Object.assign(t, payload);
    } else {
      state.tasks.unshift({ id: id(), ...payload, done: false, source: "local", tags: [], created: Date.now() });
    }
    save(); closeModal(); render(); toast("Tarea guardada");
  }
  if (act === "toggle-task") {
    const t = state.tasks.find((x) => x.id === idVal);
    if (t) t.done = !t.done;
    save(); render();
  }
  if (act === "del-task") {
    state.tasks = state.tasks.filter((t) => t.id !== idVal);
    save(); render();
  }
  if (act === "new-project") {
    const name = prompt("Nombre del proyecto");
    if (!name) return;
    state.projects.push({ id: id(), name: name.trim(), color: "#0F6E6B" });
    save(); render();
  }
  if (act === "del-project") {
    state.projects = state.projects.filter((p) => p.id !== idVal);
    state.tasks.forEach((t) => { if (t.projectId === idVal) t.projectId = null; });
    save(); render();
  }
  if (act === "new-note") return noteForm();
  if (act === "edit-note") return noteForm(state.notes.find((n) => n.id === idVal));
  if (act === "save-note") {
    const payload = {
      title: $("#f-ntitle").value.trim() || "Nota",
      content: $("#f-nbody").value,
      important: $("#f-nimp").checked,
      updated: Date.now()
    };
    if (idVal) Object.assign(state.notes.find((n) => n.id === idVal), payload);
    else state.notes.unshift({ id: id(), ...payload });
    save(); closeModal(); render();
  }
  if (act === "toggle-important") {
    const n = state.notes.find((x) => x.id === idVal);
    if (n) n.important = !n.important;
    save(); render();
  }
  if (act === "del-note") {
    state.notes = state.notes.filter((n) => n.id !== idVal);
    save(); render();
  }
  if (act === "new-event") return eventForm(todayISO());
  if (act === "day" && idVal) return eventForm(idVal);
  if (act === "save-event") {
    state.events.push({
      id: id(),
      title: $("#f-etitle").value.trim() || "Bloque",
      date: $("#f-edate").value,
      start: $("#f-estart").value,
      end: $("#f-eend").value
    });
    save(); closeModal(); render();
  }
  if (act === "del-event") {
    state.events = state.events.filter((e) => e.id !== idVal);
    save(); render();
  }
  if (act === "cal-prev") { calCursor.setMonth(calCursor.getMonth() - 1); render(); }
  if (act === "cal-next") { calCursor.setMonth(calCursor.getMonth() + 1); render(); }
  if (act === "new-rem") {
    openModal(`
      <h2 style="margin:0 0 14px;font-family:var(--display)">Recordatorio</h2>
      <div class="field"><label>Texto</label><input id="f-rtext" placeholder="Tareas pendientes" /></div>
      <div class="grid grid-2">
        <div class="field"><label>Hora de inicio</label><input id="f-rtime" type="time" value="08:00" /></div>
        <div class="field"><label>Cada cuántas horas</label><input id="f-rh" type="number" min="1" max="12" value="1" /></div>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn ghost" data-act="close">Cancelar</button>
        <button class="btn primary" data-act="save-rem">Guardar</button>
      </div>`);
  }
  if (act === "save-rem") {
    state.reminders.push({
      id: id(),
      text: $("#f-rtext").value.trim() || "Pendientes",
      time: $("#f-rtime").value,
      everyHours: Number($("#f-rh").value) || 1,
      enabled: true
    });
    save(); closeModal(); render();
  }
  if (act === "toggle-rem") {
    const r = state.reminders.find((x) => x.id === idVal);
    if (r) r.enabled = !r.enabled;
    save(); render();
  }
  if (act === "del-rem") {
    state.reminders = state.reminders.filter((r) => r.id !== idVal);
    save(); render();
  }
  if (act === "add-teams") {
    openModal(`
      <h2 style="margin:0 0 14px;font-family:var(--display)">Tarea de Teams</h2>
      <div class="field"><label>Qué te enviaron</label><input id="f-tt" placeholder="Trabajo de..." /></div>
      <div class="field"><label>Clase o canal</label><input id="f-tc" placeholder="Matemáticas" /></div>
      <div class="field"><label>Entrega</label><input id="f-td" type="date" value="${todayISO()}" /></div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn ghost" data-act="close">Cancelar</button>
        <button class="btn primary" data-act="save-teams">Guardar</button>
      </div>`);
  }
  if (act === "save-teams") {
    state.teamsTasks.unshift({
      id: id(),
      title: $("#f-tt").value.trim() || "Tarea de Teams",
      className: $("#f-tc").value.trim() || "Teams",
      due: $("#f-td").value,
      done: false,
      demo: false
    });
    save(); closeModal(); render(); toast("Añadida desde Teams");
  }
  if (act === "toggle-teams") {
    const t = state.teamsTasks.find((x) => x.id === idVal);
    if (t) t.done = !t.done;
    save(); render();
  }
  if (act === "del-teams") {
    state.teamsTasks = state.teamsTasks.filter((t) => t.id !== idVal);
    save(); render();
  }
  if (act === "to-local") {
    const t = state.teamsTasks.find((x) => x.id === idVal);
    if (!t) return;
    state.tasks.unshift({
      id: id(),
      title: t.title,
      notes: "Importada de Teams · " + (t.className || ""),
      projectId: state.projects[0]?.id || null,
      priority: "alta",
      due: t.due,
      time: "",
      done: false,
      source: "teams",
      tags: ["teams"],
      created: Date.now()
    });
    save(); render(); toast("Ya está en tus tareas");
  }
  if (act === "goto-ajustes") setView("ajustes");
  if (act === "ask-notify") requestNotify();
  if (act === "pomo-start") startPomo();
  if (act === "pomo-pause") { clearInterval(pomoTimer); pomoTimer = null; }
  if (act === "pomo-reset") { clearInterval(pomoTimer); pomoTimer = null; pomoLeft = 25 * 60; renderPomo(); }
  if (act === "install-help") showInstallHelp();
  if (act === "export") downloadBackup();
  if (act === "copy-backup") {
    navigator.clipboard.writeText($("#backup-box").value).then(() => toast("Copiado. Pégalo en el otro dispositivo."));
  }
  if (act === "import") {
    try {
      const parsed = JSON.parse($("#import-box").value);
      if (!parsed.tasks) throw new Error("formato");
      state = { ...defaultData(), ...parsed };
      save(); render(); toast("Datos pegados. Ya estás sincronizado a mano.");
    } catch {
      toast("Ese texto no es un respaldo válido");
    }
  }
  if (act === "wipe") {
    if (confirm("Esto borra todo lo de FOCO en este aparato. ¿Seguro?")) {
      localStorage.removeItem(KEY);
      state = defaultData();
      save(); render();
    }
  }
}

function downloadBackup() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `foco-respaldo-${todayISO()}.json`;
  a.click();
}

function showInstallHelp() {
  openModal(`
    <h2 style="margin:0 0 10px;font-family:var(--display)">Instalar FOCO</h2>
    <p style="color:var(--muted);font-size:14px">Tiene que estar publicada con https (GitHub Pages, Netlify, etc.). En archivo local el iPhone no la instala.</p>
    <p><b>iPhone:</b> Safari → Compartir → <i>Añadir a pantalla de inicio</i>.</p>
    <p><b>Windows:</b> Chrome o Edge → icono de instalar en la barra, o menú → Instalar FOCO.</p>
    <div style="text-align:right"><button class="btn primary" data-act="close">Listo</button></div>`);
}

/* ---------- NOTIFICATIONS ---------- */
async function requestNotify() {
  if (!("Notification" in window)) return toast("Este navegador no admite avisos");
  const perm = await Notification.requestPermission();
  if (perm === "granted") {
    toast("Avisos activados");
    startupNotification(true);
  } else toast("No se dieron permisos de aviso");
}

function notify(title, body) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.ready.then((reg) => reg.showNotification(title, { body, icon: "icons/icon-192.png", badge: "icons/icon-192.png" }));
    } else {
      new Notification(title, { body, icon: "icons/icon-192.png" });
    }
  } catch {}
}

function startupNotification(force = false) {
  if (!state.notifyOnOpen && !force) return;
  const pend = pendingTasks();
  if (!pend.length) return;
  const now = Date.now();
  if (!force && now - (state.lastStartupNote || 0) < 10 * 60 * 1000) return;
  state.lastStartupNote = now;
  save();
  const top = pend.find((t) => t.priority === "alta") || pend[0];
  notify("FOCO · Pendientes", `Tienes ${pend.length} tarea(s). La primera: ${top.title}`);
}

function hourlyTick() {
  if (!state.hourlyReminders) return;
  if (!state.lastHourly) {
    state.lastHourly = Date.now();
    save();
    return;
  }
  const pend = pendingTasks();
  if (!pend.length) return;
  const now = Date.now();
  if (now - (state.lastHourly || 0) < HOUR_MS - 5000) return;
  state.lastHourly = now;
  save();
  notify("FOCO · Siguen pendientes", `${pend.length} sin hacer. ${pend[0].title}`);
}

function startPomo() {
  if (pomoTimer) return;
  pomoTimer = setInterval(() => {
    pomoLeft -= 1;
    if (pomoLeft <= 0) {
      clearInterval(pomoTimer);
      pomoTimer = null;
      pomoLeft = 25 * 60;
      notify("FOCO · Foco terminado", "25 minutos. Tómate un descanso.");
    }
    renderPomo();
  }, 1000);
}

/* ---------- INIT ---------- */
function bind() {
  document.addEventListener("click", (e) => {
    const nav = e.target.closest("[data-view]");
    if (nav && nav.dataset.view && nav.tagName !== "SECTION") {
      setView(nav.dataset.view);
      return;
    }
    const btn = e.target.closest("[data-act]");
    if (btn) handleAct(btn.dataset.act, btn.dataset.id || btn.dataset.iso, btn);
  });
  $("#modal-bg").addEventListener("click", (e) => {
    if (e.target.id === "modal-bg") closeModal();
  });
  const search = $("#task-search");
  if (search) search.addEventListener("input", (e) => { filter.q = e.target.value; renderTasks(); });
  $$("[data-filter]").forEach((b) => {
    b.addEventListener("click", () => {
      filter[b.dataset.filter] = b.dataset.value;
      $$(`[data-filter="${b.dataset.filter}"]`).forEach((x) => x.classList.toggle("on", x === b));
      renderTasks();
    });
  });
  $("#set-name")?.addEventListener("change", (e) => { state.name = e.target.value.trim(); save(); render(); });
  $("#set-hourly")?.addEventListener("change", (e) => { state.hourlyReminders = e.target.checked; save(); });
  $("#set-open")?.addEventListener("change", (e) => { state.notifyOnOpen = e.target.checked; save(); });
  $("#set-client")?.addEventListener("change", (e) => { state.teamsClientId = e.target.value.trim(); save(); });
}

function registerSW() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

window.addEventListener("DOMContentLoaded", () => {
  bind();
  setView("inicio");
  registerSW();
  setTimeout(() => startupNotification(false), 800);
  setInterval(hourlyTick, 60 * 1000);
  hourlyTick();
});
