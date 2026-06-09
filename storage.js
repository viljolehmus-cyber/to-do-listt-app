/**
 * storage.js — Tietovarastokerros
 *
 * Kaikki data kulkee tämän rajapinnan kautta.
 * Supabase-integraatio: korvaa localStorage-kutsut Supabase-kutsuilla
 * merkatuissa kohdissa (// SUPABASE:).
 */

const STORAGE_KEYS = {
  TASKS: 'tehtavalista_tasks',
  PROJECTS: 'tehtavalista_projects',
  CATEGORIES: 'tehtavalista_categories',
  SETTINGS: 'tehtavalista_settings',
  STREAK: 'tehtavalista_streak',
};

// ---------------------------------------------------------------------------
// Tehtävät
// ---------------------------------------------------------------------------

export function getTasks() {
  // SUPABASE: return await supabase.from('tasks').select('*').eq('user_id', userId)
  const raw = localStorage.getItem(STORAGE_KEYS.TASKS);
  return raw ? JSON.parse(raw) : [];
}

export function saveTask(task) {
  // SUPABASE: return await supabase.from('tasks').upsert(task)
  const tasks = getTasks();
  const idx = tasks.findIndex(t => t.id === task.id);
  if (idx >= 0) {
    tasks[idx] = { ...tasks[idx], ...task, updatedAt: new Date().toISOString() };
  } else {
    tasks.push({ ...task, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }
  localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
  return tasks.find(t => t.id === task.id);
}

export function deleteTask(id) {
  // SUPABASE: return await supabase.from('tasks').delete().eq('id', id)
  const tasks = getTasks().filter(t => t.id !== id);
  localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
}

export function getTaskById(id) {
  return getTasks().find(t => t.id === id) || null;
}

// ---------------------------------------------------------------------------
// Projektit / listat
// ---------------------------------------------------------------------------

export function getProjects() {
  // SUPABASE: return await supabase.from('projects').select('*').eq('user_id', userId)
  const raw = localStorage.getItem(STORAGE_KEYS.PROJECTS);
  if (raw) return JSON.parse(raw);
  const defaults = [
    { id: 'inbox', name: 'Saapuneet', color: '#5b56f0', order: 0 },
    { id: 'work',  name: 'Työ',       color: '#f59e0b', order: 1 },
    { id: 'home',  name: 'Koti',      color: '#10b981', order: 2 },
  ];
  localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(defaults));
  return defaults;
}

export function saveProject(project) {
  // SUPABASE: return await supabase.from('projects').upsert(project)
  const projects = getProjects();
  const idx = projects.findIndex(p => p.id === project.id);
  if (idx >= 0) projects[idx] = project;
  else projects.push(project);
  localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
}

export function deleteProject(id) {
  // SUPABASE: return await supabase.from('projects').delete().eq('id', id)
  const projects = getProjects().filter(p => p.id !== id);
  localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
}

// ---------------------------------------------------------------------------
// Kategoriat / tunnisteet
// ---------------------------------------------------------------------------

export function getCategories() {
  // SUPABASE: return await supabase.from('categories').select('*').eq('user_id', userId)
  const raw = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
  if (raw) return JSON.parse(raw);
  const defaults = [
    { id: 'work',    name: 'Työ',       color: '#f59e0b' },
    { id: 'home',    name: 'Koti',      color: '#10b981' },
    { id: 'study',   name: 'Opiskelu',  color: '#6366f1' },
    { id: 'health',  name: 'Terveys',   color: '#ec4899' },
    { id: 'finance', name: 'Talous',    color: '#14b8a6' },
  ];
  localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(defaults));
  return defaults;
}

export function saveCategory(cat) {
  // SUPABASE: return await supabase.from('categories').upsert(cat)
  const cats = getCategories();
  const idx = cats.findIndex(c => c.id === cat.id);
  if (idx >= 0) cats[idx] = cat;
  else cats.push(cat);
  localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(cats));
}

export function deleteCategory(id) {
  // SUPABASE: return await supabase.from('categories').delete().eq('id', id)
  const cats = getCategories().filter(c => c.id !== id);
  localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(cats));
}

// ---------------------------------------------------------------------------
// Asetukset
// ---------------------------------------------------------------------------

export function getSettings() {
  const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
  const defaults = {
    theme: 'system',       // 'light' | 'dark' | 'system'
    cloudSync: false,      // SUPABASE: set true when authenticated
    cloudStatus: 'local',  // 'local' | 'synced' | 'syncing' | 'error'
    notificationsEnabled: false,
    defaultProjectId: 'inbox',
    defaultPriority: 'keskitaso',
    smartSuggestions: true,
  };
  return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
}

export function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
}

// ---------------------------------------------------------------------------
// Streak / putki
// ---------------------------------------------------------------------------

export function getStreak() {
  const raw = localStorage.getItem(STORAGE_KEYS.STREAK);
  return raw ? JSON.parse(raw) : { current: 0, longest: 0, lastDate: null };
}

export function saveStreak(streak) {
  localStorage.setItem(STORAGE_KEYS.STREAK, JSON.stringify(streak));
}

// ---------------------------------------------------------------------------
// Apufunktiot
// ---------------------------------------------------------------------------

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function clearAllData() {
  Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
}
