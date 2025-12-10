// ==== Глобальные переменные ====
let editor = null;
let CURRENT_USER = null;
let DOC_KEY = null;

// ==== Событие авторизации ====
document.addEventListener("auth-changed", async e => {
  CURRENT_USER = e.detail.user;

  const notAuth = document.getElementById("notAuth");
  const shell = document.getElementById("editorShell");

  if (!CURRENT_USER) {
    notAuth.style.display = "";
    shell.style.display = "none";
    return;
  }

  notAuth.style.display = "none";
  shell.style.display = "";

  if (!editor) {
    await initEditor();
  }
});

// ==== Инициализация ====
async function initEditor() {
  const params = new URLSearchParams(location.search);
  DOC_KEY = params.get("id");
  if (!DOC_KEY) {
    alert("Ошибка: editor.html?id=ключ_документа");
    return;
  }

  // 1) Загружаем из Firestore
  let data = null;
  try {
    const snap = await db
      .collection("users").doc(CURRENT_USER.uid)
      .collection("documents").doc(DOC_KEY)
      .get();
    if (snap.exists) {
      data = snap.data();
    }
  } catch(e) {
    console.error("Firestore load error:", e);
  }

  // 2) Если нет — localStorage (старые документы)
  if (!data) {
    const raw = localStorage.getItem(DOC_KEY);
    if (raw) data = JSON.parse(raw);
  }

  const titleInput = document.getElementById("docTitle");
  titleInput.value = (data && data.title) || "";

  // ==== Создаём редактор ====
  editor = new tiptapCore.Editor({
    element: document.querySelector("#editor"),
    extensions: [
      tiptapStarterKit.StarterKit.configure({
        heading: { levels: [1,2,3] }
      }),
      tiptapExtensionUnderline.Underline,
      tiptapExtensionTextAlign.TextAlign.configure({
        types: ["heading", "paragraph"]
      })
    ],
    content: (data && data.html) || "<p></p>",
    onUpdate: () => {
      saveDocument();
      updateToolbar();
    }
  });

  // title auto save
  titleInput.addEventListener("input", saveDocument);

  // toolbar listeners
  initToolbar();
  renderTemplatePopup();

  // default font
  document.querySelector(".editor-content").style.fontFamily =
    document.getElementById("fontSelect").value;
}

// ==== Сохранение ====
async function saveDocument() {
  if (!editor || !CURRENT_USER || !DOC_KEY) return;

  const title = document.getElementById("docTitle").value.trim();
  const html = editor.getHTML();
  const payload = {
    title: title || "Без названия",
    html,
    updated: Date.now()
  };

  // Local
  localStorage.setItem(DOC_KEY, JSON.stringify(payload));

  // Firestore
  try {
    await db.collection("users").doc(CURRENT_USER.uid)
      .collection("documents").doc(DOC_KEY)
      .set(payload, { merge:true });
  } catch(e) {
    console.error("Firestore save error:", e);
  }
}

// ==== Toolbar ====
function initToolbar() {
  const toolbar = document.querySelector(".editor-toolbar");
  toolbar.addEventListener("click", e => {
    const btn = e.target.closest(".editor-btn");
    if (!btn) return;
    handleToolbar(btn.dataset.action);
  });

  editor.on("selectionUpdate", updateToolbar);
  editor.on("transaction", updateToolbar);
}

function handleToolbar(action) {
  const chain = editor.chain().focus();
  switch(action) {
    case "undo": chain.undo().run(); break;
    case "redo": chain.redo().run(); break;

    case "bold": chain.toggleBold().run(); break;
    case "italic": chain.toggleItalic().run(); break;
    case "underline": chain.toggleUnderline().run(); break;

    case "h1": chain.toggleHeading({ level:1 }).run(); break;
    case "h2": chain.toggleHeading({ level:2 }).run(); break;
    case "h3": chain.toggleHeading({ level:3 }).run(); break;

    case "align-left": chain.setTextAlign("left").run(); break;
    case "align-center": chain.setTextAlign("center").run(); break;
    case "align-right": chain.setTextAlign("right").run(); break;
    case "align-justify": chain.setTextAlign("justify").run(); break;

    case "bullet": chain.toggleBulletList().run(); break;
    case "ordered": chain.toggleOrderedList().run(); break;

    case "templates": openTemplatePopup(); break;
  }
}

function updateToolbar() {
  const toolbar = document.querySelector(".editor-toolbar");
  const get = a => toolbar.querySelector(`.editor-btn[data-action="${a}"]`);

  [["bold","bold"],["italic","italic"],["underline","underline"],
   ["h1", ["heading",{level:1}]],
   ["h2", ["heading",{level:2}]],
   ["h3", ["heading",{level:3}]],
   ["bullet","bulletList"],
   ["ordered","orderedList"],
  ].forEach(([action,test])=>{
    const btn = get(action);
    if(!btn) return;
    const active = Array.isArray(test)
      ? editor.isActive(test[0],test[1])
      : editor.isActive(test);
    btn.classList.toggle("active",active);
  });
}

// ==== Templates ====
function renderTemplatePopup() {
  const list = document.getElementById("templateList");
  list.innerHTML = "";
  READY_TEMPLATES.forEach(tpl => {
    const item = document.createElement("div");
    item.className = "template-item";
    item.textContent = tpl.name;
    item.onclick = ()=>{
      editor.commands.setContent(tpl.html);
      saveDocument();
      closeTemplatePopup();
    };
    list.appendChild(item);
  });

  document.getElementById("overlay").onclick = closeTemplatePopup;
}

function openTemplatePopup() {
  document.getElementById("overlay").style.display="block";
  document.getElementById("templatePopup").style.display="";
}

function closeTemplatePopup() {
  document.getElementById("overlay").style.display="none";
  document.getElementById("templatePopup").style.display="none";
}

window.closeTemplatePopup = closeTemplatePopup;

// ==== Export ====
window.editorExportPDF = function() {
  const html = editor.getHTML();
  const wrap = document.createElement("div");
  wrap.innerHTML = html;
  document.body.appendChild(wrap);
  html2pdf().set({filename:"document.pdf"}).from(wrap).save()
    .then(()=>wrap.remove());
};

window.editorExportDOCX = function() {
  const html = "<html><body>"+editor.getHTML()+"</body></html>";
  const blob = window.htmlDocx.asBlob(html);
  window.saveAs(blob,"document.docx");
};
