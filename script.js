lucide.createIcons();

// ==== MIME ====
const MIME = {
  png:'image/png', jpeg:'image/jpeg', jpg:'image/jpeg', webp:'image/webp',
  bmp:'image/bmp', gif:'image/gif', svg:'image/svg+xml',
  txt:'text/plain', html:'text/html', htm:'text/html',
  js:'text/javascript', mjs:'text/javascript', css:'text/css',
  json:'application/json', md:'text/markdown', csv:'text/csv',
  xml:'application/xml', zip:'application/zip',
};
const getMime = ext => MIME[ext.toLowerCase()] || 'application/octet-stream';

const IMAGE_EXTS = ['png','jpg','jpeg','webp','gif','svg','bmp','ico','avif'];
const TEXT_EXTS  = ['txt','html','htm','js','mjs','css','json','md','csv','xml','svg'];
const LOSSY_EXTS = ['jpeg','jpg','webp'];

const $ = id => document.getElementById(id);
const getExt = name => { const i = name.lastIndexOf('.'); return i > 0 ? name.slice(i+1).toLowerCase() : ''; };
const getBase = name => { const e = getExt(name); return e ? name.slice(0, -(e.length+1)) : name; };
const fmtSize = b => {
  if (!b) return '0 Б';
  const k = 1024, s = ['Б','КБ','МБ','ГБ'];
  const i = Math.min(Math.floor(Math.log(b)/Math.log(k)), s.length - 1);
  return (b/Math.pow(k,i)).toFixed(1) + ' ' + s[i];
};
const safeName = s => s.replace(/[\\/:*?"<>|]/g, '_').trim() || 'file';

// Путь внутри архива: 'a/b/name.ext'
const pathBase = p => { const i = p.lastIndexOf('/'); return i >= 0 ? p.slice(i + 1) : p; };
const pathDir  = p => { const i = p.lastIndexOf('/'); return i >= 0 ? p.slice(0, i + 1) : ''; };
const setPathBase = (p, base) => pathDir(p) + base;
const withExt = (p, ext) => {
  const base = pathBase(p);
  const dot = base.lastIndexOf('.');
  return pathDir(p) + (dot > 0 ? base.slice(0, dot) : base) + '.' + ext;
};

// ==== ЛОКАЛЬНОЕ ХРАНИЛИЩЕ ====
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* приватный режим */ } },
  del(k)    { try { localStorage.removeItem(k); } catch (e) {} },
};

const fileInput = $('fileInput');
const dirInput  = $('dirInput');

// ==== ТОСТЫ ====
const toastStack = $('toastStack');
const TOAST_ICONS = { info: 'info', success: 'check', error: 'alert-circle' };

function toast(message, type = 'info') {
  while (toastStack.children.length >= 3) toastStack.firstChild.remove();
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  const icon = document.createElement('i');
  icon.setAttribute('data-lucide', TOAST_ICONS[type] || 'info');
  icon.setAttribute('width', '14');
  icon.setAttribute('height', '14');
  const text = document.createElement('span');
  text.textContent = message;
  el.append(icon, text);
  toastStack.appendChild(el);
  lucide.createIcons();
  setTimeout(() => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 300);
  }, 2200);
}

// ==== ТЕМА ====
const themeBtn = $('themeBtn');
const themeMeta = document.querySelector('meta[name="theme-color"]');

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  store.set('fm.theme', theme);
  if (themeMeta) themeMeta.setAttribute('content', theme === 'light' ? '#f3f4f6' : '#111113');
}

applyTheme(document.documentElement.getAttribute('data-theme') || 'dark');

themeBtn.addEventListener('click', () => {
  const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  applyTheme(next);
  toast(next === 'light' ? 'Светлая тема' : 'Тёмная тема', 'info');
});

// ==== ОВЕРЛЕЙ РЕЗУЛЬТАТА ====
const resultOverlay = $('resultOverlay');
const resultTitle = $('resultTitle');
const resultName  = $('resultName');
const resultSub   = $('resultSub');

let resultTimer = null;
let hideTimer = null;

function showResult({ success, title, name, sub }) {
  // Сброс предыдущих состояний
  clearTimeout(resultTimer);
  clearTimeout(hideTimer);
  resultOverlay.classList.remove('visible', 'leaving', 'success', 'error');

  // Небольшой форс-рефлоу, чтобы анимация перезапустилась
  void resultOverlay.offsetWidth;

  resultOverlay.classList.add(success ? 'success' : 'error');
  resultTitle.textContent = title;
  resultName.textContent = name || '';
  resultSub.textContent = sub || (success ? 'Проверь папку загрузок' : 'Попробуй ещё раз');

  requestAnimationFrame(() => {
    resultOverlay.classList.add('visible');
  });

  // Через 1.6 сек начинаем анимацию ухода
  resultTimer = setTimeout(() => {
    resultOverlay.classList.add('leaving');
    // Через 0.9 сек полностью скрываем
    hideTimer = setTimeout(() => {
      resultOverlay.classList.remove('visible', 'leaving', 'success', 'error');
    }, 900);
  }, 1600);
}

