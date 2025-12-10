// ==== Firebase (global compat) ====
// firebase & db уже должны быть подключены из auth.js

let CURRENT_USER = null;
let CURRENT_DOC_ID = null;
let quill = null;

// ==== слушаем auth ====
document.addEventListener("auth-changed", async e => {
  CURRENT_USER = e.detail.user;
  if (!CURRENT_USER) return;

  initEditor();
});

// ==== Editor init ====
async function initEditor() {
  // читаем id из URL
  const params = new URLSearchParams(location.search);
  CURRENT_DOC_ID = params.get("id");

  // создаём новый если не указан
  if (!CURRENT_DOC_ID) {
    CURRENT_DOC_ID = "doc_" + Date.now();
    history.replaceState({}, "", "?id=" + CURRENT_DOC_ID);
  }

  // init Quill
  quill = new Quill('#editor', {
    theme: 'snow',
    modules: { toolbar: '#toolbar' }
  });

  // загрузка документа
  await loadDocument();

  // авто-сохранение
  quill.on('text-change', debounce(saveDocument, 600));

  document.getElementById("docTitle").addEventListener("input", debounce(saveDocument, 600));

  // UI кнопки
  bindUI();
}

// ==== загрузка документа ====
async function loadDocument() {
  let data = null;

  // 1. Firebase
  try {
    const snap = await db.collection("users")
      .doc(CURRENT_USER.uid)
      .collection("documents")
      .doc(CURRENT_DOC_ID)
      .get();

    if (snap.exists) data = snap.data();
  } catch(e) {
    console.error(e);
  }

  // 2. fallback local
  if (!data) {
    const raw = localStorage.getItem(CURRENT_DOC_ID);
    if (raw) data = JSON.parse(raw);
  }

  // устанавливаем данные
  if (data) {
    document.getElementById("docTitle").value = data.title;
    quill.setContents(quill.clipboard.convert(data.html));
  } else {
    document.getElementById("docTitle").value = "";
  }
}


// ==== сохранение ====
async function saveDocument() {
  if (!quill || !CURRENT_USER) return;

  const html = quill.root.innerHTML;
  const title = document.getElementById("docTitle").value.trim();

  const payload = {
    html,
    title: title || "Без названия",
    updated: Date.now()
  };

  // Firestore
  try {
    await db.collection("users")
      .doc(CURRENT_USER.uid)
      .collection("documents")
      .doc(CURRENT_DOC_ID)
      .set(payload, { merge: true });
  } catch(e) {
    console.error("save error", e);
  }

  // local backup
  localStorage.setItem(CURRENT_DOC_ID, JSON.stringify(payload));
}


// ==== UI функции ====
function bindUI() {
  document.getElementById("saveLocal")
    .addEventListener("click", saveDocument);

  document.getElementById("exportDocx")
    .addEventListener("click", exportDocx);

  document.getElementById("exportPdf")
    .addEventListener("click", exportPdf);

  document.getElementById("clearEditor")
    .addEventListener("click", () => {
      quill.setContents([]);
      saveDocument();
    });
}


// ==== Export DOCX ====
function exportDocx() {
  const html = `<html><body>${quill.root.innerHTML}</body></html>`;
  const blob = window.htmlDocx.asBlob(html);
  window.saveAs(blob, "document.docx");
}


// ==== Export PDF ====
function exportPdf() {
  const elem = document.createElement("div");
  elem.innerHTML = quill.root.innerHTML;
  document.body.appendChild(elem);

  html2pdf()
    .set({ filename: "document.pdf" })
    .from(elem)
    .save()
    .then(()=>elem.remove());
}


// ==== debounce helper ====
function debounce(fn, ms) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(()=>fn.apply(this, args), ms);
  };
}
