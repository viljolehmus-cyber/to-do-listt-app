/**
 * notifications.js — Selaimen ilmoitukset ja muistutukset
 *
 * Rajoitukset: paikalliset ilmoitukset toimivat vain kun appi on auki tai
 * asennettuna PWA:na. Aidot push-ilmoitukset suljetulle appille vaativat
 * backend-palvelimen ja Web Push API -tilauksen (SUPABASE/FCM-integraatio).
 *
 * SUPABASE + push: rekisteröi PushSubscription backendille ja lähetä
 * ilmoitukset Web Push -protokollalla.
 */

let scheduledTimers = new Map(); // id -> timer handle

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function getNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export function scheduleNotification(task) {
  if (!task.reminderAt || !task.title) return;
  const fireAt = new Date(task.reminderAt).getTime();
  const now = Date.now();
  const delay = fireAt - now;
  if (delay <= 0) return;

  cancelNotification(task.id);

  const handle = setTimeout(() => {
    if (Notification.permission === 'granted') {
      new Notification('Muistutus', {
        body: task.title,
        icon: 'icons/icon-192.png',
        tag: `task-${task.id}`,
        requireInteraction: true,
      });
    }
    scheduledTimers.delete(task.id);
  }, delay);

  scheduledTimers.set(task.id, handle);
}

export function cancelNotification(taskId) {
  if (scheduledTimers.has(taskId)) {
    clearTimeout(scheduledTimers.get(taskId));
    scheduledTimers.delete(taskId);
  }
}

export function rescheduleAll(tasks) {
  tasks.forEach(task => {
    if (!task.completed && task.reminderAt) {
      scheduleNotification(task);
    }
  });
}

export function showInstantNotification(title, body) {
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: 'icons/icon-192.png' });
  }
}
