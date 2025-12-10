// js/editor.js
// Модульный скрипт (type="module" в editor.html)

import { Editor } from 'https://esm.sh/@tiptap/core@2';
import StarterKit from 'https://esm.sh/@tiptap/starter-kit@2';
import Underline from 'https://esm.sh/@tiptap/extension-underline@2';
import TextAlign from 'https://esm.sh/@tiptap/extension-text-align@2';

// ---------- Встроенные шаблоны (как в templates.html, укороченный набор) ----------
const READY_TEMPLATES = [
  {
    key: 'built_resume',
    name: 'Резюме (базовый)',
    desc: 'Структура: контакты, опыт, образование, навыки.',
    html: `
      <h1>Имя Фамилия</h1>
      <h3>Контакты</h3>
      <p>Телефон: +7 ___ ___-__-__<br>Email: example@mail.com<br>Город: __________</p>
      <h3>О себе</h3>
      <p>Кратко опишите ваш опыт и сильные стороны.</p>
      <h3>Опыт работы</h3>
      <ul>
        <li><strong>Должность — Компания</strong><br>Период: _______<br>Основные задачи и достижения: …</li>
      </ul>
      <h3>Образование</h3>
      <p>ВУЗ, специальность, годы обучения.</p>
      <h3>Навыки</h3>
      <ul>
        <li>Навык 1</li>
        <li>Навык 2</li>
      </ul>
    `
  },
  {
    key: 'built_cover',
    name: 'Сопроводительное письмо',
    desc: 'Универсальный деловой шаблон для отклика на вакансию.',
    html: `
      <p>Уважаемый(ая) [Имя/HR],</p>
      <p>Меня заинтересовала вакансия [Название позиции] в вашей компании. Мой опыт в сфере [сфера] включает [основные достижения].</p>
      <p>Считаю, что могу быть полезен(а) вашей команде благодаря [2–3 сильные стороны].</p>
      <p>Буду рад(а) обсудить, как мои навыки помогут решить задачи вашей компании.</p>
      <p>С уважением,<br>[Имя Фамилия]</p>
    `
  },
  {
    key: 'built_offer',
    name: 'Коммерческое предложение',
    desc: 'Шаблон для отправки клиенту.',
    html: `
      <h1>Коммерческое предложение</h1>
      <p>Уважаемый(ая) клиент,</p>
      <p>Предлагаем вам услугу/продукт [название] на следующих условиях:</p>
      <ul>
        <li>Краткое описание предложения;</li>
        <li>Ключевые преимущества;</li>
        <li>Стоимость и сроки;</li>
      </ul>
      <p>Готовы ответить на любые вопросы и обсудить детали сотрудничества.</p>
      <p>С уважением,<br>[Ваша компания]</p>
    `
  },
  {
    key: 'built_statement',
    name: 'Заявление',
    desc: 'Классическое заявление.',
    html: `
      <p>Руководителю _________<br>от ____________</p>
      <h3 style="text-align:center;margin-top:20px;">Заявление</h3>
      <p>Прошу _____________</p>
      <p>Дата _____________ Подпись ________</p>
    `
  }
];

let editor = null;
let CURRENT_USER = null;
let DOC_KEY = null;

// ---------- Хелперы Firestore ----------

async function loadDocumentFromFirestore(uid, docKey) {
  try {
    const snap = await db
      .collection('users')
      .doc(uid)
      .collection('documents')
      .doc(docKey)
      .get();

    if (!snap.exists) return null;
    return snap.data();
  } catch (e) {
    console.error('Ошибка загрузки из Firestore', e);
    return null;
  }
}

async function saveDocumentToFirestore(uid, docKey, payload) {
  try {
    await db
      .collection('users')
      .doc(uid)
      .collection('documents')
      .doc(docKey)
      .set(payload, { merge: true });
  } catch (e) {
    console.error('Ошибка сохранения в Firestore', e);
  }
}

// ---------- Инициализация ----------

document.addEventListener('auth-changed', async (e) => {
  CURRENT_USER = e.detail.user;

  const notAuth = document.getElementById('notAuth');
  const shell = document.getElementById('editorShell');

  if (!CURRENT_USER) {
    notAuth.style.display = '';
    shell.style.display = 'none';
    return;
  }

  notAuth.style.display = 'none';
  shell.style.display = '';

  if (!editor) {
    await initEditor();
  }
});

async function initEditor() {
  const params = new URLSearchParams(window.location.search);
  DOC_KEY = params.get('id');

  if (!DOC_KEY) {
    alert('Не передан id документа в URL (editor.html?id=...)');
    return;
  }

  // Пытаемся загрузить из Firestore
  let data = await loadDocumentFromFirestore(CURRENT_USER.uid, DOC_KEY);

  // Если нет — пробуем localStorage (старые документы)
  if (!data) {
    const localRaw = localStorage.getItem(DOC_KEY);
    if (localRaw) {
      data = JSON.parse(localRaw);
    }
  }

  const titleInput = document.getElementById('docTitle');
  titleInput.value = (data && data.title) || '';

  editor = new Editor({
    element: document.querySelector('#editor'),
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] }
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph']
      })
    ],
    content: (data && data.html) || '<p></p>',
    onUpdate: () => {
      saveDocument();
    }
  });

  // Смена шрифта
  const fontSelect = document.getElementById('fontSelect');
  fontSelect.addEventListener('change', () => {
    document.querySelector('.editor-content').style.fontFamily = fontSelect.value;
  });

  // Сохраняем при изменении названия
  titleInput.addEventListener('input', saveDocument);

  // Навешиваем обработчики на тулбар
  initToolbar();
  renderTemplatesPopup();
  document.querySelector('.editor-content').style.fontFamily = fontSelect.value;
}

