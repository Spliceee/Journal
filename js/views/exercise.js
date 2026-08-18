/* ---------- Tab 2: Exercise log ---------- */

const PALETTE = ['#f97316', '#ef4444', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#78716c'];

const ExerciseView = (() => {
  let filterDate = null;
  let rootEl = null;
  let cats = [];
  let viewDate = new Date();
  let calGridEl = null;
  let calTitleEl = null;

  async function loadCats() {
    cats = await DB.getAll('exerciseCategories');
    return cats;
  }
  async function loadEntries() {
    const all = await DB.getAll('exerciseEntries');
    all.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : (b.createdAt || 0) - (a.createdAt || 0)));
    return all;
  }

  function catById(id) { return cats.find((c) => c.id === id); }

  function openCategoryManager() {
    const body = el('<div></div>');
    const list = el('<div class="chip-row" style="margin-bottom:16px;"></div>');
    body.appendChild(list);

    function drawList() {
      list.innerHTML = '';
      cats.forEach((c) => {
        const chip = el(`<span class="chip" style="background:${c.color}">${escapeHtml(c.name)} <b style="margin-left:4px;cursor:pointer;display:inline-flex;vertical-align:middle;">${icon('close', 12)}</b></span>`);
        chip.querySelector('b').addEventListener('click', async () => {
          const ok = await confirmDialog(`ลบหมวดหมู่ "${c.name}" หรือไม่?`);
          if (ok) { await DB.delete('exerciseCategories', c.id); await loadCats(); drawList(); ExerciseView.rerender(); }
        });
        list.appendChild(chip);
      });
      if (cats.length === 0) list.appendChild(el(`<div style="font-size:12.5px;color:var(--ink-soft);">ยังไม่มีหมวดหมู่</div>`));
    }
    drawList();

    const nameField = el(`<div class="field"><label>ชื่อสถานที่ / ประเภท</label><input type="text" id="cat-name" placeholder="เช่น สวนลุม, สวนเบญ, ยิม"></div>`);
    const colorField = el(`<div class="field"><label>สี</label><div class="color-swatch-row" id="cat-colors"></div></div>`);
    let chosenColor = PALETTE[0];
    const swatchRow = colorField.querySelector('#cat-colors');
    PALETTE.forEach((c, i) => {
      const sw = el(`<button type="button" class="color-swatch" style="background:${c}"></button>`);
      if (i === 0) sw.classList.add('selected');
      sw.addEventListener('click', () => {
        chosenColor = c;
        swatchRow.querySelectorAll('.color-swatch').forEach((s) => s.classList.remove('selected'));
        sw.classList.add('selected');
      });
      swatchRow.appendChild(sw);
    });
    const addBtn = el(`<button class="btn block">＋ เพิ่มหมวดหมู่</button>`);
    addBtn.addEventListener('click', async () => {
      const name = body.querySelector('#cat-name').value.trim();
      if (!name) { toast('กรุณาใส่ชื่อหมวดหมู่'); return; }
      await DB.add('exerciseCategories', { id: DB.uid(), name, color: chosenColor });
      body.querySelector('#cat-name').value = '';
      await loadCats();
      drawList();
      ExerciseView.rerender();
    });

    body.appendChild(nameField);
    body.appendChild(colorField);
    body.appendChild(addBtn);
    openSheet('จัดการหมวดหมู่', body);
  }

  function buildEntryForm(existing) {
    const isEdit = !!existing;
    const body = el('<div></div>');
    const dateField = el(`<div class="field"><label>วันที่</label></div>`);
    const datePicker = createCalendarDatePicker({ value: existing ? existing.date : todayStr(), maxDate: todayStr() });
    dateField.appendChild(datePicker.root);

    const catField = el(`<div class="field"><label>หมวดหมู่ / สถานที่</label></div>`);
    const catRow = el('<div class="chip-row"></div>');
    let selectedCat = existing ? existing.categoryId : (cats[0] ? cats[0].id : null);
    function drawCatRow() {
      catRow.innerHTML = '';
      if (cats.length === 0) {
        catRow.appendChild(el(`<span style="font-size:12.5px;color:var(--ink-soft);">ยังไม่มีหมวดหมู่ กดจัดการหมวดหมู่ก่อน</span>`));
        return;
      }
      cats.forEach((c) => {
        const chip = el(`<span class="chip ${selectedCat === c.id ? '' : 'outline'}" style="${selectedCat === c.id ? `background:${c.color}` : ''};--chip-color:${c.color}">${escapeHtml(c.name)}</span>`);
        chip.addEventListener('click', () => { selectedCat = c.id; drawCatRow(); });
        catRow.appendChild(chip);
      });
    }
    drawCatRow();
    catField.appendChild(catRow);
    const manageLink = el(`<button type="button" class="btn secondary sm" style="margin-top:8px;">+ Category</button>`);
    manageLink.addEventListener('click', () => openCategoryManager());
    catField.appendChild(manageLink);

    const notesField = el(`<div class="field"><label>บันทึกเพิ่มเติม</label><textarea id="f-notes" placeholder="รายละเอียด เช่น ท่าที่เล่น ระยะที่วิ่ง">${existing ? escapeHtml(existing.notes || '') : ''}</textarea></div>`);

    const photoField = el(`<div class="field"><label>รูปสถิติ (เช่น จาก Strava)</label></div>`);
    const pp = createPhotoPicker({ existing: existing && existing.photo ? [existing.photo] : [], max: 1 });
    photoField.appendChild(pp.root);

    const saveBtn = el(`<button class="btn block">${isEdit ? 'บันทึกการแก้ไข' : 'บันทึก'}</button>`);
    saveBtn.addEventListener('click', async () => {
      if (!selectedCat) { toast('กรุณาเลือกหมวดหมู่'); return; }
      const date = datePicker.getValue() || todayStr();
      const notes = body.querySelector('#f-notes').value.trim();
      const { keepIds, newFiles } = pp.getState();

      saveBtn.disabled = true;
      saveBtn.textContent = 'กำลังบันทึก...';

      let photo = existing && existing.photo && keepIds.includes(existing.photo.id) ? existing.photo : null;
      if (newFiles[0]) {
        photo = await uploadPhoto(newFiles[0]);
      }

      const record = {
        id: existing ? existing.id : DB.uid(),
        date, categoryId: selectedCat, notes, photo,
        createdAt: existing ? existing.createdAt : Date.now(),
      };
      await DB.put('exerciseEntries', record);
      closeSheet();
      toast('บันทึกแล้ว 🏃');
      ExerciseView.rerender();
    });

    body.appendChild(dateField);
    body.appendChild(catField);
    body.appendChild(notesField);
    body.appendChild(photoField);
    body.appendChild(saveBtn);
    return body;
  }

  function openNew() {
    if (cats.length === 0) { openCategoryManager(); return; }
    openSheet('บันทึกการออกกำลังกาย', buildEntryForm(null));
  }
  function openEdit(entry) {
    openSheet('แก้ไขบันทึก', buildEntryForm(entry));
  }

  function entryCard(entry) {
    const cat = catById(entry.categoryId);
    const card = el(`
      <div class="card entry-card">
        <div class="head">
          <span class="date-lbl">${formatDateNumeric(entry.date)}</span>
          <span class="entry-tag"><span class="dot" style="background:${cat ? cat.color : '#999'}"></span>${cat ? escapeHtml(cat.name) : 'ไม่ทราบหมวด'}</span>
        </div>
        ${entry.notes ? `<div class="text"></div>` : ''}
      </div>
    `);
    if (entry.notes) card.querySelector('.text').textContent = entry.notes;
    if (entry.photo) {
      const row = el('<div class="entry-photos"></div>');
      const img = el(`<img src="${photoUrl(entry.photo)}">`);
      img.addEventListener('click', () => openLightbox([entry.photo], 0, {
        date: formatDateNumeric(entry.date),
        title: cat ? cat.name : null,
        text: entry.notes,
        noCrop: true,
      }));
      row.appendChild(img);
      card.appendChild(row);
    }
    const actions = el(`
      <div class="entry-actions">
        <button class="icon-btn edit">Edit</button>
        <button class="icon-btn del">Delete</button>
      </div>
    `);
    actions.querySelector('.edit').addEventListener('click', () => openEdit(entry));
    actions.querySelector('.del').addEventListener('click', async () => {
      const ok = await confirmDialog('ลบบันทึกนี้หรือไม่?');
      if (ok) { await DB.delete('exerciseEntries', entry.id); toast('ลบแล้ว'); ExerciseView.rerender(); }
    });
    card.appendChild(actions);
    return card;
  }

  function drawCatChips() {
    const chipRow = rootEl.querySelector('#ex-cat-chips');
    if (!chipRow) return;
    chipRow.innerHTML = '';
    if (cats.length === 0) {
      chipRow.appendChild(el(`<span style="font-size:12.5px;color:var(--ink-soft);">ยังไม่มีหมวดหมู่ กดจัดการเพื่อเพิ่ม</span>`));
    } else {
      cats.forEach((c) => chipRow.appendChild(el(`<span class="chip" style="background:${c.color}">${escapeHtml(c.name)}</span>`)));
    }
  }

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

    const MAX_LABELS = 3;
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${pad2(month + 1)}-${pad2(d)}`;
      const dayEntries = dayMap[dateStr] || [];
      const btn = el(`
        <button type="button" class="cal-day cal-day-labeled">
          <span class="cal-day-num">${d}</span>
          <div class="cal-day-events"></div>
        </button>
      `);
      if (dateStr === todayStr()) btn.classList.add('today');
      if (dateStr === filterDate) btn.classList.add('selected');
      const eventsWrap = btn.querySelector('.cal-day-events');
      dayEntries.slice(0, MAX_LABELS).forEach((e) => {
        const cat = catById(e.categoryId);
        const color = cat ? cat.color : EXERCISE_DOT_FALLBACK;
        const label = cat ? cat.name : 'ออกกำลังกาย';
        eventsWrap.appendChild(el(`<span class="cal-day-chip" style="background:${color}">${escapeHtml(label)}</span>`));
      });
      if (dayEntries.length > MAX_LABELS) {
        eventsWrap.appendChild(el(`<span class="cal-day-more">+${dayEntries.length - MAX_LABELS} เพิ่มเติม</span>`));
      }
      btn.addEventListener('click', () => selectDate(dateStr));
      calGridEl.appendChild(btn);
    }
  }

  async function renderList() {
    const listWrap = rootEl.querySelector('#ex-list');
    listWrap.innerHTML = '';
    let entries = await loadEntries();
    if (filterDate) entries = entries.filter((e) => e.date === filterDate);
    if (entries.length === 0) {
      listWrap.appendChild(el(`<div class="empty-state"><div class="big">🏃</div><div class="txt">ยังไม่มีบันทึกการออกกำลังกาย</div></div>`));
      return;
    }
    entries.forEach((e) => listWrap.appendChild(entryCard(e)));
  }

  return {
    async render(root, params = {}) {
      filterDate = params.filterDate || null;
      if (filterDate) {
        const [y, m] = filterDate.split('-').map(Number);
        viewDate = new Date(y, m - 1, 1);
      }
      rootEl = root;
      root.innerHTML = '';
      await loadCats();

      const calHeader = el(`
        <div class="cal-header">
          <button class="cal-nav-btn" id="ex-prev-m">${icon('chevronLeft', 16)}</button>
          <span class="cal-title" id="ex-cal-title"></span>
          <button class="cal-nav-btn" id="ex-next-m">${icon('chevronRight', 16)}</button>
        </div>
      `);
      calGridEl = el('<div class="cal-grid cal-grid-labeled"></div>');
      calTitleEl = calHeader.querySelector('#ex-cal-title');
      root.appendChild(calHeader);
      root.appendChild(calGridEl);
      calHeader.querySelector('#ex-prev-m').addEventListener('click', () => { viewDate.setMonth(viewDate.getMonth() - 1); drawCalendarDays(); });
      calHeader.querySelector('#ex-next-m').addEventListener('click', () => { viewDate.setMonth(viewDate.getMonth() + 1); drawCalendarDays(); });

      const catSection = el(`<div class="card" style="padding:14px 16px;margin-top:16px;"></div>`);
      const catHead = el(`<div style="margin-bottom:10px;"><span style="font-size:13px;font-weight:500;color:var(--ink-soft);">หมวดหมู่</span></div>`);
      catSection.appendChild(catHead);
      const chipRow = el('<div class="chip-row" id="ex-cat-chips"></div>');
      catSection.appendChild(chipRow);
      root.appendChild(catSection);
      drawCatChips();

      const listWrap = el('<div id="ex-list"></div>');
      root.appendChild(listWrap);

      setFab(icon('plus', 24), openNew);
      drawCalendarDays();
      renderList();
    },
    async rerender() { await loadCats(); drawCatChips(); drawCalendarDays(); renderList(); },
  };
})();

window.Views = window.Views || {};
window.Views.exercise = ExerciseView;
