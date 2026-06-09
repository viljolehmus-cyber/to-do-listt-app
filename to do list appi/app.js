/**
 * app.js — Pääsovelluslogiikka
 */

import {
  getTasks, saveTask, deleteTask,
  getProjects, saveProject, deleteProject,
  getCategories, saveCategory, deleteCategory,
  getSettings, saveSettings,
  getStreak, saveStreak,
  generateId,
} from './storage.js';

import {
  requestNotificationPermission,
  getNotificationPermission,
  scheduleNotification,
  cancelNotification,
  rescheduleAll,
  showInstantNotification,
} from './notifications.js';

import {
  suggestCategory,
  getOverdueTasks,
  getSoonDueTasks,
  getTodayTasks,
  updateStreak,
} from './suggestions.js';

import { icon } from './icons.js';

// ---------------------------------------------------------------------------
// Tila
// ---------------------------------------------------------------------------

let state = {
  view: 'today',       // 'today' | 'inbox' | 'project:{id}' | 'stats' | 'settings' | 'overdue'
  filter: {
    search: '',
    category: '',
    priority: '',
    status: 'active',  // 'active' | 'completed' | 'all'
    projectId: null,
  },
  undoBuffer: null,    // { task, timeout }
  tasks: [],
  projects: [],
  categories: [],
  settings: {},
  streak: {},
};

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', boot);

async function boot() {
  state.tasks      = getTasks();
  state.projects   = getProjects();
  state.categories = getCategories();
  state.settings   = getSettings();
  state.streak     = getStreak();

  applyTheme(state.settings.theme);
  seedDemoData();
  renderSidebar();
  renderBottomNav();
  renderMain();
  rescheduleAll(state.tasks);
  registerServiceWorker();

  setInterval(checkDueReminders, 60_000);
}

// ---------------------------------------------------------------------------
// Demotehtävät
// ---------------------------------------------------------------------------

function seedDemoData() {
  if (state.tasks.length > 0) return;

  const today    = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const demos = [
    {
      id: generateId(), title: 'Viimeistele kvartaaliraportti', notes: 'Muista lisätä Q2-luvut ja kaaviot.',
      category: 'work', priority: 'korkea', projectId: 'work',
      dueDate: today, dueTime: '15:00', recurrence: null,
      completed: false, completedAt: null, attachments: [], reminderAt: null,
    },
    {
      id: generateId(), title: 'Ostosreissu: maito, leipä, hedelmät', notes: '',
      category: 'home', priority: 'keskitaso', projectId: 'home',
      dueDate: today, dueTime: null, recurrence: null,
      completed: false, completedAt: null, attachments: [], reminderAt: null,
    },
    {
      id: generateId(), title: 'Lue datatiede-kurssin luku 5', notes: 'Koneoppimisen perusteet.',
      category: 'study', priority: 'keskitaso', projectId: 'inbox',
      dueDate: tomorrow, dueTime: null, recurrence: null,
      completed: false, completedAt: null, attachments: [], reminderAt: null,
    },
    {
      id: generateId(), title: 'Aamu-juoksu 5 km', notes: '',
      category: 'health', priority: 'matala', projectId: 'inbox',
      dueDate: today, dueTime: '07:00', recurrence: 'daily',
      completed: false, completedAt: null, attachments: [], reminderAt: null,
    },
    {
      id: generateId(), title: 'Maksa sähkölasku', notes: '',
      category: 'finance', priority: 'korkea', projectId: 'inbox',
      dueDate: nextWeek, dueTime: null, recurrence: null,
      completed: false, completedAt: null, attachments: [], reminderAt: null,
    },
    {
      id: generateId(), title: 'Siivoa asunto viikonloppuna', notes: 'Erityisesti keittiö ja kylpyhuone.',
      category: 'home', priority: 'matala', projectId: 'home',
      dueDate: nextWeek, dueTime: null, recurrence: 'weekly',
      completed: true,
      completedAt: new Date(Date.now() - 86400000).toISOString(),
      attachments: [], reminderAt: null,
    },
  ];

  demos.forEach(t => saveTask(t));
  state.tasks = getTasks();
}

// ---------------------------------------------------------------------------
// Teema
// ---------------------------------------------------------------------------

function applyTheme(preference) {
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = preference === 'dark' || (preference === 'system' && systemDark);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
}

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (state.settings.theme === 'system') applyTheme('system');
});

// ---------------------------------------------------------------------------
// Renderöinti — sivupalkki
// ---------------------------------------------------------------------------

function renderSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overdue     = getOverdueTasks(state.tasks);
  const todayCount  = getTodayTasks(state.tasks).length;
  const totalActive = state.tasks.filter(t => !t.completed).length;
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  sidebar.innerHTML = `
    <div class="sidebar-header">
      <div class="app-logo">
        <div class="logo-mark">${icon('sparkles', 16)}</div>
        <span class="logo-text">Tehtävät</span>
      </div>
      <button class="icon-btn" id="btn-theme" title="Vaihda teema" aria-label="Vaihda teema">
        ${isDark ? icon('sun', 18) : icon('moon', 18)}
      </button>
    </div>

    <nav class="sidebar-nav">
      ${navItem('today', 'calendar', 'Tänään', todayCount)}
      ${navItem('inbox', 'list', 'Kaikki', totalActive)}
      ${overdue.length > 0 ? `
        <button class="nav-item overdue-nav ${state.view === 'overdue' ? 'active' : ''}" data-view="overdue">
          <span class="nav-icon-wrap">${icon('alert-circle', 17)}</span>
          <span class="nav-label">Myöhässä</span>
          <span class="nav-badge danger">${overdue.length}</span>
        </button>` : ''}
    </nav>

    <div class="sidebar-section-title">Projektit</div>
    <nav class="sidebar-nav projects-nav">
      ${state.projects.map(p => {
        const count   = state.tasks.filter(t => t.projectId === p.id && !t.completed).length;
        const viewKey = `project:${p.id}`;
        return `
          <button class="nav-item ${state.view === viewKey ? 'active' : ''}" data-view="${viewKey}">
            <span class="nav-icon-wrap">
              <span class="project-dot" style="background:${p.color}"></span>
            </span>
            <span class="nav-label">${escHtml(p.name)}</span>
            ${count > 0 ? `<span class="nav-badge">${count}</span>` : ''}
          </button>`;
      }).join('')}
      <button class="nav-item add-project-btn" id="btn-add-project">
        <span class="nav-icon-wrap">${icon('plus', 16)}</span>
        <span class="nav-label">Uusi projekti</span>
      </button>
    </nav>

    <div class="sidebar-section-title">Muut</div>
    <nav class="sidebar-nav">
      ${navItem('stats', 'bar-chart', 'Tilastot')}
      ${navItem('settings', 'settings', 'Asetukset')}
    </nav>

    <div class="sidebar-footer">
      <div class="streak-badge">
        ${icon('flame', 16)}
        <span><span class="streak-num">${state.streak.current}</span> pv putki</span>
      </div>
      <div class="cloud-status cloud-${state.settings.cloudStatus}">
        ${cloudStatusIcon(state.settings.cloudStatus)}
        <span>${cloudStatusLabel(state.settings.cloudStatus)}</span>
      </div>
    </div>
  `;

  sidebar.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.view));
  });
  document.getElementById('btn-theme').addEventListener('click', toggleTheme);
  document.getElementById('btn-add-project')?.addEventListener('click', () => openProjectModal());
}

function navItem(view, iconName, label, badge) {
  const active = state.view === view ? 'active' : '';
  const badgeHtml = badge > 0 ? `<span class="nav-badge">${badge}</span>` : '';
  return `
    <button class="nav-item ${active}" data-view="${view}">
      <span class="nav-icon-wrap">${icon(iconName, 17)}</span>
      <span class="nav-label">${label}</span>
      ${badgeHtml}
    </button>`;
}

function cloudStatusIcon(s) {
  const map = { local: 'cloud-off', synced: 'check-circle', syncing: 'refresh-cw', error: 'alert-circle' };
  return icon(map[s] || 'cloud-off', 15);
}
function cloudStatusLabel(s) {
  return { local:'Paikallinen', synced:'Synkronoitu', syncing:'Synkronoidaan…', error:'Virhe' }[s] || 'Paikallinen';
}

// ---------------------------------------------------------------------------
// Alanavigaatio (mobiili)
// ---------------------------------------------------------------------------

function renderBottomNav() {
  let nav = document.getElementById('bottom-nav');
  if (!nav) {
    nav = document.createElement('nav');
    nav.id = 'bottom-nav';
    nav.setAttribute('aria-label', 'Päänavigaatio');
    document.body.appendChild(nav);
  }

  const v = state.view;
  nav.innerHTML = `
    <div class="bnav-inner">
      <button class="bnav-item ${v==='today'?'active':''}" data-view="today">
        ${icon('calendar', 22)}
        <span>Tänään</span>
      </button>
      <button class="bnav-item ${v==='inbox'||v.startsWith('project:')?'active':''}" data-view="inbox">
        ${icon('list', 22)}
        <span>Tehtävät</span>
      </button>
      <button class="bnav-fab" id="bnav-new" aria-label="Uusi tehtävä">
        ${icon('plus', 22)}
      </button>
      <button class="bnav-item ${v==='stats'?'active':''}" data-view="stats">
        ${icon('bar-chart', 22)}
        <span>Tilastot</span>
      </button>
      <button class="bnav-item ${v==='settings'?'active':''}" data-view="settings">
        ${icon('settings', 22)}
        <span>Asetukset</span>
      </button>
    </div>
  `;

  nav.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.view));
  });
  document.getElementById('bnav-new').addEventListener('click', () => openTaskModal());
}

function navigateTo(view) {
  state.view = view;
  state.filter.search = '';
  renderSidebar();
  renderBottomNav();
  renderMain();
}

// ---------------------------------------------------------------------------
// Renderöinti — pääalue
// ---------------------------------------------------------------------------

function renderMain() {
  const main = document.getElementById('main-content');
  if (state.view === 'stats')    { renderStats(main); return; }
  if (state.view === 'settings') { renderSettings(main); return; }
  renderTaskView(main);
}

// ---------------------------------------------------------------------------
// Tehtävänäkymä
// ---------------------------------------------------------------------------

