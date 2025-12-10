let CURRENT_USER = null
let CURRENT_DOC_ID = null
let editor = null

// Ждём авторизацию
document.addEventListener("auth-changed", async (e) => {
  CURRENT_USER = e.detail.user
  if (!CURRENT_USER) return

  document.getElementById("notAuth").style.display = "none"
  document.getElementById("editorShell").style.display = ""

  initEditor()
})

async function initEditor() {
  const params = new URLSearchParams(location.search)
  CURRENT_DOC_ID = params.get("id")

  // создаём новый документ если id отсутствует
  if (!CURRENT_DOC_ID) {
    CURRENT_DOC_ID = "doc_" + Date.now()
    history.replaceState({}, "", "?id=" + CURRENT_DOC_ID)
  }

  // загрузка
  const data = await loadDocument()

  document.getElementById("docTitle").value = data?.title || ""

  // создаём редактор
  editor = new tiptapCore.Editor({
    element: document.querySelector("#editor"),
    extensions: [
      tiptapStarterKit.StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      tiptapExtensionUnderline.Underline,
      tiptapExtensionTextAlign.TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
    ],
    content: data?.html || "<p></p>",
    onUpdate: () => saveDocument(),
  })

  // слушаем title
  document
    .getElementById("docTitle")
    .addEventListener("input", () => saveDocument())

  initToolbar()
  renderTemplates()
}

// загрузка документа
async function loadDocument() {
  let data = null

  try {
    const snap = await db
      .collection("users")
      .doc(CURRENT_USER.uid)
      .collection("documents")
      .doc(CURRENT_DOC_ID)
      .get()

    if (snap.exists) data = snap.data()
  } catch (e) {
    console.error(e)
  }

  // fallback local
  if (!data) {
    const raw = localStorage.getItem(CURRENT_DOC_ID)
    if (raw) data = JSON.parse(raw)
  }

  return data
}

// сохранение
async function saveDocument() {
  if (!editor || !CURRENT_USER) return

  const title = document.getElementById("docTitle").value.trim()
  const html = editor.getHTML()

  const payload = {
    title: title || "Без названия",
    html,
    updated: Date.now(),
  }

  // Firestore
  await db
    .collection("users")
    .doc(CURRENT_USER.uid)
    .collection("documents")
    .doc(CURRENT_DOC_ID)
    .set(payload, { merge: true })

  // local backup
  localStorage.setItem(CURRENT_DOC_ID, JSON.stringify(payload))
}

// тулбар
function initToolbar() {
  document.querySelector(".editor-toolbar").addEventListener("click", (e) => {
    const btn = e.target.closest(".editor-btn")
    if (!btn) return

    const action = btn.dataset.action
    const chain = editor.chain().focus()

    switch (action) {
      case "undo":
        chain.undo().run()
        break
      case "redo":
        chain.redo().run()
        break
      case "bold":
        chain.toggleBold().run()
        break
      case "italic":
        chain.toggleItalic().run()
        break
      case "underline":
        chain.toggleUnderline().run()
        break
      case "h1":
        chain.toggleHeading({ level: 1 }).run()
        break
      case "h2":
        chain.toggleHeading({ level: 2 }).run()
        break
      case "h3":
        chain.toggleHeading({ level: 3 }).run()
        break
      case "align-left":
        chain.setTextAlign("left").run()
        break
      case "align-center":
        chain.setTextAlign("center").run()
        break
      case "align-right":
        chain.setTextAlign("right").run()
        break
      case "align-justify":
        chain.setTextAlign("justify").run()
        break
      case "bullet":
        chain.toggleBulletList().run()
        break
      case "ordered":
        chain.toggleOrderedList().run()
        break
      case "templates":
        openTemplatePopup()
        break
    }
  })
}

// Шаблоны (минимально, чтобы проверить работу)
function renderTemplates() {
  const list = document.getElementById("templateList")
  list.innerHTML = ""

  const tpl = [
    {
      name: "С пустого листа",
      html: "<p></p>",
    },
    {
      name: "Резюме",
      html:
        "<h1>Имя Фамилия</h1><p>Контакты...</p><h3>Опыт</h3><p>...</p>",
    },
  ]

  tpl.forEach((t) => {
    const div = document.createElement("div")
    div.className = "template-item"
    div.textContent = t.name
    div.onclick = () => {
      editor.commands.setContent(t.html)
      saveDocument()
      closeTemplatePopup()
    }
    list.appendChild(div)
  })

  document.getElementById("overlay").onclick = closeTemplatePopup
}

function openTemplatePopup() {
  document.getElementById("overlay").style.display = "block"
  document.getElementById("templatePopup").style.display = ""
}
function closeTemplatePopup() {
  document.getElementById("overlay").style.display = "none"
  document.getElementById("templatePopup").style.display = "none"
}
window.closeTemplatePopup = closeTemplatePopup

// экспорт
window.editorExportPDF = function () {
  const html = editor.getHTML()
  const wrap = document.createElement("div")
  wrap.innerHTML = html
  document.body.appendChild(wrap)
  html2pdf()
    .set({ filename: "document.pdf" })
    .from(wrap)
    .save()
    .then(() => wrap.remove())
}

window.editorExportDOCX = function () {
  const html =
    "<html><body>" + editor.getHTML() + "</body></html>"
  const blob = window.htmlDocx.asBlob(html)
  window.saveAs(blob, "document.docx")
}