function hideResult() {
  if (resultOverlay.classList.contains('leaving')) return;
  clearTimeout(resultTimer);
  resultOverlay.classList.add('leaving');
  hideTimer = setTimeout(() => {
    resultOverlay.classList.remove('visible', 'leaving', 'success', 'error');
  }, 900);
}

function showSuccess(filename, sub) {
  showResult({
    success: true,
    title: 'Файл скачан!',
    name: filename,
    sub: sub || 'Проверь папку загрузок',
  });
}

function showError(title, sub) {
  showResult({
    success: false,
    title: title || 'Что-то пошло не так',
    name: '',
    sub: sub || 'Попробуй ещё раз',
  });
}

// Клик по оверлею — закрыть досрочно (с той же анимацией ухода)
resultOverlay.addEventListener('click', hideResult);

// ==== НАВИГАЦИЯ ====
let currentMode = null;
const modeScreen   = $('modeScreen');
const imageScreen  = $('imageScreen');
const textScreen   = $('textScreen');
const folderScreen = $('folderScreen');
const backBtn      = $('backBtn');
const headerTitle  = $('headerTitle');
const headerSub    = $('headerSub');

const MODE_META = {
  image:  { title:'Изображение', sub:'Загрузи фото и измени формат', screen: imageScreen,  reset: () => resetImage() },
  text:   { title:'Текст и код', sub:'Загрузи текстовый файл',        screen: textScreen,   reset: () => resetText() },
  folder: { title:'Папка',       sub:'Собери файлы в ZIP-архив',      screen: folderScreen, reset: () => resetFolder() },
};

function openMode(mode) {
  if (!MODE_META[mode]) return;
  if (currentMode && currentMode !== mode) MODE_META[currentMode].reset();
  currentMode = mode;
  modeScreen.style.display = 'none';
  imageScreen.classList.remove('visible');
  textScreen.classList.remove('visible');
  folderScreen.classList.remove('visible');
  const m = MODE_META[mode];
  m.screen.classList.add('visible');
  headerTitle.textContent = m.title;
  headerSub.textContent = m.sub;
  backBtn.classList.add('visible');
  store.set('fm.mode', mode);
}

function goHome() {
  if (currentMode) MODE_META[currentMode].reset();
  currentMode = null;
  modeScreen.style.display = 'flex';
  imageScreen.classList.remove('visible');
  textScreen.classList.remove('visible');
  folderScreen.classList.remove('visible');
  headerTitle.textContent = 'Что будем делать?';
  headerSub.textContent = 'Выбери один из трёх режимов';
  backBtn.classList.remove('visible');
  store.del('fm.mode');
}

document.querySelectorAll('.mode-card').forEach(card => {
  card.addEventListener('click', () => openMode(card.dataset.mode));
});
backBtn.addEventListener('click', goHome);

// ==== РЕДАКТИРОВАНИЕ ИМЕНИ ====
function makeEditable(el, onCommit) {
  el.addEventListener('click', () => {
    el.setAttribute('contenteditable', 'true');
    el.focus();
    const r = document.createRange();
    r.selectNodeContents(el);
    const s = window.getSelection();
    s.removeAllRanges(); s.addRange(r);
  });
  el.addEventListener('blur', () => {
    el.setAttribute('contenteditable', 'false');
    let v = el.textContent.trim().replace(/\.[a-zA-Z0-9]{1,8}$/, '').trim();
    if (!v) v = 'file';
    el.textContent = v;
    if (onCommit) onCommit(v);
  });
  el.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
    if (e.key === 'Escape') { e.preventDefault(); el.blur(); }
  });
}

// ==== БУФЕР ОБМЕНА ====
async function copyTextToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) { /* переходим к запасному способу */ }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
  ta.remove();
  return ok;
}

async function copyImageToClipboard(blob) {
  try {
    if (!navigator.clipboard || typeof ClipboardItem !== 'function' || !navigator.clipboard.write) return false;
    const png = blob.type === 'image/png' ? blob : await rasterize(blob, 'png', {});
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

async function readTextFromClipboard() {
  try {
    if (navigator.clipboard && navigator.clipboard.readText && window.isSecureContext) {
      return await navigator.clipboard.readText();
    }
  } catch (e) {
    console.error(e);
  }
  return null;
}

// ============ РАБОТА С ИЗОБРАЖЕНИЯМИ ============
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = url;
  });
}

function canvasToBlob(canvas, mime, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')), mime, quality);
  });
}