// ---------- Сохранение документа ----------

async function saveDocument() {
  if (!editor || !CURRENT_USER || !DOC_KEY) return;

  const title = document.getElementById('docTitle').value.trim();
  const html = editor.getHTML();
  const payload = {
    title: title || 'Без названия',
    html,
    updated: Date.now()
  };

  // localStorage (офлайн и совместимость)
  localStorage.setItem(DOC_KEY, JSON.stringify(payload));

  // Firestore (за аккаунтом)
  await saveDocumentToFirestore(CURRENT_USER.uid, DOC_KEY, payload);
}

// ---------- Тулбар ----------

function initToolbar() {
  const toolbar = document.querySelector('.editor-toolbar');
  const buttons = toolbar.querySelectorAll('.editor-btn');

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      handleToolbarAction(action);
    });
  });

  // Обновление активного состояния кнопок
  editor.on('selectionUpdate', updateToolbarActiveState);
  editor.on('transaction', updateToolbarActiveState);
}

function handleToolbarAction(action) {
  if (!editor) return;

  const chain = editor.chain().focus();

  switch (action) {
    case 'undo':
      chain.undo().run();
      break;
    case 'redo':
      chain.redo().run();
      break;
    case 'bold':
      chain.toggleBold().run();
      break;
    case 'italic':
      chain.toggleItalic().run();
      break;
    case 'underline':
      chain.toggleUnderline().run();
      break;
    case 'h1':
      chain.toggleHeading({ level: 1 }).run();
      break;
    case 'h2':
      chain.toggleHeading({ level: 2 }).run();
      break;
    case 'h3':
      chain.toggleHeading({ level: 3 }).run();
      break;
    case 'align-left':
      chain.setTextAlign('left').run();
      break;
    case 'align-center':
      chain.setTextAlign('center').run();
      break;
    case 'align-right':
      chain.setTextAlign('right').run();
      break;
    case 'align-justify':
      chain.setTextAlign('justify').run();
      break;
    case 'bullet':
      chain.toggleBulletList().run();
      break;
    case 'ordered':
      chain.toggleOrderedList().run();
      break;
    case 'templates':
      openTemplatePopup();
      break;
  }
}

function updateToolbarActiveState() {
  const toolbar = document.querySelector('.editor-toolbar');
  const getBtn = (action) => toolbar.querySelector(`.editor-btn[data-action="${action}"]`);

  const toggles = [
    ['bold', editor.isActive('bold')],
    ['italic', editor.isActive('italic')],
    ['underline', editor.isActive('underline')],
    ['h1', editor.isActive('heading', { level: 1 })],
    ['h2', editor.isActive('heading', { level: 2 })],
    ['h3', editor.isActive('heading', { level: 3 })],
    ['bullet', editor.isActive('bulletList')],
    ['ordered', editor.isActive('orderedList')]
  ];

  toggles.forEach(([action, active]) => {
    const btn = getBtn(action);
    if (!btn) return;
    if (active) btn.classList.add('active');
    else btn.classList.remove('active');
  });
}

// ---------- Popup шаблонов ----------

function renderTemplatesPopup() {
  const list = document.getElementById('templateList');
  list.innerHTML = '';
  READY_TEMPLATES.forEach((tpl) => {
    const div = document.createElement('div');
    div.className = 'template-item';
    div.innerHTML = `
      <div class="template-item-title">${tpl.name}</div>
      <div class="template-item-desc">${tpl.desc}</div>
    `;
    div.addEventListener('click', () => {
      if (!editor) return;
      editor.commands.setContent(tpl.html);
      saveDocument();
      closeTemplatePopup();
    });
    list.appendChild(div);
  });

  const overlay = document.getElementById('overlay');
  overlay.addEventListener('click', closeTemplatePopup);
}

function openTemplatePopup() {
  document.getElementById('overlay').style.display = 'block';
  document.getElementById('templatePopup').style.display = '';
}

function closeTemplatePopup() {
  document.getElementById('overlay').style.display = 'none';
  document.getElementById('templatePopup').style.display = 'none';
}

// Делаем функции доступными из HTML
window.openTemplatePopup = openTemplatePopup;
window.closeTemplatePopup = closeTemplatePopup;

// ---------- Экспорт ----------

function editorExportPDF() {
  if (!editor) return;
  const html = editor.getHTML();
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);
  html2pdf()
    .set({
      margin: 20,
      filename: (document.getElementById('docTitle').value || 'document') + '.pdf',
      html2canvas: { scale: 2 },
      jsPDF: { format: 'a4' }
    })
    .from(wrapper)
    .save()
    .then(() => wrapper.remove());
}

function editorExportDOCX() {
  if (!editor) return;
  const html =
    '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>' +
    editor.getHTML() +
    '</body></html>';
  const blob = window.htmlDocx.asBlob(html);
  window.saveAs(blob, (document.getElementById('docTitle').value || 'document') + '.docx');
}

window.editorExportPDF = editorExportPDF;
window.editorExportDOCX = editorExportDOCX;
