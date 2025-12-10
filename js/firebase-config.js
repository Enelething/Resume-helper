// js/firebase-config.js
// ⚠️ ЗАМЕНИ эти значения на свои из консоли Firebase -> Project settings

// eslint-disable-next-line no-undef
const firebaseConfig = {
  apiKey: "AIzaSyDd_ysglYh0LNAQpNbw4T3fNJRYUlb8OLs",
  authDomain: "resumehelp-a77a1.firebaseapp.com",
  projectId: "resumehelp-a77a1",
  storageBucket: "resumehelp-a77a1.firebasestorage.app",
  messagingSenderId: "828750912790",
  appId: "1:828750912790:web:c382cb0197181aa72b8437"
};

// Инициализация Firebase (compat SDK)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Глобальная ссылка на auth
const auth = firebase.auth();