// Конвертация (и при необходимости ресайз) растрированного изображения в blob
async function rasterize(source, targetExt, opts = {}) {
  const url = URL.createObjectURL(source);
  try {
    const img = await loadImage(url);
    const srcW = img.naturalWidth || img.width || 1024;
    const srcH = img.naturalHeight || img.height || 1024;
    const clamp = (v, d) => {
      const n = Math.round(Number(v));
      return Number.isFinite(n) && n > 0 ? Math.min(n, 20000) : d;
    };
    const dw = clamp(opts.width, srcW);
    const dh = clamp(opts.height, srcH);

    const canvas = document.createElement('canvas');
    canvas.width = dw;
    canvas.height = dh;
    const ctx = canvas.getContext('2d');
    if (targetExt === 'jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, dw, dh);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, dw, dh);

    const quality = LOSSY_EXTS.includes(targetExt) ? (opts.quality ?? 0.92) : undefined;
    return await canvasToBlob(canvas, getMime(targetExt), quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ============ ИЗОБРАЖЕНИЕ ============
let imageFile = null;
let imageFileObjectURL = null;
let imageNatural = { w: 0, h: 0 };
let lockAspect = true;

const imgDrop    = $('imageDropzone');
const imgPreview = $('imagePreview');
const imgPreviewBox = $('imagePreviewBox');
const imgCard    = $('imageFileCard');
const imgName    = $('imageFileName');
const imgSize    = $('imageFileSize');
const imgFormat  = $('imageFormat');
const imgRemove  = $('imageRemove');
const imgDownload= $('imageDownload');
const imgCopy    = $('imageCopy');
const imgQualityRow = $('imageQualityRow');
const imgQuality    = $('imageQuality');
const imgQualityVal = $('imageQualityValue');
const imgSizeRow    = $('imageSizeRow');
const imgWidth      = $('imageWidth');
const imgHeight     = $('imageHeight');
const imgLock       = $('imageLock');
const imgSizeReset  = $('imageSizeReset');

const currentImageQuality = () => parseInt(imgQuality.value, 10) / 100;

function targetImageExt() {
  const ext = getExt(imageFile ? imageFile.name : '');
  return imgFormat.value || (ext === 'jpg' ? 'jpeg' : ext) || 'png';
}

function syncImageControls() {
  if (!imageFile) return;
  const ext = targetImageExt();
  imgQualityRow.style.display = LOSSY_EXTS.includes(ext) ? 'flex' : 'none';
  imgQualityVal.textContent = imgQuality.value + '%';

  const w = parseInt(imgWidth.value, 10);
  const h = parseInt(imgHeight.value, 10);
  const changed = (w > 0 && w !== imageNatural.w) || (h > 0 && h !== imageNatural.h);
  imgSize.textContent = fmtSize(imageFile.size) + ' · ' + (getExt(imageFile.name) || '?').toUpperCase()
    + ' · ' + imageNatural.w + '×' + imageNatural.h
    + (changed ? ` → ${w}×${h}` : '');
}

// derive: 'w' — менялась ширина, 'h' — менялась высота, null — задать оба
function setImageSize(w, h, derive) {
  if (lockAspect && imageNatural.w && imageNatural.h) {
    const ratio = imageNatural.w / imageNatural.h;
    if (derive === 'w' && w > 0) h = Math.max(1, Math.round(w / ratio));
    if (derive === 'h' && h > 0) w = Math.max(1, Math.round(h * ratio));
  }
  if (w > 0) imgWidth.value = w;
  if (h > 0) imgHeight.value = h;
  syncImageControls();
}

function resetImage() {
  imageFile = null;
  imageNatural = { w: 0, h: 0 };
  if (imageFileObjectURL) { URL.revokeObjectURL(imageFileObjectURL); imageFileObjectURL = null; }
  imgPreviewBox.style.display = 'none';
  imgCard.style.display = 'none';
  imgDrop.style.display = 'flex';
  imgPreview.removeAttribute('src');
  imgName.textContent = '';
  imgFormat.value = '';
  imgWidth.value = '';
  imgHeight.value = '';
  imgQualityRow.style.display = 'none';
  imgSizeRow.style.display = 'none';
  fileInput.value = '';
}

async function showImageFile(file) {
  const ext = getExt(file.name);
  if (!IMAGE_EXTS.includes(ext) && !file.type.startsWith('image/')) {
    showError('Это не изображение', 'Разрешены: PNG, JPG, WEBP, GIF, SVG, BMP');
    return;
  }

  let natural;
  try {
    const probeUrl = URL.createObjectURL(file);
    const img = await loadImage(probeUrl);
    natural = { w: img.naturalWidth || 0, h: img.naturalHeight || 0 };
    URL.revokeObjectURL(probeUrl);
  } catch (err) {
    showError('Не удалось открыть изображение', file.name);
    return;
  }
  if (!natural.w || !natural.h) {
    showError('Не удалось прочитать размеры', 'У файла нет явных размеров');
    return;
  }

  imageFile = file;
  imageNatural = natural;
  if (imageFileObjectURL) URL.revokeObjectURL(imageFileObjectURL);
  imageFileObjectURL = URL.createObjectURL(file);
  imgPreview.src = imageFileObjectURL;
  imgPreviewBox.style.display = 'block';
  imgName.textContent = getBase(file.name);
  imgWidth.value = natural.w;
  imgHeight.value = natural.h;

  const avail = ['png','jpeg','webp','bmp'];
  imgFormat.value = avail.includes(ext === 'jpg' ? 'jpeg' : ext) ? (ext === 'jpg' ? 'jpeg' : ext) : '';
  imgCard.style.display = 'flex';
  imgSizeRow.style.display = 'flex';
  imgDrop.style.display = 'none';
  syncImageControls();
  lucide.createIcons();

  if (ext === 'gif') toast('GIF станет статичным кадром', 'info');
}

// Подготовка файла/блоба для скачивания с учётом формата, качества и размера
async function prepareImageOutput() {
  const base = safeName(imgName.textContent.trim() || 'image');
  const originalExt = getExt(imageFile.name) === 'jpg' ? 'jpeg' : getExt(imageFile.name);
  const targetExt = imgFormat.value || originalExt || 'png';
  const mime = getMime(targetExt);

  const w = parseInt(imgWidth.value, 10);
  const h = parseInt(imgHeight.value, 10);
  const resized = (w > 0 && w !== imageNatural.w) || (h > 0 && h !== imageNatural.h);

  // Формат и размеры не меняются — отдаём оригинал без пересжатия
  if (targetExt === originalExt && !resized) {
    return { blob: imageFile, filename: base + '.' + targetExt, mime, converted: false };
  }
  // В SVG растеризацией не конвертируем: без ресайза отдаём оригинал,
  // с ресайзом — растеризуем в PNG
  if (targetExt === 'svg') {
    if (!resized) {
      return { blob: imageFile, filename: base + '.' + targetExt, mime, converted: false };
    }
    const pngBlob = await rasterize(imageFile, 'png', { width: w, height: h, quality: currentImageQuality() });
    return { blob: pngBlob, filename: base + '.png', mime: getMime('png'), converted: true };
  }

  const blob = await rasterize(imageFile, targetExt, {
    width: w, height: h, quality: currentImageQuality(),
  });
  return { blob, filename: base + '.' + targetExt, mime, converted: true };
}

imgDrop.addEventListener('click', () => {
  fileInput.accept = 'image/*,.png,.jpg,.jpeg,.webp,.gif,.svg,.bmp';
  fileInput.multiple = false;
  fileInput.click();
});

['dragenter','dragover'].forEach(e =>
  imgDrop.addEventListener(e, ev => { ev.preventDefault(); ev.stopPropagation(); imgDrop.classList.add('dragover'); })
);
['dragleave','drop'].forEach(e =>
  imgDrop.addEventListener(e, ev => { ev.preventDefault(); ev.stopPropagation(); imgDrop.classList.remove('dragover'); })
);
imgDrop.addEventListener('drop', ev => {
  const f = ev.dataTransfer.files[0];
  if (f) showImageFile(f);
});

imgRemove.addEventListener('click', resetImage);
imgQuality.addEventListener('input', syncImageControls);
imgFormat.addEventListener('change', syncImageControls);

imgWidth.addEventListener('input', () => {
  const w = parseInt(imgWidth.value, 10);
  if (w > 0) setImageSize(w, null, 'w'); else syncImageControls();
});
imgHeight.addEventListener('input', () => {
  const h = parseInt(imgHeight.value, 10);
  if (h > 0) setImageSize(null, h, 'h'); else syncImageControls();
});
imgSizeReset.addEventListener('click', () => {
  if (!imageFile) return;
  lockAspect = true;
  imgLock.classList.add('active');
  setImageSize(imageNatural.w, imageNatural.h);
  toast('Размер возвращён', 'info');
});
imgLock.classList.add('active');
imgLock.addEventListener('click', () => {
  lockAspect = !lockAspect;
  imgLock.classList.toggle('active', lockAspect);
  imgLock.innerHTML = `<i data-lucide="${lockAspect ? 'lock' : 'lock-open'}" width="14" height="14"></i>`;
  lucide.createIcons();
});

imgDownload.addEventListener('click', async () => {
  if (!imageFile) {
    showError('Файл не выбран', 'Сначала загрузи изображение');
    return;
  }
  try {
    const out = await prepareImageOutput();
    downloadBlob(out.blob, out.filename, out.mime);
  } catch (err) {
    console.error(err);
    showError('Не удалось обработать изображение', 'Попробуй другой формат или размеры');
  }
});

imgCopy.addEventListener('click', async () => {
  if (!imageFile) {
    toast('Сначала загрузи изображение', 'error');
    return;
  }
  imgCopy.disabled = true;
  try {
    const blob = await rasterize(imageFile, 'png', { width: imgWidth.value, height: imgHeight.value });
    const ok = await copyImageToClipboard(blob);
    toast(ok ? 'Картинка скопирована' : 'Браузер не разрешает копировать картинки', ok ? 'success' : 'error');
  } catch (err) {
    console.error(err);
    toast('Не удалось скопировать картинку', 'error');
  } finally {
    imgCopy.disabled = false;
  }
});

// ============ ТЕКСТ ============
let textFile = null;
let textContent = '';
let textEditing = false;

const txtDrop    = $('textDropzone');
const txtPreview = $('textPreview');
const txtEditor  = $('textEditor');
const txtPreviewBox = $('textPreviewBox');
const txtCard    = $('textFileCard');
const txtName    = $('textFileName');
const txtSize    = $('textFileSize');
const txtFormat  = $('textFormat');
const txtRemove  = $('textRemove');
const txtDownload= $('textDownload');
const txtCopy    = $('textCopy');
const txtEdit    = $('textEdit');
const txtPaste   = $('textPasteBtn');

function textBytes() {
  return new Blob([textContent]).size;
}

function syncTextSize() {
  if (!textFile) return;
  const ext = getExt(textFile.name);
  txtSize.textContent = fmtSize(textBytes()) + ' · ' + (ext || '?').toUpperCase()
    + ' · ' + textContent.length + ' симв.';
}

function stopTextEdit(apply) {
  if (!textEditing) return;
  if (apply) {
    textContent = txtEditor.value;
    txtPreview.textContent = textContent || '(пустой файл)';
    syncTextSize();
    toast('Изменения применены', 'success');
  }
  textEditing = false;
  txtEditor.style.display = 'none';
  txtPreview.style.display = 'block';
  txtEdit.classList.remove('active');
}

function resetText() {
  stopTextEdit(false);
  textFile = null;
  textContent = '';
  txtPreviewBox.style.display = 'none';
  txtCard.style.display = 'none';
  txtDrop.style.display = 'flex';
  txtPaste.style.display = 'flex';
  txtPreview.textContent = '';
  txtEditor.value = '';
  txtName.textContent = '';
  txtFormat.value = '';
  fileInput.value = '';
}

function showTextFile(file) {
  const ext = getExt(file.name);
  if (!TEXT_EXTS.includes(ext) && !file.type.startsWith('text/')) {
    showError('Это не текстовый файл', 'Разрешены: TXT, HTML, JS, CSS, JSON, MD, CSV, XML');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    stopTextEdit(false);
    textFile = file;
    textContent = String(reader.result);
    const preview = textContent.length > 3000
      ? textContent.slice(0, 3000) + '\n\n… (показано 3000 символов)'
      : textContent;
    txtPreview.textContent = preview || '(пустой файл)';
    txtPreview.style.display = 'block';
    txtPreviewBox.style.display = 'block';
    txtName.textContent = getBase(file.name);
    const avail = ['txt','html','js','css','json','md','csv','xml'];
    txtFormat.value = avail.includes(ext) ? ext : '';
    txtCard.style.display = 'flex';
    txtDrop.style.display = 'none';
    txtPaste.style.display = 'none';
    syncTextSize();
    lucide.createIcons();
  };
  reader.onerror = () => showError('Не удалось прочитать файл', file.name);
  reader.readAsText(file);
}

async function pasteTextFromClipboard() {
  const text = await readTextFromClipboard();
  if (!text) {
    toast('Буфер недоступен — нажми Ctrl+V', 'error');
    return;
  }
  showTextFile(new File([text], 'pasted.txt', { type: 'text/plain' }));
  toast('Текст вставлен из буфера', 'success');
}

txtDrop.addEventListener('click', () => {
  fileInput.accept = '.txt,.html,.htm,.js,.mjs,.css,.json,.md,.csv,.xml,text/*';
  fileInput.multiple = false;
  fileInput.click();
});

['dragenter','dragover'].forEach(e =>
  txtDrop.addEventListener(e, ev => { ev.preventDefault(); ev.stopPropagation(); txtDrop.classList.add('dragover'); })
);
['dragleave','drop'].forEach(e =>
  txtDrop.addEventListener(e, ev => { ev.preventDefault(); ev.stopPropagation(); txtDrop.classList.remove('dragover'); })
);
txtDrop.addEventListener('drop', ev => {
  const f = ev.dataTransfer.files[0];
  if (f) showTextFile(f);
});

txtRemove.addEventListener('click', resetText);
txtPaste.addEventListener('click', pasteTextFromClipboard);

txtEdit.addEventListener('click', () => {
  if (!textFile) return;
  if (textEditing) {
    stopTextEdit(true);
    return;
  }
  textEditing = true;
  txtEditor.value = textContent;
  txtEditor.style.display = 'block';
  txtPreview.style.display = 'none';
  txtEdit.classList.add('active');
  txtEditor.focus();
});

txtDownload.addEventListener('click', () => {
  if (!textContent && !textFile) {
    showError('Файл не выбран', 'Сначала загрузи текстовый файл');
    return;
  }
  stopTextEdit(true);
  const base = safeName(txtName.textContent.trim() || 'file');
  const ext = txtFormat.value || getExt(textFile.name) || 'txt';
  const mime = getMime(ext);
  const blob = new Blob([textContent], { type: mime + ';charset=utf-8' });
  downloadBlob(blob, base + '.' + ext, mime);
});

txtCopy.addEventListener('click', async () => {
  if (!textFile) {
    toast('Сначала загрузи текстовый файл', 'error');
    return;
  }
  stopTextEdit(true);
  const ok = await copyTextToClipboard(textContent);
  toast(ok ? 'Текст скопирован' : 'Браузер не дал доступ к буферу', ok ? 'success' : 'error');
});

// ============ ПАПКА ============
let folderFiles = [];
let folderSort = 'none';
let clearArmed = false;
let clearTimer = null;

const fldDrop     = $('folderDropzone');
const fldName     = $('folderName');
const fldList     = $('folderList');
const fldEmpty    = $('folderEmpty');
const fldDownload = $('folderDownload');
const fldSummary  = $('folderSummary');
const fldSortSel  = $('folderSort');
const fldClear    = $('folderClear');
const fldImgFmt   = $('folderImageFormat');
const fldQualityRow = $('folderQualityRow');
const fldQuality    = $('folderQuality');
const fldQualityVal = $('folderQualityValue');

function folderConvertExt() {
  return fldImgFmt.value || '';
}

function isImagePath(p) {
  const ext = getExt(p);
  return IMAGE_EXTS.includes(ext) && ext !== 'svg';
}

function syncFolderControls() {
  const ext = folderConvertExt();
  fldQualityRow.style.display = LOSSY_EXTS.includes(ext) ? 'flex' : 'none';
  fldQualityVal.textContent = fldQuality.value + '%';

  if (folderFiles.length === 0) {
    fldSummary.textContent = '';
    return;
  }
  const total = folderFiles.reduce((s, i) => s + i.file.size, 0);
  const imgs = folderFiles.filter(i => isImagePath(i.path)).length;
  fldSummary.textContent = `${folderFiles.length} файл(ов) · ${fmtSize(total)}`
    + (ext && imgs ? ` · конвертация фото: ${imgs}` : '');
}

function releaseThumb(item) {
  if (item.thumb) { URL.revokeObjectURL(item.thumb); item.thumb = null; }
}

function uniquePath(path, taken) {
  if (!taken.has(path)) return path;
  const base = pathBase(path);
  const dot = base.lastIndexOf('.');
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot) : '';
  const dir = pathDir(path);
  let n = 2, candidate = path;
  do {
    candidate = dir + stem + ' (' + n + ')' + ext;
    n++;
  } while (taken.has(candidate));
  return candidate;
}

function sortedFolderFiles() {
  if (folderSort === 'none') return folderFiles.slice();
  const copy = folderFiles.slice();
  if (folderSort === 'name') copy.sort((a, b) => a.path.localeCompare(b.path, 'ru'));
  if (folderSort === 'size') copy.sort((a, b) => b.file.size - a.file.size);
  return copy;
}

function resetFolder() {
  folderFiles.forEach(releaseThumb);
  folderFiles = [];
  disarmClear();
  fldName.value = 'my-folder';
  renderFolderList();
  fileInput.value = '';
  dirInput.value = '';
}

function renderFolderList() {
  fldList.innerHTML = '';
  if (folderFiles.length === 0) {
    fldList.appendChild(fldEmpty);
    fldEmpty.style.display = 'block';
    fldDownload.disabled = true;
    syncFolderControls();
    return;
  }
  fldEmpty.style.display = 'none';
  fldDownload.disabled = false;

  sortedFolderFiles().forEach(item => {
    const row = document.createElement('div');
    row.className = 'folder-file';

    const iconBox = document.createElement('div');
    iconBox.className = 'folder-file-icon';
    if (isImagePath(item.path)) {
      if (!item.thumb) item.thumb = URL.createObjectURL(item.file);
      const img = document.createElement('img');
      img.className = 'folder-file-thumb';
      img.alt = '';
      img.src = item.thumb;
      iconBox.appendChild(img);
    } else {
      const i = document.createElement('i');
      i.setAttribute('data-lucide', 'file');
      i.setAttribute('width', '16');
      i.setAttribute('height', '16');
      iconBox.appendChild(i);
    }

    const info = document.createElement('div');
    info.className = 'folder-file-info';

    const nameEl = document.createElement('div');
    nameEl.className = 'folder-file-name';
    nameEl.textContent = pathBase(item.path);
    nameEl.setAttribute('contenteditable', 'false');
    nameEl.setAttribute('spellcheck', 'false');
    makeEditable(nameEl, value => {
      const next = uniquePath(setPathBase(item.path, safeName(value) + (getExt(item.path) ? '.' + getExt(item.path) : '')),
        new Set(folderFiles.filter(f => f !== item).map(f => f.path)));
      if (next !== item.path) {
        item.path = next;
        toast('Файл переименован', 'success');
      }
      renderFolderList();
    });
    // makeEditable срезает расширение, поэтому возвращаем его на место
    nameEl.addEventListener('focus', () => { nameEl.textContent = pathBase(item.path); });

    const meta = document.createElement('div');
    meta.className = 'folder-file-meta';
    const dir = pathDir(item.path);
    meta.innerHTML = `<span></span>` + (dir ? ` <span class="folder-file-path"></span>` : '');
    meta.children[0].textContent = fmtSize(item.file.size) + ' · ' + (getExt(item.path).toUpperCase() || '—');
    if (dir) meta.children[1].textContent = '· ' + dir;

    info.append(nameEl, meta);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'icon-btn';
    removeBtn.title = 'Убрать';
    removeBtn.innerHTML = '<i data-lucide="x" width="14" height="14"></i>';
    removeBtn.addEventListener('click', () => {
      releaseThumb(item);
      folderFiles = folderFiles.filter(f => f !== item);
      renderFolderList();
    });

    row.append(iconBox, info, removeBtn);
    fldList.appendChild(row);
  });
  syncFolderControls();
  lucide.createIcons();
}

function disarmClear() {
  clearArmed = false;
  clearTimeout(clearTimer);
  fldClear.innerHTML = '<i data-lucide="trash-2" width="14" height="14"></i> Очистить';
  lucide.createIcons();
}

function addFilesToFolder(entries) {
  const taken = new Set(folderFiles.map(f => f.path));
  let added = 0;
  entries.forEach(({ file, path }) => {
    const p = uniquePath(path || file.name, taken);
    taken.add(p);
    folderFiles.push({ file, path: p, thumb: null });
    added++;
  });
  renderFolderList();
  if (added) toast(`Добавлено файлов: ${added}`, 'success');
}

// Рекурсивный обход папок при drag&drop
async function readAllEntries(reader) {
  const all = [];
  while (true) {
    const batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
    if (!batch.length) break;
    all.push(...batch);
  }
  return all;
}

async function walkEntry(entry, prefix, out) {
  if (!entry) return;
  if (entry.isFile) {
    const file = await new Promise(resolve => entry.file(resolve));
    out.push({ file, path: prefix + entry.name });
  } else if (entry.isDirectory) {
    const children = await readAllEntries(entry.createReader());
    for (const child of children) await walkEntry(child, prefix + entry.name + '/', out);
  }
}

async function handleDropItems(ev) {
  const items = Array.from(ev.dataTransfer.items || []);
  const entries = items
    .map(i => (typeof i.webkitGetAsEntry === 'function' ? i.webkitGetAsEntry() : null))
    .filter(Boolean);

  if (!entries.length) {
    const files = Array.from(ev.dataTransfer.files);
    if (files.length) addFilesToFolder(files.map(f => ({ file: f, path: f.name })));
    return;
  }

  const out = [];
  for (const entry of entries) await walkEntry(entry, '', out);
  if (out.length) addFilesToFolder(out);
}

fldDrop.addEventListener('click', () => {
  fileInput.accept = '*/*';
  fileInput.multiple = true;
  fileInput.click();
});

['dragenter','dragover'].forEach(e =>
  fldDrop.addEventListener(e, ev => { ev.preventDefault(); ev.stopPropagation(); fldDrop.classList.add('dragover'); })
);
['dragleave','drop'].forEach(e =>
  fldDrop.addEventListener(e, ev => { ev.preventDefault(); ev.stopPropagation(); fldDrop.classList.remove('dragover'); })
);
fldDrop.addEventListener('drop', ev => {
  handleDropItems(ev).catch(err => {
    console.error(err);
    showError('Не удалось прочитать папку', 'Попробуй перетащить файлы');
  });
});

$('pickFilesBtn').addEventListener('click', () => {
  fileInput.accept = '*/*';
  fileInput.multiple = true;
  fileInput.click();
});

$('pickDirBtn').addEventListener('click', () => dirInput.click());

dirInput.addEventListener('change', e => {
  const files = Array.from(e.target.files);
  e.target.value = '';
  if (!files.length) return;
  addFilesToFolder(files.map(f => ({ file: f, path: f.webkitRelativePath || f.name })));
});

fldClear.addEventListener('click', () => {
  if (folderFiles.length === 0) {
    toast('Папка уже пуста', 'info');
    return;
  }
  if (!clearArmed) {
    clearArmed = true;
    fldClear.innerHTML = '<i data-lucide="alert-circle" width="14" height="14"></i> Точно очистить?';
    lucide.createIcons();
    clearTimer = setTimeout(disarmClear, 3000);
    return;
  }
  resetFolder();
  toast('Список очищен', 'success');
});

fldSortSel.addEventListener('change', () => {
  folderSort = fldSortSel.value;
  renderFolderList();
});
fldImgFmt.addEventListener('change', syncFolderControls);
fldQuality.addEventListener('input', syncFolderControls);

fldDownload.addEventListener('click', async () => {
  if (folderFiles.length === 0) {
    showError('Папка пуста', 'Добавь хотя бы один файл');
    return;
  }
  if (typeof JSZip === 'undefined') {
    showError('Нет модуля архивации', 'Проверь подключение к интернету');
    return;
  }
  fldDownload.disabled = true;
  const originalHTML = fldDownload.innerHTML;
  fldDownload.innerHTML = '<i data-lucide="loader" width="14" height="14"></i> Упаковка...';
  lucide.createIcons();

  const convertExt = folderConvertExt();
  const skipped = [];

  try {
    const zip = new JSZip();
    for (const item of sortedFolderFiles()) {
      let path = item.path;
      let data = item.file;
      if (convertExt && isImagePath(item.path)) {
        try {
          data = await rasterize(item.file, convertExt, { quality: parseInt(fldQuality.value, 10) / 100 });
          path = withExt(item.path, convertExt);
        } catch (err) {
          console.error(err);
          skipped.push(pathBase(item.path));
        }
      }
      zip.file(path, data);
    }
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    const safeFolder = safeName(fldName.value.trim() || 'folder');
    downloadBlob(blob, safeFolder + '.zip', 'application/zip');
    if (skipped.length) {
      setTimeout(() => toast(`Без конвертации: ${skipped.slice(0, 3).join(', ')}${skipped.length > 3 ? '…' : ''}`, 'error'), 2600);
    }
  } catch (err) {
    console.error(err);
    showError('Не удалось создать архив', 'Попробуй с меньшим числом файлов');
  } finally {
    fldDownload.disabled = false;
    fldDownload.innerHTML = originalHTML;
    lucide.createIcons();
  }
});

// ============ INPUT FILE ============
fileInput.addEventListener('change', e => {
  const files = Array.from(e.target.files);
  if (files.length === 0) return;
  if (currentMode === 'image')      showImageFile(files[0]);
  else if (currentMode === 'text')  showTextFile(files[0]);
  else if (currentMode === 'folder')addFilesToFolder(files.map(f => ({ file: f, path: f.name })));
  fileInput.value = '';
});

// ============ ВСТАВКА ИЗ БУФЕРА (CTRL+V) ============
document.addEventListener('paste', e => {
  if (!currentMode) return;
  const el = document.activeElement;
  if (el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.isContentEditable)) return;

  const files = e.clipboardData ? Array.from(e.clipboardData.files || []) : [];

  if (currentMode === 'image') {
    const img = files.find(f => f.type.startsWith('image/'));
    if (img) { e.preventDefault(); showImageFile(img); }
    return;
  }
  if (currentMode === 'text') {
    if (files.length) { e.preventDefault(); showTextFile(files[0]); return; }
    const text = e.clipboardData ? e.clipboardData.getData('text/plain') : '';
    if (text) {
      e.preventDefault();
      showTextFile(new File([text], 'pasted.txt', { type: 'text/plain' }));
      toast('Текст вставлен из буфера', 'success');
    }
    return;
  }
  if (currentMode === 'folder' && files.length) {
    e.preventDefault();
    addFilesToFolder(files.map(f => ({ file: f, path: f.name })));
  }
});

// ============ СКАЧИВАНИЕ ============
function downloadBlob(blobOrFile, filename, mime) {
  let data = blobOrFile;
  if (!mime) mime = (blobOrFile.type || 'application/octet-stream');

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const finalBlob = new Blob([reader.result], { type: mime });
      const url = URL.createObjectURL(finalBlob);

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.rel = 'noopener';
      a.style.display = 'none';
      document.body.appendChild(a);

      try { a.click(); } catch (e) { /* ignore */ }

      showSuccess(filename);

      // Обходная попытка для Яндекс.Браузера
      setTimeout(() => {
        if (document.body.contains(a)) {
          const fallback = document.createElement('a');
          fallback.href = url;
          fallback.target = '_blank';
          fallback.rel = 'noopener';
          fallback.download = filename;
          fallback.style.display = 'none';
          document.body.appendChild(fallback);
          try { fallback.click(); } catch (e) { /* ignore */ }
          setTimeout(() => {
            if (document.body.contains(fallback)) document.body.removeChild(fallback);
            if (document.body.contains(a)) document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }, 1200);
        } else {
          URL.revokeObjectURL(url);
        }
      }, 500);
    } catch (err) {
      console.error(err);
      showError('Не удалось создать файл', filename);
    }
  };
  reader.onerror = () => {
    showError('Не удалось прочитать данные', filename);
  };
  try {
    reader.readAsArrayBuffer(data);
  } catch (err) {
    console.error(err);
    showError('Ошибка чтения файла', filename);
  }
}

document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => e.preventDefault());

// ==== ВОССТАНОВЛЕНИЕ ПОСЛЕДНЕГО РЕЖИМА ====
makeEditable($('imageFileName'));
makeEditable($('textFileName'));

const lastMode = store.get('fm.mode', null);
if (lastMode && MODE_META[lastMode]) openMode(lastMode);

// ==== SERVICE WORKER ====
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW не подключился:', err));
  });
}
