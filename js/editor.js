let CURRENT_USER = null
let CURRENT_DOC_ID = null
let quill = null

// Запускаем editor если user уже есть
firebase.auth().onAuthStateChanged(user => {
  if (user) startEditor(user)
})

// Ловим custom event
document.addEventListener("auth-changed", e => {
  startEditor(e.detail.user)
})

function startEditor(user) {
  if (!user) return

  CURRENT_USER = user
  document.getElementById("notAuth").style.display = "none"
  document.getElementById("editorShell").style.display = ""

  initEditor()
}

async function initEditor() {
  const params = new URLSearchParams(location.search)
  CURRENT_DOC_ID = params.get("id") || ("doc_" + Date.now())

  history.replaceState({}, "", "?id=" + CURRENT_DOC_ID)

  const data = await loadDocument()

  document.getElementById("docTitle").value = data?.title || ""

  quill = new Quill('#editor', {
    theme: 'snow',
    modules: {
      toolbar: '#toolbar'
    }
  })

  if (data?.html)
    quill.root.innerHTML = data.html

  quill.on('text-change', debounce(saveDocument, 500))
  document.getElementById("docTitle").addEventListener("input", debounce(saveDocument, 500))

  document.getElementById("btnPDF").onclick = exportPDF
  document.getElementById("btnDOCX").onclick = exportDOCX
  document.getElementById("btnTemplates").onclick = openTemplates

  loadTemplates()
}

async function loadDocument() {
  let data = null

  try {
    const snap = await db.collection("users")
      .doc(CURRENT_USER.uid)
      .collection("documents")
      .doc(CURRENT_DOC_ID)
      .get()

    if (snap.exists) data = snap.data()
  } catch {}

  if (!data) {
    const raw = localStorage.getItem(CURRENT_DOC_ID)
    if (raw) data = JSON.parse(raw)
  }

  return data
}

async function saveDocument() {
  if (!CURRENT_USER) return

  const title = document.getElementById("docTitle").value.trim()
  const html = quill.root.innerHTML

  const payload = {
    title: title || "Без названия",
    html,
    updated: Date.now()
  }

  await db.collection("users")
    .doc(CURRENT_USER.uid)
    .collection("documents")
    .doc(CURRENT_DOC_ID)
    .set(payload, { merge: true })

  localStorage.setItem(CURRENT_DOC_ID, JSON.stringify(payload))
}

function exportDOCX() {
  const html = "<html><body>" + quill.root.innerHTML + "</body></html>"
  const blob = window.htmlDocx.asBlob(html)
  saveAs(blob, "document.docx")
}

function exportPDF() {
  let elem = document.createElement("div")
  elem.innerHTML = quill.root.innerHTML
  document.body.appendChild(elem)
  html2pdf().from(elem).set({ filename: 'document.pdf' }).save().then(() => elem.remove())
}

function openTemplates() {
  document.getElementById("overlay").style.display = "block"
  document.getElementById("templatesPopup").style.display = ""
}

function closeTemplates() {
  document.getElementById("overlay").style.display = "none"
  document.getElementById("templatesPopup").style.display = "none"
}
window.closeTemplates = closeTemplates

function loadTemplates() {
  const list = document.getElementById("templatesList")
  list.innerHTML = ""

  const templates = [
    { name: "Пустой документ", html: "<p><br></p>" },
    { name: "Резюме", html: "<h1>Имя Фамилия</h1><p>Контакты...</p>" },
    { name: "Сопроводительное письмо", html: "<p>Уважаемый HR!</p>" }
  ]

  templates.forEach(t => {
    const div = document.createElement("div")
    div.className = "template-item"
    div.textContent = t.name
    div.onclick = () => {
      quill.root.innerHTML = t.html
      saveDocument()
      closeTemplates()
    }
    list.appendChild(div)
  })
}

function debounce(fn, ms) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}
