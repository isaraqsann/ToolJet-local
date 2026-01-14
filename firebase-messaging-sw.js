importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBM8fqWaUQuZK6i2O34I6XRh9XbylA42Ks",
  authDomain: "fleet-management-system-480308.firebaseapp.com",
  projectId: "fleet-management-system-480308",
  messagingSenderId: "710551258034",
  appId: "1:710551258034:web:8726d26b3d890283761aab",
});

const messaging = firebase.messaging();

// 🔔 Background notification
messaging.onBackgroundMessage(function (payload) {
  console.log("[SW] Received background message", payload);

  self.registration.showNotification(
    payload.notification.title,
    {
      body: payload.notification.body,
      data: payload.data || {},
    }
  );
});

// 👉 Klik notif → buka ToolJet
self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  const url = event.notification.data?.url || "/";
  event.waitUntil(clients.openWindow(url));
});