function renderTaskView(container) {
  const { view, filter } = state;
  let tasks = [...state.tasks];
  let greeting    = '';
  let title       = 'Tehtävät';
  let subtitle    = '';
  let showGreet   = false;

  if (view === 'today') {
    const todayTasks = getTodayTasks(tasks);
    const overdue    = getOverdueTasks(tasks);
    const todayStr   = new Date().toLocaleDateString('fi-FI', { weekday:'long', day:'numeric', month:'long' });
    const h          = new Date().getHours();
    greeting  = h < 12 ? 'Hyvää huomenta' : h < 17 ? 'Hyvää päivää' : 'Hyvää iltaa';
    title     = greeting;
    subtitle  = todayStr;
    showGreet = true;
    tasks = [...new Set([...overdue, ...todayTasks].map(t => t.id))].map(id => tasks.find(t => t.id === id));
  } else if (view === 'overdue') {
    tasks = getOverdueTasks(tasks);
    title = 'Myöhässä';
  } else if (view === 'inbox') {
    title = 'Kaikki tehtävät';
  } else if (view.startsWith('project:')) {
    const pid  = view.split(':')[1];
    const proj = state.projects.find(p => p.id === pid);
    title = proj ? proj.name : 'Projekti';
    tasks = tasks.filter(t => t.projectId === pid);
    filter.projectId = pid;
  }

  // Suodattimet
  if (filter.search) {
    const s = filter.search.toLowerCase();
    tasks = tasks.filter(t => t.title.toLowerCase().includes(s) || (t.notes||'').toLowerCase().includes(s));
  }
  if (filter.category) tasks = tasks.filter(t => t.category === filter.category);
  if (filter.priority) tasks = tasks.filter(t => t.priority === filter.priority);
  if (filter.status === 'active')    tasks = tasks.filter(t => !t.completed);
  if (filter.status === 'completed') tasks = tasks.filter(t => t.completed);

  const active    = tasks.filter(t => !t.completed);
  const completed = tasks.filter(t => t.completed);
  const totalAct  = state.tasks.filter(t => !t.completed).length;
  const todayDone = state.tasks.filter(t =>
    t.completed && t.completedAt?.slice(0,10) === new Date().toISOString().slice(0,10)
  ).length;

  container.innerHTML = `
    <div class="topbar">
      <div class="topbar-left">
        <h1 class="topbar-greeting">${escHtml(title)}</h1>
        ${subtitle ? `<p class="topbar-subtitle">${escHtml(subtitle)}</p>` : ''}
      </div>
      <div class="topbar-right">
        <button class="icon-btn" id="btn-search-toggle" title="Haku" aria-label="Haku">
          ${icon('search', 18)}
        </button>
        <div class="topbar-avatar">${icon('user', 18)}</div>
      </div>
    </div>

    <div class="view-content">
      <div class="search-bar hidden" id="search-bar">
        <div class="search-wrap">
          ${icon('search', 16)}
          <input type="search" id="search-input" placeholder="Hae tehtäviä…" value="${escHtml(filter.search)}" />
        </div>
      </div>

      <div class="filter-row" id="filter-row">
        ${renderFilterRow()}
      </div>

      ${view === 'today' ? renderProgressBar(todayDone, todayDone + totalAct) : ''}

      <div class="task-list" id="task-list">
        ${active.length === 0 && completed.length === 0
          ? renderEmptyState()
          : ''
        }
        ${active.map(t => renderTaskCard(t)).join('')}
        ${completed.length > 0 ? `
          <div class="section-divider">
            <span>Valmiit — ${completed.length}</span>
          </div>
          ${completed.map(t => renderTaskCard(t)).join('')}
        ` : ''}
      </div>

      <div style="margin-top:20px">
        <button class="pill-btn primary" id="btn-new-task">
          ${icon('plus', 15, 'btn-icon')} Uusi tehtävä
        </button>
      </div>
    </div>
  `;

  bindTaskViewEvents(container);
}

function renderEmptyState() {
  return `
    <div class="empty-state">
      <div class="empty-icon">
        ${icon('check-square', 30)}
      </div>
      <p>Ei tehtäviä tässä näkymässä</p>
      <small>Lisää ensimmäinen tehtävä alta</small>
    </div>`;
}

function renderProgressBar(done, total) {
  if (total === 0) return '';
  const pct = Math.round((done / total) * 100);
  return `
    <div class="progress-section">
      <div class="progress-labels">
        <span>${done} valmis</span>
        <span>${pct}% tehty</span>
        <span>${total - done} jäljellä</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" style="width:${pct}%"></div>
      </div>
    </div>`;
}

function renderFilterRow() {
  const { filter } = state;
  const cats = state.categories;

  const statusPills = [
    ['active','Avoimet'],
    ['all','Kaikki'],
    ['completed','Valmiit'],
  ].map(([v,l]) => `
    <button class="status-pill ${filter.status===v?'active':''}" data-status="${v}">${l}</button>
  `).join('');

  const catActive   = filter.category ? 'active-filter' : '';
  const priActive   = filter.priority ? 'active-filter' : '';

  return `
    <div class="status-pills">${statusPills}</div>
    <div class="filter-select-wrap">
      <select class="filter-select ${catActive}" id="filter-category">
        <option value="">Kaikki kategoriat</option>
        ${cats.map(c => `<option value="${c.id}" ${filter.category===c.id?'selected':''}>${c.name}</option>`).join('')}
      </select>
      ${icon('chevron-down', 12)}
    </div>
    <div class="filter-select-wrap">
      <select class="filter-select ${priActive}" id="filter-priority">
        <option value="">Kaikki prioriteetit</option>
        <option value="korkea"    ${filter.priority==='korkea'?'selected':''}>Korkea</option>
        <option value="keskitaso" ${filter.priority==='keskitaso'?'selected':''}>Keski</option>
        <option value="matala"    ${filter.priority==='matala'?'selected':''}>Matala</option>
      </select>
      ${icon('chevron-down', 12)}
    </div>`;
}

function renderTaskCard(task) {
  const cat     = state.categories.find(c => c.id === task.category);
  const proj    = state.projects.find(p => p.id === task.projectId);
  const overdue = !task.completed && task.dueDate &&
    task.dueDate < new Date().toISOString().slice(0,10);
  const dueFmt  = task.dueDate ? formatDate(task.dueDate, task.dueTime) : '';

  const priMeta = {
    korkea:    ['pri-high',   '#dc2626'],
    keskitaso: ['pri-mid',    '#d97706'],
    matala:    ['pri-low',    '#16a34a'],
  };
  const [priCls, priColor] = priMeta[task.priority] || ['', ''];

  return `
    <div class="task-card ${task.completed ? 'completed' : ''} ${overdue ? 'overdue' : ''}"
         data-id="${task.id}">
      <button class="task-check ${task.completed ? 'checked' : ''}"
              data-action="toggle" data-id="${task.id}"
              aria-label="${task.completed ? 'Merkitse avoimeksi' : 'Merkitse valmiiksi'}">
        ${task.completed ? icon('check', 12) : ''}
      </button>
      <div class="task-body" data-action="edit" data-id="${task.id}">
        <div class="task-title">
          ${escHtml(task.title)}
          ${task.recurrence ? `<span class="task-recur-icon">${icon('repeat', 13)}</span>` : ''}
        </div>
        ${task.notes
          ? `<div class="task-notes">${escHtml(task.notes.slice(0,90))}${task.notes.length>90?'…':''}</div>`
          : ''}
        <div class="task-meta">
          ${cat ? `<span class="tag" style="background:${cat.color}18;color:${cat.color};border-color:${cat.color}30">
            ${icon('tag', 11)} ${escHtml(cat.name)}
          </span>` : ''}
          ${proj ? `<span class="tag" style="color:${proj.color};border-color:${proj.color}30">
            <span class="project-dot" style="background:${proj.color}"></span> ${escHtml(proj.name)}
          </span>` : ''}
          ${task.priority ? `<span class="tag ${priCls}">
            <span class="pri-dot" style="background:${priColor}"></span>${task.priority}
          </span>` : ''}
          ${dueFmt ? `<span class="tag due ${overdue?'due-overdue':''}">
            ${icon('calendar', 11)} ${dueFmt}
          </span>` : ''}
          ${task.attachments?.length ? `<span class="tag">
            ${icon('paperclip', 11)} ${task.attachments.length}
          </span>` : ''}
        </div>
      </div>
      <button class="task-delete" data-action="delete" data-id="${task.id}" aria-label="Poista">
        ${icon('x', 14)}
      </button>
      <div class="task-chevron">${icon('chevron-right', 15)}</div>
    </div>`;
}

