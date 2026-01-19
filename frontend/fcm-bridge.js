import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getMessaging, getToken, onMessage } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js';

console.log("[INIT] Script loaded");

const firebaseConfig = {
  apiKey: "AIzaSyBM8fqWaUQuZK6i2O34I6XRh9XbylA42Ks",
  projectId: "fleet-management-system-480308",
  messagingSenderId: "710551258034",
  appId: "1:710551258034:web:8726d26b3d890283761aab",
};

console.log("[INIT] Firebase config:", firebaseConfig);

// 🔥 Initialize Firebase
const app = initializeApp(firebaseConfig);
console.log("[INIT] Firebase initialized", app);

// 🔔 Messaging
const messaging = getMessaging(app);
console.log("[INIT] Firebase messaging initialized");

const btn = document.getElementById('register-btn');

if (!btn) {
  console.error("[ERROR] register-btn not found in DOM");
}

btn.addEventListener('click', async () => {
  console.log("========== FCM REGISTER CLICKED ==========");
  const btnText = document.getElementById("btn-text");
  const btnLoading = document.getElementById("btn-loading");

  btn.classList.add("loading");
  btn.disabled = true;
  btnText.style.display = "none";
  btnLoading.style.display = "inline";

  try {
    // 1️⃣ Check browser support
    console.log("[STEP 1] Checking browser support");
    console.log("ServiceWorker:", 'serviceWorker' in navigator);
    console.log("Notification:", 'Notification' in window);

    if (!('serviceWorker' in navigator)) {
      throw new Error("ServiceWorker not supported");
    }

    // 2️⃣ Request permission
    console.log("[STEP 2] Requesting notification permission...");
    const permission = await Notification.requestPermission();
    console.log("[STEP 2] Permission result:", permission);

    if (permission !== "granted") {
      alert("Notification permission denied");
      return;
    }

    // 3️⃣ Register Service Worker
    console.log("[STEP 3] Registering Service Worker...");
    const swRegistration = await navigator.serviceWorker.register('/assets/firebase-messaging-sw.js');
    console.log("[STEP 3] Service Worker registered:", swRegistration);

    // 4️⃣ Get FCM Token
    console.log("[STEP 4] Requesting FCM token...");
    const token = await getToken(messaging, {
      vapidKey: "BHWTmQlRQkZyACZh8ag1aUZkg5-vfczpj6VUZ6r9g979zLeIQiiHPbt30TNPk2wFGuwPu6vuA7Rh-SnlkcjgJ6w",
      serviceWorkerRegistration: swRegistration
    });

    if (!token) {
      throw new Error("FCM token is null");
    }

    console.log("✅ [SUCCESS] FCM TOKEN:", token);

    localStorage.setItem("fcm_token", token);
    console.log("💾 FCM token saved to localStorage");

    window.parent.location.reload();

    // 5️⃣ Send token to backend
    console.log("[STEP 5] Sending token to backend...");
    const response = await fetch("/api/fcm/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    console.log("[STEP 5] Backend response status:", response.status);

    const responseText = await response.text();
    console.log("[STEP 5] Backend response body:", responseText);

    // 6️⃣ Send token to parent window (ToolJet)
    console.log("[STEP 6] Sending token to parent window");
    window.parent.postMessage(
      { type: "FCM_READY", token },
      "*"
    );

    console.log("✅ [SUCCESS] FCM registered completely");

    // 7️⃣ Foreground messages
    console.log("[STEP 7] Register foreground message handler");
    onMessage(messaging, payload => {
      console.log("📩 [FOREGROUND MESSAGE]", payload);

      if (Notification.permission === "granted") {
        new Notification(
          payload.notification?.title || "Notification",
          {
            body: payload.notification?.body || JSON.stringify(payload),
          }
        );
      }
    });

  } catch (err) {
    btn.classList.remove("loading");
    btn.disabled = false;
    btnText.style.display = "inline";
    btnLoading.style.display = "none";

    console.error("❌ [FCM ERROR]", err);
    console.error("Name:", err.name);
    console.error("Message:", err.message);
    console.error("Stack:", err.stack);

    alert("FCM Error: " + err.message);
  }

  console.log("========== END FCM FLOW ==========");
});
