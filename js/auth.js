// js/auth.js

// Текущий пользователь и префикс для localStorage
window.CURRENT_USER = null;
window.USER_STORAGE_PREFIX = "guest_";

// Можно указать админов для отзывов и т.п.
window.ADMINS = [
  // "admin@mail.com"
];

function updateStoragePrefix(user) {
  if (user) {
    window.USER_STORAGE_PREFIX = user.uid + "_";
  } else {
    window.USER_STORAGE_PREFIX = "guest_";
  }
}

/* ---------- РЕНДЕР КНОПОК В ШАПКЕ ---------- */

function renderAuthButtons(user) {
  const blocks = document.querySelectorAll(".auth-buttons");
  blocks.forEach(block => {
    block.innerHTML = "";

    if (!user) {
      const signIn = document.createElement("button");
      signIn.className = "btn-primary";
      signIn.textContent = "Войти";
      signIn.addEventListener("click", handleSignIn);

      const register = document.createElement("button");
      register.className = "btn-primary";
      register.textContent = "Регистрация";
      register.addEventListener("click", handleRegister);

      block.append(signIn, register);
    } else {
      const label = document.createElement("span");
      label.className = "user-label";
      label.textContent = user.displayName || user.email || "Аккаунт";

      const logout = document.createElement("button");
      logout.className = "btn-primary";
      logout.textContent = "Выйти";
      logout.addEventListener("click", () => auth.signOut());

      block.append(label, logout);
    }
  });
}

/* ---------- ХЭНДЛЕРЫ ВХОДА / РЕГИСТРАЦИИ ---------- */

async function handleSignIn() {
  if (!window.firebase || !auth) {
    alert("Firebase не инициализирован. Проверьте firebase-config.js");
    return;
  }

  const useGoogle = confirm(
    "Нажмите OK, чтобы войти через Google.\nНажмите Отмена, чтобы войти по почте и паролю."
  );

  try {
    if (useGoogle) {
      const provider = new firebase.auth.GoogleAuthProvider();
      await auth.signInWithPopup(provider);
    } else {
      const email = prompt("Email для входа:");
      if (!email) return;
      const pass = prompt("Пароль:");
      if (!pass) return;
      await auth.signInWithEmailAndPassword(email.trim(), pass);
    }
  } catch (e) {
    console.error(e);
    alert("Ошибка входа: " + e.message);
  }
}

async function handleRegister() {
  if (!window.firebase || !auth) {
    alert("Firebase не инициализирован. Проверьте firebase-config.js");
    return;
  }

  try {
    const email = prompt("Email для регистрации:");
    if (!email) return;
    const pass = prompt("Пароль (минимум 6 символов):");
    if (!pass) return;

    const cred = await auth.createUserWithEmailAndPassword(email.trim(), pass);
    const name = prompt("Как к вам обращаться? (необязательно)");
    if (name) {
      await cred.user.updateProfile({ displayName: name });
    }
  } catch (e) {
    console.error(e);
    alert("Ошибка регистрации: " + e.message);
  }
}

/* ---------- OBSERVER СОСТОЯНИЯ АВТОРИЗАЦИИ ---------- */

if (typeof auth !== "undefined") {
  auth.onAuthStateChanged(user => {
    window.CURRENT_USER = user || null;
    updateStoragePrefix(user);
    renderAuthButtons(user);

    // кастомное событие для страниц, которым нужен uid
    document.dispatchEvent(
      new CustomEvent("auth-changed", { detail: { user: user || null } })
    );
  });
}

/* ---------- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ LOCALSTORAGE ---------- */

window.userStorage = {
  key(type, id) {
    // type: "doc" | "tpl" | "review"
    const base = window.USER_STORAGE_PREFIX || "guest_";
    return `${base}${type}_${id}`;
  },
  all(type) {
    const base = window.USER_STORAGE_PREFIX || "guest_";
    const prefix = `${base}${type}_`;
    return Object.keys(localStorage)
      .filter(k => k.startsWith(prefix))
      .sort()
      .reverse();
  }
};