function bindTaskViewEvents(container) {
  document.getElementById('btn-new-task')?.addEventListener('click', () => openTaskModal());
  document.getElementById('btn-search-toggle')?.addEventListener('click', toggleSearch);
  document.getElementById('search-input')?.addEventListener('input', e => {
    state.filter.search = e.target.value;
    renderMain();
  });

  // Status pills
  container.querySelectorAll('.status-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      state.filter.status = btn.dataset.status;
      renderMain();
    });
  });

  document.getElementById('filter-category')?.addEventListener('change', e => {
    state.filter.category = e.target.value; renderMain();
  });
  document.getElementById('filter-priority')?.addEventListener('change', e => {
    state.filter.priority = e.target.value; renderMain();
  });

  container.querySelectorAll('[data-action]').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      const { action, id } = el.dataset;
      if (action === 'toggle') toggleTask(id);
      if (action === 'delete') confirmDeleteTask(id);
      if (action === 'edit')   openTaskModal(id);
    });
  });
}

function toggleSearch() {
  const bar = document.getElementById('search-bar');
  bar?.classList.toggle('hidden');
  if (!bar?.classList.contains('hidden')) document.getElementById('search-input')?.focus();
}

// ---------------------------------------------------------------------------
// Tehtävän valmiiksi/avoin
// ---------------------------------------------------------------------------

function toggleTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  task.completed   = !task.completed;
  task.completedAt = task.completed ? new Date().toISOString() : null;
  saveTask(task);
  if (task.completed) {
    handleRecurrence(task);
    updateStreakOnComplete();
    cancelNotification(id);
  }
  state.tasks = getTasks();
  renderSidebar();
  renderBottomNav();
  renderMain();
}

