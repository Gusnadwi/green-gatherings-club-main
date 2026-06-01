import { supabase } from "@/integrations/supabase/client";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;
const PUSH_TIMEOUT_MS = 15000;

function withTimeout<T>(promise: Promise<T>, message: string) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(message)), PUSH_TIMEOUT_MS);
    }),
  ]);
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function authorizedFetch(path: string, init?: RequestInit) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Du måste vara inloggad");

  const response = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? "Kunde inte uppdatera notiser");
  }

  return response;
}

export function supportsPushNotifications() {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    Boolean(VAPID_PUBLIC_KEY)
  );
}

export async function getPushSubscription() {
  if (!supportsPushNotifications()) return null;
  const registration = await withTimeout(
    navigator.serviceWorker.ready,
    "Service worker blev inte redo. Stäng appen och öppna den från hemskärmen igen.",
  );
  return registration.pushManager.getSubscription();
}

export async function enablePushNotifications() {
  if (!supportsPushNotifications()) {
    throw new Error("Notiser stöds inte här ännu. Öppna appen från hemskärmen på iPhone.");
  }

  const permission = await withTimeout(
    Notification.requestPermission(),
    "iPhone svarade inte på notisfrågan. Kontrollera att appen är öppnad från hemskärmen.",
  );
  if (permission !== "granted") {
    throw new Error("Notiser är inte tillåtna");
  }

  const registration = await withTimeout(
    navigator.serviceWorker.ready,
    "Service worker blev inte redo. Stäng appen och öppna den från hemskärmen igen.",
  );
  const existing = await withTimeout(
    registration.pushManager.getSubscription(),
    "Kunde inte läsa notisstatus.",
  );
  const subscription =
    existing ??
    (await withTimeout(
      registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      }),
      "Kunde inte aktivera notiser. Kontrollera iPhone-inställningar för appen.",
    ));

  await withTimeout(
    authorizedFetch("/api/push-subscriptions", {
      method: "POST",
      body: JSON.stringify({ subscription }),
    }),
    "Kunde inte spara notisinställningen.",
  );

  return subscription;
}

export async function disablePushNotifications() {
  const subscription = await getPushSubscription();
  if (!subscription) return;

  await authorizedFetch("/api/push-subscriptions", {
    method: "DELETE",
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });

  await subscription.unsubscribe();
}

export async function notifyNewMessage(messageId: string) {
  await authorizedFetch("/api/notifications/message", {
    method: "POST",
    body: JSON.stringify({ messageId }),
  });
}
