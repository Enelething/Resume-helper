let editor;
let DOC_KEY = null;
let user;

/// INIT
document.addEventListener("auth-changed", e => {
  user = e.detail.user;
  if (!user) {
    alert("Чтобы редактировать — войдите");
    location.href = "documents.html";
  } else {
    initEditor();
  }
});

function initEditor() {
  const params = new URLSearchParams(location.search);
  DOC_KEY = params.get("id");

  // Load from Firestore
  db.collection("users").doc(user.uid)
    .collection("documents").doc(DOC_KEY)
    .get()
    .then(doc => {
      const data = doc.data() || JSON.parse(localStorage.getItem(DOC_KEY) || "{}");
      loadEditor(data);
    });
}

function loadEditor(data) {
  document.getElementById("docTitle").value = data.title || "";

  editor = new tiptap.Editor({
    element: document.querySelector('#editor'),
    extensions: [
      tiptapStarterKit.StarterKit,
      tiptapExtensionHeading.Heading.configure({ levels: [1,2,3]}),
      tiptapExtensionUnderline.Underline,
      tiptapExtensionTextAlign.TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: data.html || "<p></p>",
    onUpdate: () => saveDocument()
  });
}

/// SAVE
function saveDocument() {
  const title = document.getElementById("docTitle").value.trim();
  const html = editor.getHTML();

  // Save local
  localStorage.setItem(DOC_KEY, JSON.stringify({ title, html }));

  // Save Firestore
  db.collection("users").doc(user.uid)
    .collection("documents").doc(DOC_KEY)
    .set({ title, html, updated: Date.now() })
    .catch(err => console.error(err));
}

document.getElementById("docTitle").addEventListener("input", saveDocument);

/// EXPORT
function exportPDF() {
  const html = editor.getHTML();
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);
  html2pdf().set({filename:"document.pdf"}).from(container).save()
    .then(()=>container.remove());
}

function exportDOCX() {
  const html = "<html><body>" + editor.getHTML() + "</body></html>";
  const blob = htmlDocx.asBlob(html);
  saveAs(blob, "document.docx");
}

/// FONT
function setFont(font) {
  document.querySelector('.editor-content').style.fontFamily = font;
}

/// TEMPLATE POPUP
function openTemplatePopup() {
  document.getElementById("overlay").style.display="block";
  document.getElementById("templatePopup").style.display="";
  renderTemplates();
}

function closeTemplatePopup() {
  document.getElementById("overlay").style.display="none";
  document.getElementById("templatePopup").style.display="none";
}

document.getElementById("overlay").onclick = closeTemplatePopup;

function renderTemplates() {
  const list = document.getElementById("templateList");
  list.innerHTML = "";
  READY_TEMPLATES.forEach(tpl => {
    const item = document.createElement("div");
    item.className="template-item";
    item.textContent = tpl.name;
    item.onclick = () => {
      editor.commands.setContent(tpl.html);
      closeTemplatePopup();
      saveDocument();
    };
    list.appendChild(item);
  });
}