function handleRecurrence(task) {
  if (!task.recurrence || !task.dueDate) return;
  const next = new Date(task.dueDate);
  if (task.recurrence === 'daily')   next.setDate(next.getDate() + 1);
  if (task.recurrence === 'weekly')  next.setDate(next.getDate() + 7);
  if (task.recurrence === 'monthly') next.setMonth(next.getMonth() + 1);
  saveTask({
    ...task,
    id: generateId(),
    completed: false,
    completedAt: null,
    dueDate: next.toISOString().slice(0, 10),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  state.tasks = getTasks();
}

function updateStreakOnComplete() {
  state.streak = updateStreak(state.streak);
  saveStreak(state.streak);
}

// ---------------------------------------------------------------------------
// Poisto + kumoa
// ---------------------------------------------------------------------------

function confirmDeleteTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  deleteTask(id);
  cancelNotification(id);
  state.tasks = getTasks();

  if (state.undoBuffer) {
    clearTimeout(state.undoBuffer.timeout);
    hideUndo();
  }
  const timeout = setTimeout(() => { hideUndo(); state.undoBuffer = null; }, 5000);
  state.undoBuffer = { task, timeout };
  showUndo(task.title);
  renderSidebar();
  renderBottomNav();
  renderMain();
}

function showUndo(title) {
  let toast = document.getElementById('undo-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'undo-toast';
    toast.className = 'undo-toast';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `
    <span>Poistettu: ${escHtml(title.slice(0, 30))}</span>
    <button id="btn-undo">Kumoa</button>
  `;
  toast.classList.add('visible');
  document.getElementById('btn-undo').addEventListener('click', undoDelete);
}

function hideUndo() {
  document.getElementById('undo-toast')?.classList.remove('visible');
}

function undoDelete() {
  if (!state.undoBuffer) return;
  clearTimeout(state.undoBuffer.timeout);
  saveTask(state.undoBuffer.task);
  state.tasks = getTasks();
  state.undoBuffer = null;
  hideUndo();
  renderSidebar();
  renderBottomNav();
  renderMain();
}

// ---------------------------------------------------------------------------
// Tehtävämodaali
// ---------------------------------------------------------------------------

function openTaskModal(taskId = null) {
  const task   = taskId ? state.tasks.find(t => t.id === taskId) : null;
  const isNew  = !task;
  const cats   = state.categories;
  const projs  = state.projects;
  const recOpts = [
    ['','Ei toistoa'],
    ['daily','Päivittäin'],
    ['weekly','Viikoittain'],
    ['monthly','Kuukausittain'],
  ];

  const modal = getOrCreateModal();
  modal.innerHTML = `
    <div class="modal-card task-modal">
      <div class="modal-drag-handle"></div>
      <div class="modal-header">
        <h2>${isNew ? 'Uusi tehtävä' : 'Muokkaa tehtävää'}</h2>
        <button class="icon-btn modal-close" id="modal-close" aria-label="Sulje">
          ${icon('x', 18)}
        </button>
      </div>
      <form id="task-form" autocomplete="off">
        <div class="form-group">
          <input class="form-input big-input" id="f-title" type="text"
            placeholder="Mitä pitää tehdä?" value="${escHtml(task?.title||'')}" required autofocus />
          <div class="suggestion-hint" id="suggestion-hint" hidden>
            ${icon('sparkles', 13)} <span id="suggestion-text"></span>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Muistiinpanot</label>
          <textarea class="form-input" id="f-notes" rows="3"
            placeholder="Lisätietoja (valinnainen)">${escHtml(task?.notes||'')}</textarea>
        </div>
        <div class="form-row">
          <div class="form-group flex-1">
            <label class="form-label">Kategoria</label>
            <select class="form-input" id="f-category">
              <option value="">— Valitse —</option>
              ${cats.map(c => `<option value="${c.id}" ${task?.category===c.id?'selected':''}>${c.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group flex-1">
            <label class="form-label">Prioriteetti</label>
            <select class="form-input" id="f-priority">
              <option value="matala"    ${(task?.priority||'matala')==='matala'?'selected':''}>Matala</option>
              <option value="keskitaso" ${task?.priority==='keskitaso'?'selected':''}>Keski</option>
              <option value="korkea"    ${task?.priority==='korkea'?'selected':''}>Korkea</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group flex-1">
            <label class="form-label">Projekti</label>
            <select class="form-input" id="f-project">
              <option value="">— Valitse —</option>
              ${projs.map(p => `<option value="${p.id}" ${task?.projectId===p.id?'selected':''}>
                ${escHtml(p.name)}
              </option>`).join('')}
            </select>
          </div>
          <div class="form-group flex-1">
            <label class="form-label">Toistuvuus</label>
            <select class="form-input" id="f-recurrence">
              ${recOpts.map(([v,l]) => `<option value="${v}" ${(task?.recurrence||'')=== v?'selected':''}>${l}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group flex-1">
            <label class="form-label">Eräpäivä</label>
            <input class="form-input" id="f-duedate" type="date" value="${task?.dueDate||''}" />
          </div>
          <div class="form-group flex-1">
            <label class="form-label">Kellonaika</label>
            <input class="form-input" id="f-duetime" type="time" value="${task?.dueTime||''}" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Muistutus</label>
          <input class="form-input" id="f-reminder" type="datetime-local"
            value="${task?.reminderAt ? task.reminderAt.slice(0,16) : ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Liitteet</label>
          <input type="file" id="f-attachments" accept="image/*,.pdf" multiple class="file-input" />
          <div class="attachment-list" id="attachment-list">
            ${(task?.attachments||[]).map(a => `
              <div class="attachment-chip" data-name="${escHtml(a.name)}">
                ${icon('paperclip', 12)}
                <span>${escHtml(a.name)}</span>
                <button type="button" class="att-remove" data-name="${escHtml(a.name)}" aria-label="Poista liite">
                  ${icon('x', 11)}
                </button>
              </div>`).join('')}
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="pill-btn ghost" id="modal-cancel">Peruuta</button>
          <button type="submit" class="pill-btn primary">
            ${icon('check', 14, 'btn-icon')} ${isNew ? 'Lisää tehtävä' : 'Tallenna'}
          </button>
        </div>
      </form>
    </div>
  `;

  showModal(modal);
  const attachments = [...(task?.attachments || [])];

  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);

  // Älykkäät kategoriaehdotukset
  const titleInput = document.getElementById('f-title');
  const hint       = document.getElementById('suggestion-hint');
  const hintText   = document.getElementById('suggestion-text');
  titleInput.addEventListener('input', () => {
    if (!state.settings.smartSuggestions) return;
    const suggested = suggestCategory(titleInput.value);
    const catSel    = document.getElementById('f-category');
    if (suggested && !catSel.value) {
      const cat = state.categories.find(c => c.id === suggested);
      hintText.textContent = `Kategoria-ehdotus: ${cat?.name || suggested}`;
      hint.hidden = false;
      catSel.value = suggested;
    } else if (!suggested) {
      hint.hidden = true;
    }
  });

  // Liitteiden käsittely
  document.getElementById('f-attachments').addEventListener('change', async e => {
    for (const file of e.target.files) {
      const dataUrl = await readFileAsDataUrl(file);
      attachments.push({ name: file.name, dataUrl });
      const list = document.getElementById('attachment-list');
      const chip = document.createElement('div');
      chip.className = 'attachment-chip';
      chip.dataset.name = file.name;
      chip.innerHTML = `
        ${icon('paperclip', 12)}
        <span>${escHtml(file.name)}</span>
        <button type="button" class="att-remove" data-name="${escHtml(file.name)}" aria-label="Poista liite">
          ${icon('x', 11)}
        </button>`;
      list.appendChild(chip);
    }
    e.target.value = '';
  });

  modal.addEventListener('click', e => {
    if (e.target.closest('.att-remove')) {
      const name = e.target.closest('.att-remove').dataset.name;
      const idx  = attachments.findIndex(a => a.name === name);
      if (idx >= 0) attachments.splice(idx, 1);
      e.target.closest('.attachment-chip')?.remove();
    }
  });

  document.getElementById('task-form').addEventListener('submit', async e => {
    e.preventDefault();
    const title = document.getElementById('f-title').value.trim();
    if (!title) return;

    const updated = {
      id: task?.id || generateId(),
      title,
      notes:      document.getElementById('f-notes').value.trim(),
      category:   document.getElementById('f-category').value,
      priority:   document.getElementById('f-priority').value,
      projectId:  document.getElementById('f-project').value,
      recurrence: document.getElementById('f-recurrence').value || null,
      dueDate:    document.getElementById('f-duedate').value || null,
      dueTime:    document.getElementById('f-duetime').value || null,
      reminderAt: document.getElementById('f-reminder').value
        ? new Date(document.getElementById('f-reminder').value).toISOString()
        : null,
      completed:   task?.completed || false,
      completedAt: task?.completedAt || null,
      attachments,
    };

    if (updated.reminderAt && getNotificationPermission() !== 'granted') {
      await requestNotificationPermission();
    }

    saveTask(updated);
    if (updated.reminderAt) scheduleNotification(updated);
    else cancelNotification(updated.id);

    state.tasks = getTasks();
    closeModal();
    renderSidebar();
    renderBottomNav();
    renderMain();
  });
}

// ---------------------------------------------------------------------------
// Projektimodaali
// ---------------------------------------------------------------------------

function openProjectModal(projectId = null) {
  const proj   = projectId ? state.projects.find(p => p.id === projectId) : null;
  const isNew  = !proj;
  const colors = ['#5b56f0','#f59e0b','#10b981','#ec4899','#14b8a6','#f97316','#8b5cf6','#06b6d4'];

  const modal = getOrCreateModal();
  modal.innerHTML = `
    <div class="modal-card">
      <div class="modal-drag-handle"></div>
      <div class="modal-header">
        <h2>${isNew ? 'Uusi projekti' : 'Muokkaa projektia'}</h2>
        <button class="icon-btn modal-close" id="modal-close" aria-label="Sulje">
          ${icon('x', 18)}
        </button>
      </div>
      <form id="proj-form">
        <div class="form-group">
          <label class="form-label">Nimi</label>
          <input class="form-input" id="fp-name" type="text" value="${escHtml(proj?.name||'')}" required autofocus />
        </div>
        <div class="form-group">
          <label class="form-label">Väri</label>
          <div class="color-picker">
            ${colors.map(c => `
              <button type="button" class="color-swatch ${proj?.color===c?'selected':''}"
                style="background:${c}" data-color="${c}" aria-label="Väri ${c}"></button>`).join('')}
          </div>
          <input type="hidden" id="fp-color" value="${proj?.color || colors[0]}" />
        </div>
        <div class="form-actions">
          ${!isNew ? `<button type="button" class="pill-btn danger" id="btn-delete-proj">Poista projekti</button>` : ''}
          <button type="button" class="pill-btn ghost" id="modal-cancel">Peruuta</button>
          <button type="submit" class="pill-btn primary">
            ${icon('check', 14, 'btn-icon')} ${isNew ? 'Luo projekti' : 'Tallenna'}
          </button>
        </div>
      </form>
    </div>`;

  showModal(modal);
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);

  modal.querySelectorAll('.color-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      modal.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
      document.getElementById('fp-color').value = sw.dataset.color;
    });
  });

  document.getElementById('btn-delete-proj')?.addEventListener('click', () => {
    if (!confirm('Poistetaanko projekti? Tehtävät säilyvät.')) return;
    deleteProject(proj.id);
    state.projects = getProjects();
    if (state.view === `project:${proj.id}`) state.view = 'inbox';
    closeModal(); renderSidebar(); renderBottomNav(); renderMain();
  });

  document.getElementById('proj-form').addEventListener('submit', e => {
    e.preventDefault();
    const updated = {
      id:    proj?.id || generateId(),
      name:  document.getElementById('fp-name').value.trim(),
      color: document.getElementById('fp-color').value,
      order: proj?.order ?? state.projects.length,
    };
    saveProject(updated);
    state.projects = getProjects();
    closeModal(); renderSidebar(); renderBottomNav(); renderMain();
  });
}

