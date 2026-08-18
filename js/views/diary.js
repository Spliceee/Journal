/* ---------- Tab 1: Daily diary ---------- */

const DiaryView = (() => {
  let filterDate = null;
  let viewDate = new Date();
  let calGridEl = null;
  let calTitleEl = null;

  async function loadEntries() {
    const all = await DB.getAll('diary');
    all.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : (b.createdAt || 0) - (a.createdAt || 0)));
    return all;
  }

  function buildForm(existing) {
    const isEdit = !!existing;
    const body = el('<div></div>');
    const dateField = el(`<div class="field"><label>วันที่</label></div>`);
    const datePicker = createCalendarDatePicker({ value: existing ? existing.date : todayStr(), maxDate: todayStr() });
    dateField.appendChild(datePicker.root);
    const moodField = el(`<div class="field"><label>ความรู้สึกวันนี้</label></div>`);
    const mp = moodPicker(existing ? existing.mood : null);
    moodField.appendChild(mp.root);

    const titleField = el(`
      <div class="field"><label>หัวข้อ</label><input type="text" id="f-title" placeholder="เช่น วันนี้ดีต่องานได้ว้อยอย่างอะ" value="${existing ? escapeHtml(existing.title || '') : ''}"></div>
    `);

    const textField = el(`
      <div class="field"><label>เนื้อหา</label><textarea id="f-text" placeholder="วันนี้เป็นยังไงบ้าง...">${existing ? escapeHtml(existing.text || '') : ''}</textarea></div>
    `);

    const photoField = el(`<div class="field"><label>รูปภาพ</label></div>`);
    const pp = createPhotoPicker({ existing: existing ? existing.photos || [] : [], max: 9 });
    photoField.appendChild(pp.root);

    const saveBtn = el(`<button class="btn block" id="f-save">${isEdit ? 'บันทึกการแก้ไข' : 'บันทึก'}</button>`);

    body.appendChild(dateField);
    body.appendChild(moodField);
    body.appendChild(titleField);
    body.appendChild(textField);
    body.appendChild(photoField);
    body.appendChild(saveBtn);

    saveBtn.addEventListener('click', async () => {
      const date = datePicker.getValue() || todayStr();
      const title = body.querySelector('#f-title').value.trim();
      const text = body.querySelector('#f-text').value.trim();
      const mood = mp.getValue();
      const { keepIds, newFiles } = pp.getState();
      const keptCount = (existing ? existing.photos || [] : []).filter((p) => keepIds.includes(p.id)).length;

      if (!title && !text && !mood && keptCount === 0 && newFiles.length === 0) {
        toast('กรุณาใส่ข้อมูลก่อนบันทึก');
        return;
      }

      if (!mood && (title || text)) {
        const goPick = await confirmDialog('วันนี้อารมณ์เป็นยังไงหรอ\nลองเลือกดูมั้ย?', {
          center: true, danger: false, confirmLabel: 'เลือกอารมณ์', cancelLabel: 'ข้ามไปก่อน',
        });
        if (goPick) return;
      }

      saveBtn.disabled = true;
      saveBtn.textContent = 'กำลังบันทึก...';

      const keptPhotos = (existing ? existing.photos || [] : []).filter((p) => keepIds.includes(p.id));
      const newPhotos = [];
      for (const f of newFiles) {
        newPhotos.push(await uploadPhoto(f));
      }

      const record = {
        id: existing ? existing.id : DB.uid(),
        date, title, text, mood,
        photos: keptPhotos.concat(newPhotos),
        createdAt: existing ? existing.createdAt : Date.now(),
      };
      await DB.put('diary', record);
      closeSheet();
      toast('บันทึกแล้ว 💕');
      DiaryView.rerender();
    });

    return body;
  }

  function openNew() {
    openSheet('เขียนบันทึกใหม่', buildForm(null));
  }
  function openEdit(entry) {
    openSheet('แก้ไขบันทึก', buildForm(entry));
  }

  function entryGridCard(entry, showTime) {
    const mood = moodByKey(entry.mood);
    const photos = entry.photos || [];
    const hasPhoto = photos.length > 0;

    const card = el(`<div class="diary-grid-card"></div>`);

    const cover = el(`<div class="diary-grid-cover"></div>`);
    if (hasPhoto) {
      cover.appendChild(el(`<img src="${photoUrl(photos[0])}">`));
      if (photos.length > 1) cover.appendChild(el(`<span class="photo-count">${icon('camera', 10)} ${photos.length}</span>`));
      cover.addEventListener('click', () => openLightbox(photos, 0, {
        date: formatDateNumeric(entry.date),
        time: showTime ? formatTimeHHMM(entry.createdAt) : null,
        title: entry.title,
        text: entry.text,
      }));
    } else {
      cover.classList.add('placeholder');
      cover.style.background = mood ? mood.bg : 'var(--bg)';
      cover.appendChild(el(`<span class="ph-emoji">${mood ? mood.emoji : '📝'}</span>`));
      cover.addEventListener('click', () => openEdit(entry));
    }

    const caption = el(`
      <div class="diary-grid-caption">
        <div class="dgc-top">
          <span class="date-lbl">${formatDateNumeric(entry.date)}</span>
          ${mood ? `<span class="mood-emoji-sm" title="${escapeHtml(mood.label)}">${mood.emoji}</span>` : ''}
        </div>
        ${entry.title ? `<div class="dgc-title"></div>` : ''}
      </div>
    `);
    if (entry.title) caption.querySelector('.dgc-title').textContent = entry.title;
    caption.addEventListener('click', () => openEdit(entry));

    const actions = el(`
      <div class="dgc-actions">
        <button class="edit" title="แก้ไข">${icon('pencil', 13)}</button>
        <button class="del" title="ลบ">${icon('trash', 13)}</button>
      </div>
    `);
    actions.querySelector('.edit').addEventListener('click', (e) => { e.stopPropagation(); openEdit(entry); });
    actions.querySelector('.del').addEventListener('click', async (e) => {
      e.stopPropagation();
      const ok = await confirmDialog('ลบบันทึกนี้หรือไม่?');
      if (ok) { await DB.delete('diary', entry.id); toast('ลบแล้ว'); DiaryView.rerender(); }
    });

    card.appendChild(cover);
    card.appendChild(caption);
    card.appendChild(actions);
    return card;
  }

  let rootEl = null;

  function selectDate(dateStr) {
    filterDate = filterDate === dateStr ? null : dateStr;
    drawCalendarDays();
    renderList();
  }

  async function drawCalendarDays() {
    if (!calGridEl) return;
    const entries = await loadEntries();
    const dayMap = {};
    entries.forEach((e) => { (dayMap[e.date] = dayMap[e.date] || []).push(e); });

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    calTitleEl.textContent = `${THAI_MONTHS[month]} ${year}`;

    calGridEl.innerHTML = '';
    THAI_DAYS_SHORT.forEach((d) => calGridEl.appendChild(el(`<div class="cal-dow">${d}</div>`)));

    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let i = 0; i < startOffset; i++) calGridEl.appendChild(el(`<div class="cal-day empty"></div>`));

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${pad2(month + 1)}-${pad2(d)}`;
      const dayEntries = dayMap[dateStr];
      const btn = el(`<button type="button" class="cal-day"><span>${d}</span><span class="dots"></span></button>`);
      if (dateStr === todayStr()) btn.classList.add('today');
      if (dateStr === filterDate) btn.classList.add('selected');
      if (dayEntries) {
        const dotsWrap = btn.querySelector('.dots');
        const colors = [];
        dayEntries.forEach((e) => {
          const mood = moodByKey(e.mood);
          const color = mood ? mood.color : '#9ca3af';
          if (!colors.includes(color)) colors.push(color);
        });
        colors.slice(0, 4).forEach((c) => dotsWrap.appendChild(el(`<span class="dot" style="background:${c}"></span>`)));
      }
      btn.addEventListener('click', () => selectDate(dateStr));
      calGridEl.appendChild(btn);
    }
  }

  async function renderList() {
    const listWrap = rootEl.querySelector('#diary-list');
    listWrap.innerHTML = '';
    let entries = await loadEntries();
    if (filterDate) entries = entries.filter((e) => e.date === filterDate);

    if (entries.length === 0) {
      listWrap.appendChild(el(`<div class="empty-state"><div class="big">📝</div><div class="txt">ยังไม่มีบันทึก ลองกดปุ่ม + เพื่อเริ่มเขียน</div></div>`));
      return;
    }
    const dateCounts = {};
    entries.forEach((e) => { dateCounts[e.date] = (dateCounts[e.date] || 0) + 1; });

    const grid = el('<div class="diary-grid"></div>');
    entries.forEach((e) => grid.appendChild(entryGridCard(e, dateCounts[e.date] > 1)));
    listWrap.appendChild(grid);
  }

  return {
    render(root, params = {}) {
      filterDate = params.filterDate || null;
      if (filterDate) {
        const [y, m] = filterDate.split('-').map(Number);
        viewDate = new Date(y, m - 1, 1);
      }
      rootEl = root;
      root.innerHTML = '';

      const calHeader = el(`
        <div class="cal-header">
          <button class="cal-nav-btn" id="dy-prev-m">${icon('chevronLeft', 16)}</button>
          <span class="cal-title" id="dy-cal-title"></span>
          <button class="cal-nav-btn" id="dy-next-m">${icon('chevronRight', 16)}</button>
        </div>
      `);
      calGridEl = el('<div class="cal-grid"></div>');
      calTitleEl = calHeader.querySelector('#dy-cal-title');
      root.appendChild(calHeader);
      root.appendChild(calGridEl);
      calHeader.querySelector('#dy-prev-m').addEventListener('click', () => { viewDate.setMonth(viewDate.getMonth() - 1); drawCalendarDays(); });
      calHeader.querySelector('#dy-next-m').addEventListener('click', () => { viewDate.setMonth(viewDate.getMonth() + 1); drawCalendarDays(); });

      const listWrap = el('<div id="diary-list" style="margin-top:16px;"></div>');
      root.appendChild(listWrap);

      setFab(icon('plus', 24), openNew);

      drawCalendarDays();
      renderList();
    },
    rerender() { drawCalendarDays(); renderList(); },
  };
})();

window.Views = window.Views || {};
window.Views.diary = DiaryView;
