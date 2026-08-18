/* ---------- Shared UI: sheets, toast, photo picker ---------- */

function closeSheet() {
  const root = document.getElementById('modal-root');
  root.innerHTML = '';
}

function openSheet(titleText, bodyEl, opts = {}) {
  const root = document.getElementById('modal-root');
  root.innerHTML = '';
  const overlay = el(`<div class="overlay"></div>`);
  const sheet = el(`
    <div class="sheet">
      <div class="sheet-handle"></div>
      <div class="sheet-title"><span>${escapeHtml(titleText)}</span><button class="x">${icon('close', 16)}</button></div>
      <div class="sheet-body"></div>
    </div>
  `);
  sheet.querySelector('.sheet-body').appendChild(bodyEl);
  sheet.querySelector('.x').addEventListener('click', closeSheet);
  overlay.addEventListener('click', (e) => { if (e.target === overlay && !opts.noBackdropClose) closeSheet(); });
  overlay.appendChild(sheet);
  root.appendChild(overlay);
  return { overlay, sheet, close: closeSheet };
}

function toast(msg) {
  const root = document.getElementById('toast-root');
  const t = el(`<div class="toast">${escapeHtml(msg)}</div>`);
  root.appendChild(t);
  setTimeout(() => t.remove(), 1800);
}

function confirmDialog(message, opts = {}) {
  const { icons = false, danger = true, confirmLabel = 'ลบ', cancelLabel = 'ยกเลิก' } = opts;
  return new Promise((resolve) => {
    const noInner = icons ? icon('close', 20) : escapeHtml(cancelLabel);
    const yesInner = icons ? icon('check', 20) : escapeHtml(confirmLabel);
    const body = el(`
      <div>
        <div style="display:flex;gap:10px;">
          <button class="btn secondary block" id="cf-no">${noInner}</button>
          <button class="btn ${danger ? 'danger' : ''} block" id="cf-yes">${yesInner}</button>
        </div>
      </div>
    `);
    const { close } = openSheet(message, body);
    body.querySelector('#cf-no').addEventListener('click', () => { close(); resolve(false); });
    body.querySelector('#cf-yes').addEventListener('click', () => { close(); resolve(true); });
  });
}

/**
 * Reusable photo picker.
 * existing: array of {id, blob} already saved photos (edit mode)
 * max: max total photos allowed
 * returns handle with .root (element to insert), .getState() -> {keepIds, newFiles}
 */
function createPhotoPicker({ existing = [], max = 9 } = {}) {
  const keep = new Set(existing.map((p) => p.id));
  let newFiles = [];
  const root = el(`<div class="photo-input-wrap"></div>`);
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.multiple = max > 1;
  input.style.display = 'none';
  root.appendChild(input);

  function count() { return keep.size + newFiles.length; }

  function render() {
    root.querySelectorAll('.photo-thumb-wrap, .add-photo-btn').forEach((n) => n.remove());
    existing.forEach((p) => {
      if (!keep.has(p.id)) return;
      const url = photoUrl(p);
      const wrap = el(`<div class="photo-thumb-wrap"><img class="photo-thumb" src="${url}"><button type="button" class="rm">${icon('close', 12)}</button></div>`);
      wrap.querySelector('.rm').addEventListener('click', () => { keep.delete(p.id); render(); });
      root.insertBefore(wrap, input);
    });
    newFiles.forEach((f, idx) => {
      const url = URL.createObjectURL(f);
      const wrap = el(`<div class="photo-thumb-wrap"><img class="photo-thumb" src="${url}"><button type="button" class="rm">${icon('close', 12)}</button></div>`);
      wrap.querySelector('.rm').addEventListener('click', () => { newFiles.splice(idx, 1); render(); });
      root.insertBefore(wrap, input);
    });
    if (count() < max) {
      const addBtn = el(`<button type="button" class="add-photo-btn">${icon('plus', 22)}</button>`);
      addBtn.addEventListener('click', () => input.click());
      root.insertBefore(addBtn, input);
    }
  }

  input.addEventListener('change', () => {
    const files = Array.from(input.files || []);
    const room = max - count();
    newFiles = newFiles.concat(files.slice(0, room));
    input.value = '';
    render();
  });

  render();

  return {
    root,
    getState() { return { keepIds: Array.from(keep), newFiles }; },
  };
}