// ---------------------------------------------------------------------------
// Tilastonäkymä
// ---------------------------------------------------------------------------

function renderStats(container) {
  const tasks     = state.tasks;
  const total     = tasks.length;
  const completed = tasks.filter(t => t.completed).length;
  const active    = total - completed;
  const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;

  const today = new Date().toISOString().slice(0, 10);
  const week  = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const doneToday = tasks.filter(t => t.completed && t.completedAt?.slice(0,10) === today).length;
  const doneWeek  = tasks.filter(t => t.completed && t.completedAt?.slice(0,10) >= week).length;

  const byCat = state.categories.map(cat => {
    const catTotal = tasks.filter(t => t.category === cat.id).length;
    const catDone  = tasks.filter(t => t.category === cat.id && t.completed).length;
    return { ...cat, total: catTotal, done: catDone };
  }).filter(c => c.total > 0);

  const byPri = [
    { label:'Korkea',    key:'korkea',    color:'#dc2626' },
    { label:'Keski',     key:'keskitaso', color:'#d97706' },
    { label:'Matala',    key:'matala',    color:'#16a34a' },
  ].map(p => ({ ...p, count: tasks.filter(t => t.priority === p.key && !t.completed).length }));

  container.innerHTML = `
    <div class="topbar">
      <div class="topbar-left">
        <h1 class="topbar-greeting">Tilastot</h1>
        <p class="topbar-subtitle">Edistymisesi yhteenveto</p>
      </div>
      <div class="topbar-right">
        <div class="topbar-avatar">${icon('bar-chart', 18)}</div>
      </div>
    </div>
    <div class="view-content">
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-num">${total}</div>
          <div class="stat-label">Tehtävää yhteensä</div>
        </div>
        <div class="stat-card">
          <div class="stat-num success-col">${completed}</div>
          <div class="stat-label">Valmiita</div>
        </div>
        <div class="stat-card">
          <div class="stat-num">${doneToday}</div>
          <div class="stat-label">Valmis tänään</div>
        </div>
        <div class="stat-card">
          <div class="stat-num flame-col">
            ${icon('flame', 22)} ${state.streak.current}
          </div>
          <div class="stat-label">Päivittäinen putki</div>
        </div>
      </div>

      <div class="stats-section">
        <h3>Kokonaisedistyminen</h3>
        <div class="big-progress-bar">
          <div class="big-progress-fill" style="width:${pct}%"></div>
        </div>
        <div class="progress-labels">
          <span>${completed} valmis</span>
          <span>${pct}%</span>
          <span>${active} avoin</span>
        </div>
      </div>

      ${byCat.length > 0 ? `
      <div class="stats-section">
        <h3>Kategorioittain</h3>
        ${byCat.map(cat => {
          const p = cat.total > 0 ? Math.round((cat.done/cat.total)*100) : 0;
          return `
            <div class="cat-bar-row">
              <span class="cat-bar-label">${escHtml(cat.name)}</span>
              <div class="cat-bar-track">
                <div class="cat-bar-fill" style="width:${p}%;background:${cat.color}"></div>
              </div>
              <span class="cat-bar-pct">${cat.done}/${cat.total}</span>
            </div>`;
        }).join('')}
      </div>` : ''}

      ${doneWeek > 0 ? `
      <div class="stats-section">
        <h3>Viikon aikana valmistuneet</h3>
        ${renderWeekChart()}
      </div>` : ''}

      <div class="stats-section">
        <h3>Avoimet prioriteetin mukaan</h3>
        ${byPri.map(p => p.count > 0 ? `
          <div class="cat-bar-row">
            <span class="cat-bar-label">${p.label}</span>
            <div class="cat-bar-track">
              <div class="cat-bar-fill" style="width:${Math.min(100,p.count*12)}%;background:${p.color}"></div>
            </div>
            <span class="cat-bar-pct">${p.count}</span>
          </div>` : '').join('')}
      </div>
    </div>`;
}

