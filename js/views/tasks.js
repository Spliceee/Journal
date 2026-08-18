/* ---------- Tab 4: Task calendar ---------- */

const TasksView = (() => {
  let filterDate = null;
  let rootEl = null;
  let cats = [];
  let viewDate = new Date();
  let calGridEl = null;
  let calTitleEl = null;

  async function loadCats() {
    cats = await DB.getAll('taskCategories');
    return cats;
  }
  async function loadTasks() {
    const all = await DB.getAll('tasks');
    all.sort((a, b) => (a.date !== b.date ? (a.date > b.date ? 1 : -1) : (a.time || '').localeCompare(b.time || '')));
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
          if (ok) { await DB.delete('taskCategories', c.id); await loadCats(); drawList(); TasksView.rerender(); }
        });
        list.appendChild(chip);
      });
      if (cats.length === 0) list.appendChild(el(`<div style="font-size:12.5px;color:var(--ink-soft);">ยังไม่มีหมวดหมู่</div>`));
    }
    drawList();

    const nameField = el(`<div class="field"><label>ชื่อหมวดหมู่</label><input type="text" id="cat-name" placeholder="เช่น งาน, ส่วนตัว, นัดหมาย"></div>`);
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
      await DB.add('taskCategories', { id: DB.uid(), name, color: chosenColor });
      body.querySelector('#cat-name').value = '';
      await loadCats();
      drawList();
      TasksView.rerender();
    });

    body.appendChild(nameField);
    body.appendChild(colorField);
    body.appendChild(addBtn);
    openSheet('จัดการหมวดหมู่', body);
  }

  function buildForm(existing) {
    const isEdit = !!existing;
    const body = el('<div></div>');
    const dateField = el(`<div class="field"><label>วันที่</label></div>`);
    const datePicker = createCalendarDatePicker({ value: existing ? existing.date : (filterDate || todayStr()) });
    dateField.appendChild(datePicker.root);
    const timeField = el(`<div class="field"><label>เวลา</label><input type="time" id="f-time" value="${existing ? existing.time || '' : ''}"></div>`);

    const catField = el(`<div class="field"><label>หมวดหมู่</label></div>`);
    const catRow = el('<div class="chip-row"></div>');
    let selectedCat = existing ? existing.categoryId || null : null;
    function drawCatRow() {
      catRow.innerHTML = '';
      if (cats.length === 0) {
        catRow.appendChild(el(`<span style="font-size:12.5px;color:var(--ink-soft);">ยังไม่มีหมวดหมู่ กดจัดการหมวดหมู่ก่อน</span>`));
        return;
      }
      cats.forEach((c) => {
        const chip = el(`<span class="chip ${selectedCat === c.id ? '' : 'outline'}" style="${selectedCat === c.id ? `background:${c.color}` : ''};--chip-color:${c.color}">${escapeHtml(c.name)}</span>`);
        chip.addEventListener('click', () => { selectedCat = selectedCat === c.id ? null : c.id; drawCatRow(); });
        catRow.appendChild(chip);
      });
    }
    drawCatRow();
    catField.appendChild(catRow);
    const manageLink = el(`<button type="button" class="btn secondary sm" style="margin-top:8px;">+ Category</button>`);
    manageLink.addEventListener('click', () => openCategoryManager());
    catField.appendChild(manageLink);

    const contentField = el(`<div class="field"><label>รายละเอียดงาน</label><textarea id="f-content" placeholder="ต้องทำอะไร">${existing ? escapeHtml(existing.content || '') : ''}</textarea></div>`);
    const locField = el(`<div class="field"><label>สถานที่</label><input type="text" id="f-loc" placeholder="สถานที่ (ถ้ามี)" value="${existing ? escapeHtml(existing.location || '') : ''}"></div>`);
    const saveBtn = el(`<button class="btn block">${isEdit ? 'บันทึกการแก้ไข' : 'เพิ่มงาน'}</button>`);

    saveBtn.addEventListener('click', async () => {
      const date = datePicker.getValue() || todayStr();
      const time = body.querySelector('#f-time').value;
      const content = body.querySelector('#f-content').value.trim();
      const location = body.querySelector('#f-loc').value.trim();
      if (!content) { toast('กรุณาใส่รายละเอียดงาน'); return; }

      const record = {
        id: existing ? existing.id : DB.uid(),
        date, time, content, location, categoryId: selectedCat,
        createdAt: existing ? existing.createdAt : Date.now(),
      };
      await DB.put('tasks', record);
      closeSheet();
      toast('บันทึกแล้ว 🗓️');
      TasksView.rerender();
    });

    body.appendChild(dateField);
    body.appendChild(timeField);
    body.appendChild(catField);
    body.appendChild(contentField);
    body.appendChild(locField);
    body.appendChild(saveBtn);
    return body;
  }

  function openNew() { openSheet('เพิ่มงานใหม่', buildForm(null)); }
  function openEdit(t) { openSheet('แก้ไขงาน', buildForm(t)); }

  function taskRow(t) {
    const cat = catById(t.categoryId);
    const card = el(`
      <div class="card entry-card">
        <div class="head">
          <span class="date-lbl">${formatDateNumeric(t.date)}${t.time ? ' · ' + escapeHtml(t.time) : ''}</span>
          ${cat ? `<span class="entry-tag"><span class="dot" style="background:${cat.color}"></span>${escapeHtml(cat.name)}</span>` : ''}
        </div>
        <div class="text"></div>
        ${t.location ? `<div style="font-size:12px;color:var(--ink-soft);margin-top:6px;">📍 ${escapeHtml(t.location)}</div>` : ''}
        <div class="entry-actions">
          <button class="icon-btn edit">${icon('pencil', 15)} แก้ไข</button>
          <button class="icon-btn del">${icon('trash', 15)} ลบ</button>
        </div>
      </div>
    `);
    card.querySelector('.text').textContent = t.content;
    card.querySelector('.edit').addEventListener('click', () => openEdit(t));
    card.querySelector('.del').addEventListener('click', async () => {
      const ok = await confirmDialog('ลบงานนี้หรือไม่?');
      if (ok) { await DB.delete('tasks', t.id); toast('ลบแล้ว'); TasksView.rerender(); }
    });
    return card;
  }

  function drawCatChips() {
    const chipRow = rootEl.querySelector('#tk-cat-chips');
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
    const all = await loadTasks();
    const dayMap = {};
    all.forEach((t) => { (dayMap[t.date] = dayMap[t.date] || []).push(t); });

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
      const dayTasks = dayMap[dateStr] || [];
      const btn = el(`
        <button type="button" class="cal-day cal-day-labeled">
          <span class="cal-day-num">${d}</span>
          <div class="cal-day-events"></div>
        </button>
      `);
      if (dateStr === todayStr()) btn.classList.add('today');
      if (dateStr === filterDate) btn.classList.add('selected');
      const eventsWrap = btn.querySelector('.cal-day-events');
      dayTasks.slice(0, MAX_LABELS).forEach((t) => {
        const cat = catById(t.categoryId);
        const color = cat ? cat.color : TASK_DOT;
        const label = t.content || (cat ? cat.name : 'งาน');
        eventsWrap.appendChild(el(`<span class="cal-day-chip" style="background:${color}">${escapeHtml(label)}</span>`));
      });
      if (dayTasks.length > MAX_LABELS) {
        eventsWrap.appendChild(el(`<span class="cal-day-more">+${dayTasks.length - MAX_LABELS} เพิ่มเติม</span>`));
      }
      btn.addEventListener('click', () => selectDate(dateStr));
      calGridEl.appendChild(btn);
    }
  }

  async function renderList() {
    const listWrap = rootEl.querySelector('#task-list');
    listWrap.innerHTML = '';
    let all = await loadTasks();
    if (filterDate) all = all.filter((t) => t.date === filterDate);

    if (all.length === 0) {
      listWrap.appendChild(el(`<div class="empty-state"><div class="big">🗓️</div><div class="txt">ไม่มีงานที่ต้องทำ</div></div>`));
      return;
    }
    all.forEach((t) => listWrap.appendChild(taskRow(t)));
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
          <button class="cal-nav-btn" id="tk-prev-m">${icon('chevronLeft', 16)}</button>
          <span class="cal-title" id="tk-cal-title"></span>
          <button class="cal-nav-btn" id="tk-next-m">${icon('chevronRight', 16)}</button>
        </div>
      `);
      calGridEl = el('<div class="cal-grid cal-grid-labeled"></div>');
      calTitleEl = calHeader.querySelector('#tk-cal-title');
      root.appendChild(calHeader);
      root.appendChild(calGridEl);
      calHeader.querySelector('#tk-prev-m').addEventListener('click', () => { viewDate.setMonth(viewDate.getMonth() - 1); drawCalendarDays(); });
      calHeader.querySelector('#tk-next-m').addEventListener('click', () => { viewDate.setMonth(viewDate.getMonth() + 1); drawCalendarDays(); });

      const catSection = el(`<div class="card" style="padding:14px 16px;margin-top:16px;"></div>`);
      const catHead = el(`<div style="margin-bottom:10px;"><span style="font-size:13px;font-weight:500;color:var(--ink-soft);">หมวดหมู่</span></div>`);
      catSection.appendChild(catHead);
      const chipRow = el('<div class="chip-row" id="tk-cat-chips"></div>');
      catSection.appendChild(chipRow);
      root.appendChild(catSection);
      drawCatChips();

      const listWrap = el('<div id="task-list" style="margin-top:16px;"></div>');
      root.appendChild(listWrap);

      setFab(icon('plus', 24), openNew);
      drawCalendarDays();
      renderList();
    },
    async rerender() { await loadCats(); drawCatChips(); drawCalendarDays(); renderList(); },
  };
})();

window.Views = window.Views || {};
window.Views.tasks = TasksView;