/**
 * Reusable calendar-popup date picker. Tapping the field opens a month-grid
 * calendar (same look as the app's other calendars) to pick a day; the field
 * itself always displays dd/mm/yy in the Gregorian year, unlike the native
 * <input type="date"> whose display format/era depends on device locale.
 * value: 'YYYY-MM-DD' string or falsy for today
 * maxDate: optional 'YYYY-MM-DD' string — days after it are disabled (e.g. todayStr())
 * returns handle with .root (element to insert), .getValue() -> 'YYYY-MM-DD' or ''
 */
function createCalendarDatePicker({ value, maxDate } = {}) {
  let selected = value || null;
  const initial = selected ? selected.split('-').map(Number) : null;
  let viewDate = initial ? new Date(initial[0], initial[1] - 1, 1) : new Date();

  const root = el(`
    <div class="cal-picker">
      <button type="button" class="cal-picker-trigger">
        <span class="cdp-text"></span>
        ${icon('calendar', 16)}
      </button>
      <div class="cal-picker-panel" style="display:none;">
        <div class="cal-header">
          <button type="button" class="cal-nav-btn cdp-prev">${icon('chevronLeft', 16)}</button>
          <span class="cal-title cdp-title"></span>
          <button type="button" class="cal-nav-btn cdp-next">${icon('chevronRight', 16)}</button>
        </div>
        <div class="cal-grid cdp-grid"></div>
      </div>
    </div>
  `);

  const trigger = root.querySelector('.cal-picker-trigger');
  const panel = root.querySelector('.cal-picker-panel');
  const textEl = root.querySelector('.cdp-text');
  const titleEl = root.querySelector('.cdp-title');
  const gridEl = root.querySelector('.cdp-grid');

  function updateText() {
    textEl.textContent = selected ? formatDateNumeric(selected) : 'เลือกวันที่';
  }

  function drawGrid() {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    titleEl.textContent = `${THAI_MONTHS[month]} ${year}`;
    gridEl.innerHTML = '';
    THAI_DAYS_SHORT.forEach((d) => gridEl.appendChild(el(`<div class="cal-dow">${d}</div>`)));

    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let i = 0; i < startOffset; i++) gridEl.appendChild(el('<div class="cal-day empty"></div>'));

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${pad2(month + 1)}-${pad2(d)}`;
      const disabled = maxDate && dateStr > maxDate;
      const btn = el(`<button type="button" class="cal-day"><span>${d}</span></button>`);
      if (dateStr === todayStr()) btn.classList.add('today');
      if (dateStr === selected) btn.classList.add('selected');
      if (disabled) {
        btn.disabled = true;
      } else {
        btn.addEventListener('click', () => {
          selected = dateStr;
          updateText();
          drawGrid();
          panel.style.display = 'none';
        });
      }
      gridEl.appendChild(btn);
    }

    const nextBtn = root.querySelector('.cdp-next');
    if (maxDate) {
      const [maxY, maxM] = maxDate.split('-').map(Number);
      nextBtn.disabled = year > maxY || (year === maxY && month + 1 >= maxM);
    }
  }

  trigger.addEventListener('click', () => {
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  });
  root.querySelector('.cdp-prev').addEventListener('click', () => { viewDate.setMonth(viewDate.getMonth() - 1); drawGrid(); });
  root.querySelector('.cdp-next').addEventListener('click', () => { viewDate.setMonth(viewDate.getMonth() + 1); drawGrid(); });

  updateText();
  drawGrid();

  return {
    root,
    getValue() { return selected || ''; },
  };
}

/**
 * Full-screen swipeable photo viewer, optionally shown as a post detail
 * with a date/time header and title/content caption below the image.
 * photos: array of {id, blob}
 * meta: optional {date, time, title, text}
 * actions: optional array of {icon, label, danger, onClick(close)}, shown in the header
 */
function openLightbox(photos, startIndex = 0, meta = null, actions = null) {
  const root = document.getElementById('modal-root');
  root.innerHTML = '';
  let idx = startIndex;

  const overlay = el(`<div class="lightbox-overlay"></div>`);
  const post = el(`<div class="lb-post"></div>`);

  const header = el(`
    <div class="lb-header">
      <span class="lb-date"></span>
      <div class="lb-actions"></div>
    </div>
  `);
  const headerDate = header.querySelector('.lb-date');
  if (meta) {
    headerDate.textContent = meta.time ? `${meta.date} · ${meta.time}` : meta.date;
  }
  const actionsRow = header.querySelector('.lb-actions');
  (actions || []).forEach((a) => {
    const btn = el(`<button type="button" class="${a.danger ? 'danger' : ''}" title="${escapeHtml(a.label || '')}">${icon(a.icon, 17)}</button>`);
    btn.addEventListener('click', (e) => { e.stopPropagation(); a.onClick(close); });
    actionsRow.appendChild(btn);
  });
  actionsRow.appendChild(el(`<button type="button" class="lb-close">${icon('close', 18)}</button>`));

  const media = el(`<div class="lb-media"></div>`);
  const imgEl = el(`<img class="lb-img">`);
  const prevBtn = el(`<button class="lb-nav lb-prev">${icon('chevronLeft', 20)}</button>`);
  const nextBtn = el(`<button class="lb-nav lb-next">${icon('chevronRight', 20)}</button>`);
  const counter = el(`<div class="lb-counter"></div>`);
  media.appendChild(imgEl);
  media.appendChild(prevBtn);
  media.appendChild(nextBtn);
  media.appendChild(counter);

  let caption = null;
  if (meta && (meta.title || meta.text)) {
    caption = el(`
      <div class="lb-caption">
        ${meta.title ? `<div class="lb-title"></div>` : ''}
        ${meta.text ? `<div class="lb-text"></div>` : ''}
      </div>
    `);
    if (meta.title) caption.querySelector('.lb-title').textContent = meta.title;
    if (meta.text) caption.querySelector('.lb-text').textContent = meta.text;
  }

  function render() {
    const p = photos[idx];
    imgEl.src = photoUrl(p);
    counter.textContent = `${idx + 1} / ${photos.length}`;
    const multi = photos.length > 1;
    prevBtn.style.display = multi ? 'flex' : 'none';
    nextBtn.style.display = multi ? 'flex' : 'none';
    counter.style.display = multi ? 'block' : 'none';
  }
  function close() { root.innerHTML = ''; }
  function prev() { idx = (idx - 1 + photos.length) % photos.length; render(); }
  function next() { idx = (idx + 1) % photos.length; render(); }

  header.querySelector('.lb-close').addEventListener('click', close);
  prevBtn.addEventListener('click', (e) => { e.stopPropagation(); prev(); });
  nextBtn.addEventListener('click', (e) => { e.stopPropagation(); next(); });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  let touchStartX = null;
  media.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
  media.addEventListener('touchend', (e) => {
    if (touchStartX === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 40) { dx > 0 ? prev() : next(); }
    touchStartX = null;
  }, { passive: true });

  post.appendChild(header);
  post.appendChild(media);
  if (caption) post.appendChild(caption);

  if (meta) {
    const exportBtn = el(`<button type="button" class="lb-export-btn" title="Export เป็นรูป">${icon('exportArrow', 12)}</button>`);
    exportBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (exportBtn.disabled) return;
      exportBtn.disabled = true;
      exportBtn.classList.add('busy');
      try {
        await exportMomentImage({
          photo: photos[idx],
          dateText: headerDate.textContent,
          title: meta.title,
          text: meta.text,
        });
        toast('บันทึกรูปแล้ว 🎉');
      } catch (err) {
        toast('ส่งออกไม่สำเร็จ ลองใหม่อีกครั้ง');
      } finally {
        exportBtn.disabled = false;
        exportBtn.classList.remove('busy');
      }
    });
    post.appendChild(exportBtn);
  }

  overlay.appendChild(post);
  root.appendChild(overlay);
  render();
}

/* ---------- Export a post (photo + date/title/text) as a cute shareable JPG ---------- */
function loadImageEl(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // photos now load from Supabase Storage — needed so canvas.toBlob() isn't tainted
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawImageCover(ctx, img, x, y, w, h) {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (img.width - sw) / 2;
  const sy = (img.height - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function wrapCanvasText(ctx, text, maxWidth) {
  const paragraphs = text.split('\n');
  const lines = [];
  paragraphs.forEach((para) => {
    if (!para) { lines.push(''); return; }
    let line = '';
    for (const ch of para) {
      const test = line + ch;
      if (line && ctx.measureText(test).width > maxWidth) {
        lines.push(line);
        line = ch;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
  });
  return lines;
}

const EXPORT_FONT_FAMILY = 'Prompt, sans-serif';
let _exportFontPromise = null;
function ensureExportFont() {
  if (!_exportFontPromise) {
    _exportFontPromise = (async () => {
      try {
        if (!document.getElementById('export-font-link')) {
          const link = document.createElement('link');
          link.id = 'export-font-link';
          link.rel = 'stylesheet';
          link.href = 'https://fonts.googleapis.com/css2?family=Prompt:wght@400;600;700&display=swap';
          document.head.appendChild(link);
        }
        await Promise.all([
          document.fonts.load('400 32px Prompt'),
          document.fonts.load('700 44px Prompt'),
        ]);
      } catch (e) { /* offline or blocked — falls back to sans-serif */ }
    })();
  }
  return _exportFontPromise;
}

async function exportMomentImage({ photo, dateText, title, text }) {
  await ensureExportFont();

  const photoSize = 1000;
  const BORDER = 37;
  const W = photoSize + BORDER * 2;
  const photoW = photoSize;
  const photoH = photoSize;
  const photoX = BORDER;
  const photoY = BORDER;
  const titleFont = `700 44px ${EXPORT_FONT_FAMILY}`;
  const textFont = `400 32px ${EXPORT_FONT_FAMILY}`;
  const lineHeightTitle = 54;
  const lineHeightText = 46;
  const gapAfterPhoto = 34;
  const gapAfterTitle = 14;
  const bottomPad = 40;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  ctx.font = titleFont;
  const titleLines = title ? wrapCanvasText(ctx, title, photoW) : [];
  ctx.font = textFont;
  const textLines = text ? wrapCanvasText(ctx, text, photoW) : [];

  const captionH = (titleLines.length ? titleLines.length * lineHeightTitle + gapAfterTitle : 0)
    + (textLines.length ? textLines.length * lineHeightText : 0);

  const H = BORDER + photoH + gapAfterPhoto + captionH + bottomPad;
  canvas.width = W;
  canvas.height = H;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  if (photo) {
    const img = await loadImageEl(photoUrl(photo));
    drawImageCover(ctx, img, photoX, photoY, photoW, photoH);
  }

  if (dateText) {
    ctx.font = '600 30px "Courier New", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 6;
    ctx.fillStyle = '#ff9f2e';
    ctx.fillText(dateText, photoX + photoW - 22, photoY + photoH - 22);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }

  let cy = photoY + photoH + gapAfterPhoto;
  const textX = photoX;

  if (titleLines.length) {
    ctx.font = titleFont;
    ctx.fillStyle = '#3f3a3a';
    ctx.textAlign = 'left';
    titleLines.forEach((line, i) => { ctx.fillText(line, textX, cy + (i + 1) * lineHeightTitle - 14); });
    cy += titleLines.length * lineHeightTitle + gapAfterTitle;
  }

  if (textLines.length) {
    ctx.font = textFont;
    ctx.fillStyle = '#6b6260';
    ctx.textAlign = 'left';
    textLines.forEach((line, i) => { ctx.fillText(line, textX, cy + (i + 1) * lineHeightText - 12); });
    cy += textLines.length * lineHeightText;
  }

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  const filename = `daily-journal-${dateText.replace(/[^\d]/g, '-')}.jpg`;

  // On phones, the share sheet's "Save Image" gets it into Photos/Camera Roll in
  // one tap — a plain <a download> instead pops a generic "save to Files" dialog,
  // which is what we're trying to avoid.
  const file = new File([blob], filename, { type: 'image/jpeg' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') return; // user backed out of the share sheet
      // any other error (e.g. share permission lost) — fall through to the download link
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function setFab(iconHtml, onClick) {
  let fab = document.getElementById('global-fab');
  if (!fab) {
    fab = document.createElement('button');
    fab.id = 'global-fab';
    fab.className = 'fab';
    document.body.appendChild(fab);
  }
  fab.innerHTML = iconHtml;
  fab.style.display = 'flex';
  fab.onclick = onClick;
}

function clearFab() {
  const fab = document.getElementById('global-fab');
  if (fab) fab.style.display = 'none';
}

function moodPicker(selectedKey) {
  const wrap = el(`<div class="mood-picker"></div>`);
  let current = selectedKey || null;
  MOODS.forEach((m) => {
    const opt = el(`
      <button type="button" class="mood-opt" data-key="${m.key}" title="${escapeHtml(m.label)}" style="--mood-color:${m.color};--mood-bg:${m.bg}">
        <span class="emo">${m.emoji}</span>
      </button>
    `);
    if (current === m.key) opt.classList.add('selected');
    opt.addEventListener('click', () => {
      current = m.key;
      wrap.querySelectorAll('.mood-opt').forEach((o) => o.classList.remove('selected'));
      opt.classList.add('selected');
    });
    wrap.appendChild(opt);
  });
  return { root: wrap, getValue: () => current };
}