function renderWeekChart() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const dateStr = d.toISOString().slice(0, 10);
    const count   = state.tasks.filter(t => t.completed && t.completedAt?.slice(0,10) === dateStr).length;
    days.push({ label: d.toLocaleDateString('fi-FI', { weekday:'short' }), count });
  }
  const max = Math.max(1, ...days.map(d => d.count));
  return `<div class="bar-chart">
    ${days.map(d => `
      <div class="bar-col">
        ${d.count > 0 ? `<div class="bar-count">${d.count}</div>` : ''}
        <div class="bar-fill" style="height:${Math.max(4, Math.round((d.count/max)*64))}px;background:var(--accent)"></div>
        <div class="bar-label">${d.label}</div>
      </div>`).join('')}
  </div>`;
}

// ---------------------------------------------------------------------------
// Asetukset-näkymä
// ---------------------------------------------------------------------------

function renderSettings(container) {
  const s = state.settings;
  container.innerHTML = `
    <div class="topbar">
      <div class="topbar-left">
        <h1 class="topbar-greeting">Asetukset</h1>
        <p class="topbar-subtitle">Sovelluksen mukauttaminen</p>
      </div>
      <div class="topbar-right">
        <div class="topbar-avatar">${icon('settings', 18)}</div>
      </div>
    </div>
    <div class="view-content">
      <div class="settings-list">
        <div class="settings-row">
          <div>
            <div class="setting-label">Teema</div>
            <div class="setting-desc">Vaalea, tumma tai järjestelmän mukaan</div>
          </div>
          <select class="form-input compact" id="s-theme">
            <option value="light"  ${s.theme==='light'?'selected':''}>Vaalea</option>
            <option value="dark"   ${s.theme==='dark'?'selected':''}>Tumma</option>
            <option value="system" ${s.theme==='system'?'selected':''}>Järjestelmä</option>
          </select>
        </div>
        <div class="settings-row">
          <div>
            <div class="setting-label">Ilmoitukset</div>
            <div class="setting-desc">Muistutukset erääntyville tehtäville</div>
          </div>
          <div class="toggle-group">
            ${renderNotifStatus()}
            <button class="pill-btn small" id="btn-notif">
              ${getNotificationPermission()==='granted'
                ? `${icon('check',13,'btn-icon')} Käytössä`
                : 'Ota käyttöön'}
            </button>
          </div>
        </div>
        <div class="settings-row">
          <div>
            <div class="setting-label">Älykkäät ehdotukset</div>
            <div class="setting-desc">Ehdota kategoriaa otsikon perusteella</div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="s-smart" ${s.smartSuggestions?'checked':''} />
            <span class="toggle-track"></span>
          </label>
        </div>
        <div class="settings-row">
          <div>
            <div class="setting-label">Pilvisynkronointi</div>
            <div class="setting-desc">
              Tila: <strong>${cloudStatusLabel(s.cloudStatus)}</strong><br>
              <small>Supabase-integraatio — ks. storage.js</small>
            </div>
          </div>
          <button class="pill-btn small" disabled>Ei käytössä</button>
        </div>
        <div class="settings-row">
          <div>
            <div class="setting-label">Kategoriat</div>
            <div class="setting-desc">Hallinnoi omia kategorioita</div>
          </div>
          <button class="pill-btn small ghost" id="btn-manage-cats">Hallinnoi</button>
        </div>
        <div class="settings-row danger-row">
          <div>
            <div class="setting-label">Tyhjennä kaikki data</div>
            <div class="setting-desc">Poistaa kaikki tehtävät ja asetukset</div>
          </div>
          <button class="pill-btn small danger" id="btn-clear">Tyhjennä</button>
        </div>
      </div>
    </div>`;

  document.getElementById('s-theme').addEventListener('change', e => {
    state.settings.theme = e.target.value;
    saveSettings(state.settings);
    applyTheme(state.settings.theme);
    renderSidebar();
  });
  document.getElementById('s-smart').addEventListener('change', e => {
    state.settings.smartSuggestions = e.target.checked;
    saveSettings(state.settings);
  });
  document.getElementById('btn-notif').addEventListener('click', async () => {
    const granted = await requestNotificationPermission();
    state.settings.notificationsEnabled = granted;
    saveSettings(state.settings);
    renderSettings(container);
    if (granted) showInstantNotification('Tehtävälista', 'Ilmoitukset ovat nyt käytössä.');
  });
  document.getElementById('btn-manage-cats').addEventListener('click', openCategoryManager);
  document.getElementById('btn-clear').addEventListener('click', () => {
    if (!confirm('Poistetaanko KAIKKI data? Tätä ei voi peruuttaa.')) return;
    import('./storage.js').then(m => { m.clearAllData(); location.reload(); });
  });
}

