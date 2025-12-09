// js/firebase-config.js
// ⚠️ ЗАМЕНИ эти значения на свои из консоли Firebase -> Project settings

// eslint-disable-next-line no-undef
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  appId: "YOUR_APP_ID"
};

// Инициализация Firebase (compat SDK)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Глобальная ссылка на auth
const auth = firebase.auth();
