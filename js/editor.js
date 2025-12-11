// ===============================
// FIRESTORE-DRIVEN EDITOR LOGIC
// ===============================

// Требует: firebase-config.js (db, auth), auth.js (CURRENT_USER), templates-data.js
// --------------------------------------------

// Инициализация Quill (оставляем твою панель)
const quill = new Quill("#editor", {
  theme: "snow",
  modules: { toolbar: "#toolbar" }
});

// -------------------------
// Firestore collections
// -------------------------
const docsCol = db.collection("documents");
const templatesCol = db.collection("templates");

// -------------------------
// DOM references
// -------------------------
const titleInput = document.getElementById("docTitle");
const savedList = document.getElementById("savedList");
const templateGrid = document.getElementById("templateGrid");
const templatesSelect = document.getElementById("templatesSelect");

// =======================================================
// 1) LOAD TEMPLATE from ?template=
// =======================================================
async function loadTemplateFromQuery() {
  const params = new URLSearchParams(location.search);
  const tplKey = params.get("template");

  if (!tplKey) return;

  // Пользовательский шаблон (хранится в Firestore)
  if (tplKey.startsWith("user_")) {
    const id = tplKey.replace("user_", "");
    const snap = await templatesCol.doc(id).get();
    if (snap.exists) {
      const t = snap.data();
      titleInput.value = t.title;
      quill.clipboard.dangerouslyPasteHTML(t.html);
      return;
    }
  }

  // Встроенный шаблон READY_TEMPLATES
  const built = (window.READY_TEMPLATES || []).find(t => t.key === tplKey);
  if (built) {
    titleInput.value = built.title;
    quill.clipboard.dangerouslyPasteHTML(built.html);
  }
}

// =======================================================
// 2) SAVE DOCUMENT to FIRESTORE (keep same UI button)
// =======================================================
document.getElementById("saveLocal").onclick = async () => {
  const user = window.CURRENT_USER;
  if (!user) return alert("Войдите в аккаунт");

  const html = quill.root.innerHTML;
  const title = titleInput.value || "Без названия";

  // Создаём документ
  await docsCol.add({
    uid: user.uid,
    title,
    html,
    createdAt: Date.now()
  });

  alert("Документ сохранён в Firestore");
  loadUserDocs();
};

// =======================================================
// 3) LOAD USER DOCUMENTS FROM FIRESTORE
// =======================================================
async function loadUserDocs() {
  const user = window.CURRENT_USER;
  if (!user) {
    savedList.innerHTML = "<div class='muted'>Войдите чтобы видеть документы</div>";
    return;
  }

  const snap = await docsCol.where("uid", "==", user.uid).orderBy("createdAt", "desc").get();

  if (snap.empty) {
    savedList.innerHTML = "<div class='muted'>Документов нет</div>";
    return;
  }

  savedList.innerHTML = "";

  snap.forEach(doc => {
    const d = doc.data();

    const row = document.createElement("div");
    row.style.cssText = "margin-bottom:10px;display:flex;justify-content:space-between";

    row.innerHTML = `
      <div style="font-size:14px">
        <strong>${d.title}</strong><br>
        <span class="muted">${new Date(d.createdAt).toLocaleString()}</span>
      </div>
      <div>
        <button class="small" onclick="openDocFS('${doc.id}')">Открыть</button>
        <button class="small danger" onclick="deleteDocFS('${doc.id}')">Удалить</button>
      </div>
    `;

    savedList.appendChild(row);
  });
}

window.openDocFS = async function (id) {
  const snap = await docsCol.doc(id).get();
  if (!snap.exists) return;
  const d = snap.data();
  titleInput.value = d.title;
  quill.root.innerHTML = d.html;
};

window.deleteDocFS = async function (id) {
  if (!confirm("Удалить документ?")) return;
  await docsCol.doc(id).delete();
  loadUserDocs();
};

// =======================================================
// 4) LOAD TEMPLATES (built + user Firestore)
// =======================================================
async function loadTemplates() {
  templateGrid.innerHTML = "";
  templatesSelect.innerHTML = `<option value="">— Быстрые шаблоны —</option>`;

  // Встроенные шаблоны
  (window.READY_TEMPLATES || []).forEach(t => {
    renderTemplateCard(t.key, t.title, t.html, false);

    const opt = document.createElement("option");
    opt.value = t.key;
    opt.textContent = t.title;
    templatesSelect.appendChild(opt);
  });

  // Пользовательские шаблоны Firestore
  const user = window.CURRENT_USER;
  if (!user) return;

  const snap = await templatesCol.where("uid", "==", user.uid).orderBy("createdAt", "desc").get();

  snap.forEach(doc => {
    const t = doc.data();
    const key = "user_" + doc.id;

    renderTemplateCard(key, t.title, t.html, true);

    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = t.title;
    templatesSelect.appendChild(opt);
  });
}

function renderTemplateCard(key, title, html, isUser) {
  const div = document.createElement("div");
  div.className = "template-card";

  div.innerHTML = `
      <div><strong>${title}</strong></div>
      <div class="tpl-preview">${html.replace(/<[^>]+>/g, "").slice(0, 160)}...</div>
      <div class="template-actions">
        <button class="small" onclick="insertTemplateFS('${key}')">Вставить</button>
        <button class="small action-btn" onclick="loadTemplateFS('${key}')">Открыть</button>
      </div>
    `;

  templateGrid.appendChild(div);
}

// вставка шаблона
window.insertTemplateFS = async function (key) {
  const html = await getTemplateHTML(key);
  if (!html) return;

  const range = quill.getSelection(true) || { index: quill.getLength() };
  quill.clipboard.dangerouslyPasteHTML(range.index, html);
};

// загрузка шаблона в редактор
window.loadTemplateFS = async function (key) {
  const html = await getTemplateHTML(key);
  if (!html) return;

  quill.setContents([]);
  quill.clipboard.dangerouslyPasteHTML(html);
};

// получение HTML шаблона
async function getTemplateHTML(key) {
  // built template
  const built = (window.READY_TEMPLATES || []).find(t => t.key === key);
  if (built) return built.html;

  // user template
  if (key.startsWith("user_")) {
    const id = key.replace("user_", "");
    const snap = await templatesCol.doc(id).get();
    if (snap.exists) return snap.data().html;
  }

  return null;
}

// =======================================================
// 5) SAVE AS TEMPLATE (your existing UI button)
// =======================================================
document.getElementById("saveAsTemplate").onclick = async () => {
  const user = window.CURRENT_USER;
  if (!user) return alert("Войдите чтобы сохранять шаблоны");

  const html = quill.root.innerHTML;
  const title = prompt("Название шаблона:") || "Новый шаблон";

  await templatesCol.add({
    uid: user.uid,
    title,
    html,
    createdAt: Date.now()
  });

  alert("Шаблон сохранён");
  loadTemplates();
};

// =======================================================
// LOAD EVERYTHING AFTER AUTH
// =======================================================
document.addEventListener("auth-changed", () => {
  loadTemplates();
  loadUserDocs();
  loadTemplateFromQuery();
});

// First load if user already logged
if (window.CURRENT_USER) {
  loadTemplates();
  loadUserDocs();
  loadTemplateFromQuery();
}