function renderNotifStatus() {
  const p = getNotificationPermission();
  if (p === 'granted') return `<span class="pill-status green">${icon('check',11)} Sallittu</span>`;
  if (p === 'denied')  return `<span class="pill-status red">${icon('x',11)} Estetty</span>`;
  return `<span class="pill-status gray">Ei pyydetty</span>`;
}

// ---------------------------------------------------------------------------
// Kategoriamanageri
// ---------------------------------------------------------------------------

function openCategoryManager() {
  const modal = getOrCreateModal();
  modal.innerHTML = `
    <div class="modal-card">
      <div class="modal-drag-handle"></div>
      <div class="modal-header">
        <h2>Kategoriat</h2>
        <button class="icon-btn modal-close" id="modal-close" aria-label="Sulje">
          ${icon('x', 18)}
        </button>
      </div>
      <div id="cat-list">
        ${state.categories.map(cat => `
          <div class="cat-row" data-id="${cat.id}">
            <span class="cat-dot" style="background:${cat.color}"></span>
            <span class="cat-name">${escHtml(cat.name)}</span>
            <button class="icon-btn" data-action="edit-cat" data-id="${cat.id}" aria-label="Muokkaa">${icon('edit',16)}</button>
            <button class="icon-btn" data-action="del-cat"  data-id="${cat.id}" aria-label="Poista">${icon('trash',16)}</button>
          </div>`).join('')}
      </div>
      <button class="pill-btn primary full-width" id="btn-add-cat">
        ${icon('plus',14,'btn-icon')} Lisää kategoria
      </button>
    </div>`;

  showModal(modal);
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('btn-add-cat').addEventListener('click', () => openCatEditor(null));

  modal.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.action === 'del-cat') {
        if (!confirm('Poistetaanko kategoria?')) return;
        deleteCategory(btn.dataset.id);
        state.categories = getCategories();
        openCategoryManager();
      }
      if (btn.dataset.action === 'edit-cat') openCatEditor(btn.dataset.id);
    });
  });
}

function openCatEditor(id) {
  const cat   = id ? state.categories.find(c => c.id === id) : null;
  const isNew = !cat;
  const modal = getOrCreateModal();
  modal.innerHTML = `
    <div class="modal-card">
      <div class="modal-drag-handle"></div>
      <div class="modal-header">
        <h2>${isNew ? 'Uusi kategoria' : 'Muokkaa'}</h2>
        <button class="icon-btn modal-close" id="modal-close" aria-label="Sulje">
          ${icon('x', 18)}
        </button>
      </div>
      <form id="cat-form">
        <div class="form-group">
          <label class="form-label">Nimi</label>
          <input class="form-input" id="fc-name" type="text" value="${escHtml(cat?.name||'')}" required autofocus />
        </div>
        <div class="form-group">
          <label class="form-label">Väri</label>
          <input class="form-input" id="fc-color" type="color" value="${cat?.color||'#5b56f0'}" />
        </div>
        <div class="form-actions">
          <button type="button" class="pill-btn ghost" id="modal-cancel">Peruuta</button>
          <button type="submit" class="pill-btn primary">
            ${icon('check',14,'btn-icon')} ${isNew ? 'Lisää' : 'Tallenna'}
          </button>
        </div>
      </form>
    </div>`;

  showModal(modal);
  document.getElementById('modal-close').addEventListener('click', openCategoryManager);
  document.getElementById('modal-cancel').addEventListener('click', openCategoryManager);

  document.getElementById('cat-form').addEventListener('submit', e => {
    e.preventDefault();
    saveCategory({
      id:    cat?.id || generateId(),
      name:  document.getElementById('fc-name').value.trim(),
      color: document.getElementById('fc-color').value,
    });
    state.categories = getCategories();
    openCategoryManager();
  });
}

// ---------------------------------------------------------------------------
// Modal-apufunktiot
// ---------------------------------------------------------------------------

function getOrCreateModal() {
  let overlay = document.getElementById('modal-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'modal-overlay';
    overlay.className = 'modal-overlay';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  }
  return overlay;
}

function showModal(overlay) {
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => {
    overlay.querySelector('input:not([type=hidden]),textarea,select,button:not([disabled])')?.focus();
  });
}

export function closeModal() {
  document.getElementById('modal-overlay')?.classList.remove('open');
  document.body.style.overflow = '';
}

// ---------------------------------------------------------------------------
// Teema-toggle
// ---------------------------------------------------------------------------

function toggleTheme() {
  const themes = ['light', 'dark', 'system'];
  const cur = state.settings.theme;
  state.settings.theme = themes[(themes.indexOf(cur) + 1) % themes.length];
  saveSettings(state.settings);
  applyTheme(state.settings.theme);
  renderSidebar();
}

// ---------------------------------------------------------------------------
// Muistutustarkistus
// ---------------------------------------------------------------------------

function checkDueReminders() {
  getSoonDueTasks(state.tasks, 1).forEach(task => {
    if (!task._notifiedSoon) {
      task._notifiedSoon = true;
      showInstantNotification('Pian erääntyvä', task.title);
    }
  });
}

// ---------------------------------------------------------------------------
// Service Worker
// ---------------------------------------------------------------------------

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Apufunktiot
// ---------------------------------------------------------------------------

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatDate(dateStr, timeStr) {
  const today    = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const suffix   = timeStr ? ` ${timeStr}` : '';
  if (dateStr === today)    return `Tänään${suffix}`;
  if (dateStr === tomorrow) return `Huomenna${suffix}`;
  const d = new Date(dateStr + 'T00:00');
  return d.toLocaleDateString('fi-FI', { day:'numeric', month:'short' }) + suffix;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
