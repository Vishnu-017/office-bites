import { apiCall } from '../api/client';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function toApplicationServerKey(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export async function registerPushForUser(token: string): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return;
  }

  const swRegistration = await navigator.serviceWorker.ready;
  const keyRes = await apiCall<{ public_key: string }>(`/api/push/vapid-public-key`, token);
  const appServerKey = toApplicationServerKey(urlBase64ToUint8Array(keyRes.public_key));

  let subscription = await swRegistration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await swRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: appServerKey,
    });
  }

  await apiCall('/api/push/subscribe', token, {
    method: 'POST',
    body: JSON.stringify({ subscription }),
  });
}
