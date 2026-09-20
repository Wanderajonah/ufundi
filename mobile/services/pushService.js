// Push notifications disabled — expo-notifications removed.
// All exports are no-ops so existing imports in App.js continue to work.

export function getProjectId() {
  return null;
}

export function getNotificationHandler() {
  return null;
}

export async function registerForPushNotifications() {
  return null;
}

export async function getInitialNotificationData() {
  return null;
}

export function addNotificationResponseListener(_callback) {
  return { remove() {} };
}
