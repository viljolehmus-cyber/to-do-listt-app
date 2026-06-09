/**
 * suggestions.js — Älykkäät ehdotukset (sääntöpohjainen, toimii offline)
 *
 * SUPABASE / LLM-koukku: korvaa suggestCategoryByKeywords() kutsulla
 * Claude / GPT API:lle kun käyttäjällä on verkkoyhteys ja API-avain.
 */

const KEYWORD_MAP = {
  work:    ['kokous','palaveri','työ','projekti','raportti','asiakas','myynti','budjetti','deadline','esitys','toimisto'],
  home:    ['kauppa','siivous','ruoka','korjaus','kodinhoito','pyykit','astiat','puutarha','lemmikki'],
  study:   ['tenttiä','lukea','kurssi','tehtävä','harjoitus','opiskelu','kirja','luento','deadline'],
  health:  ['lääkäri','treeni','juokseminen','lääke','hammaslääkäri','liikunta','nukkuminen','ruokavalio'],
  finance: ['lasku','maksu','vero','pankki','vakuutus','budjetti','säästö','sijoitus'],
};

export function suggestCategory(title) {
  if (!title) return null;
  const lower = title.toLowerCase();
  for (const [cat, keywords] of Object.entries(KEYWORD_MAP)) {
    if (keywords.some(kw => lower.includes(kw))) return cat;
  }
  return null;

  // SUPABASE/LLM-koukku (valinnainen):
  // const response = await fetch('/api/suggest-category', {
  //   method: 'POST', body: JSON.stringify({ title }), headers: { 'Content-Type': 'application/json' }
  // });
  // return (await response.json()).category;
}

export function suggestRecurrence(title, existingTasks) {
  const lower = title.toLowerCase();
  const recurring = ['päivittäin','joka päivä','viikoittain','joka viikko','kuukausittain'];
  if (recurring.some(kw => lower.includes(kw))) {
    if (lower.includes('päiv')) return 'daily';
    if (lower.includes('viik')) return 'weekly';
    if (lower.includes('kuuk')) return 'monthly';
  }
  // Jos sama otsikko on aiemmin lisätty useasti
  const similar = existingTasks.filter(t =>
    t.title.toLowerCase().includes(lower.slice(0, 8)) && t.recurrence
  );
  if (similar.length > 0) return similar[0].recurrence;
  return null;
}

export function getOverdueTasks(tasks) {
  const now = new Date();
  return tasks.filter(t => !t.completed && t.dueDate && new Date(t.dueDate) < now);
}

export function getSoonDueTasks(tasks, hoursAhead = 48) {
  const now = new Date();
  const cutoff = new Date(now.getTime() + hoursAhead * 3600 * 1000);
  return tasks.filter(t =>
    !t.completed && t.dueDate &&
    new Date(t.dueDate) >= now &&
    new Date(t.dueDate) <= cutoff
  );
}

export function getTodayTasks(tasks) {
  const today = new Date().toISOString().slice(0, 10);
  return tasks.filter(t =>
    !t.completed && (
      (t.dueDate && t.dueDate.slice(0, 10) <= today) ||
      t.priority === 'korkea'
    )
  ).sort((a, b) => {
    const pri = { korkea: 0, keskitaso: 1, matala: 2 };
    return (pri[a.priority] ?? 1) - (pri[b.priority] ?? 1);
  });
}

export function updateStreak(streak) {
  const today = new Date().toISOString().slice(0, 10);
  if (streak.lastDate === today) return streak;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const current = streak.lastDate === yesterday ? streak.current + 1 : 1;
  const longest = Math.max(current, streak.longest);
  return { current, longest, lastDate: today };
}
