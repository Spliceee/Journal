/* ---------- Home / Dashboard view ---------- */

const GALLERY_DOT = '#a78bfa';
const TASK_DOT = '#14b8a6';
const EXERCISE_DOT_FALLBACK = '#f59e0b';

const HomeView = (() => {
  let viewDate = new Date(); // month currently displayed
  let selectedDate = todayStr();

  let rootEl = null;

  async function getSetting(key, fallback = '') {
    const rec = await DB.get('settings', key);
    return rec ? rec.value : fallback;
  }

  async function loadProfile() {
    const [name, avatar, birthday, message, goal] = await Promise.all([
      getSetting('userName', ''),
      getSetting('userAvatar', null),
      getSetting('userBirthday', ''),
      getSetting('userMessage', ''),
      getSetting('userGoal', ''),
    ]);
    return { name, avatar, birthday, message, goal };
  }

  function openProfileEditor(profile) {
    const body = el('<div></div>');
    const avatarField = el('<div class="field"><label>รูปโปรไฟล์</label></div>');
    const pp = createPhotoPicker({ existing: profile.avatar ? [profile.avatar] : [], max: 1 });
    avatarField.appendChild(pp.root);

    const nameField = el(`<div class="field"><label>ชื่อ</label><input type="text" id="pf-name" value="${escapeHtml(profile.name)}" placeholder="พิมพ์ชื่อของคุณ"></div>`);

    const birthdayField = el(`
      <div class="field">
        <label>วันเกิด</label>
        <div class="dob-row">
          <select id="pf-bday-d" class="dob-select"></select>
          <select id="pf-bday-m" class="dob-select"></select>
          <select id="pf-bday-y" class="dob-select"></select>
        </div>
      </div>
    `);
    const [exY, exM, exD] = profile.birthday ? profile.birthday.split('-').map(Number) : [null, null, null];
    const dSel = birthdayField.querySelector('#pf-bday-d');
    const mSel = birthdayField.querySelector('#pf-bday-m');
    const ySel = birthdayField.querySelector('#pf-bday-y');
    dSel.innerHTML = '<option value="">วัน</option>' + Array.from({ length: 31 }, (_, i) => i + 1)
      .map((d) => `<option value="${d}" ${d === exD ? 'selected' : ''}>${d}</option>`).join('');
    mSel.innerHTML = '<option value="">เดือน</option>' + THAI_MONTHS_SHORT
      .map((mName, i) => `<option value="${i + 1}" ${i + 1 === exM ? 'selected' : ''}>${mName}</option>`).join('');
    const curYear = new Date().getFullYear();
    let yearOpts = '<option value="">ปี</option>';
    for (let y = curYear; y >= curYear - 100; y--) yearOpts += `<option value="${y}" ${y === exY ? 'selected' : ''}>${y}</option>`;
    ySel.innerHTML = yearOpts;

    const messageField = el(`<div class="field"><label>ข้อความที่อยากเขียน</label><textarea id="pf-message" placeholder="เขียนอะไรสักหน่อย...">${escapeHtml(profile.message)}</textarea></div>`);
    const goalField = el(`<div class="field"><label>Goal</label><input type="text" id="pf-goal" value="${escapeHtml(profile.goal)}" placeholder="เป้าหมายของคุณ"></div>`);

    const saveBtn = el('<button class="btn block">บันทึก</button>');
    saveBtn.addEventListener('click', async () => {
      const newName = body.querySelector('#pf-name').value.trim();
      const dVal = dSel.value, mVal = mSel.value, yVal = ySel.value;
      const newBirthday = (dVal && mVal && yVal) ? `${yVal}-${pad2(Number(mVal))}-${pad2(Number(dVal))}` : '';
      const newMessage = body.querySelector('#pf-message').value.trim();
      const newGoal = body.querySelector('#pf-goal').value.trim();
      const { keepIds, newFiles } = pp.getState();

      saveBtn.disabled = true;
      saveBtn.textContent = 'กำลังบันทึก...';

      let avatar = profile.avatar && keepIds.includes(profile.avatar.id) ? profile.avatar : null;
      if (newFiles[0]) {
        avatar = await uploadPhoto(newFiles[0]);
      }

      await setSettings({
        userName: newName,
        userAvatar: avatar,
        userBirthday: newBirthday,
        userMessage: newMessage,
        userGoal: newGoal,
      });
      closeSheet();
      toast('บันทึกโปรไฟล์แล้ว');
      if (rootEl) renderAll(rootEl);
    });

    const signOutBtn = el('<button type="button" class="btn secondary block" style="margin-top:10px;">ออกจากระบบ</button>');
    signOutBtn.addEventListener('click', async () => {
      const ok = await confirmDialog('ออกจากระบบหรือไม่?');
      if (ok) { closeSheet(); await signOut(); }
    });

    body.appendChild(avatarField);
    body.appendChild(nameField);
    body.appendChild(birthdayField);
    body.appendChild(messageField);
    body.appendChild(goalField);
    body.appendChild(saveBtn);
    body.appendChild(signOutBtn);
    openSheet('แก้ไขโปรไฟล์', body);
  }

  const MOOD_CHART_DAYS = 14;

  function buildMoodPoints(diaryEntries) {
    const byDate = {};
    diaryEntries.forEach((e) => {
      if (!e.mood) return;
      if (!byDate[e.date] || (e.createdAt || 0) > (byDate[e.date].createdAt || 0)) byDate[e.date] = e;
    });

    const points = [];
    for (let i = MOOD_CHART_DAYS - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = dateToStr(d);
      const entry = byDate[dateStr];
      const mood = entry ? moodByKey(entry.mood) : null;
      const level = mood ? MOODS.findIndex((m) => m.key === mood.key) + 1 : 0;
      points.push({ dateStr, day: d.getDate(), level, mood });
    }
    return points;
  }

  function happyScore(points) {
    const scored = points.filter((p) => p.level > 0);
    if (scored.length === 0) return 0;
    const avg = scored.reduce((sum, p) => sum + p.level, 0) / scored.length;
    return Math.round((avg / MOODS.length) * 100);
  }

  function moodChartSection(points) {
    const wrap = el('<div></div>');
    wrap.appendChild(el(`<div class="section-title">Mood Tracker</div>`));

    const hasAny = points.some((p) => p.level > 0);

    if (!hasAny) {
      wrap.appendChild(el(`<div class="card"><div class="empty-state" style="padding:20px 8px;"><div class="big">🙂</div><div class="txt">ยังไม่มีข้อมูลอารมณ์ในช่วงนี้</div></div></div>`));
      return wrap;
    }

    const card = el('<div class="card mood-chart-card"></div>');
    const bars = el('<div class="mood-bars"></div>');
    const labels = el('<div class="mood-labels"></div>');

    points.forEach((p) => {
      const heightPct = p.level ? (p.level / MOODS.length) * 100 : 6;
      const col = el(`
        <div class="mood-bar-col">
          <div class="mood-bar-emoji">${p.mood ? p.mood.emoji : ''}</div>
          <div class="mood-bar" style="height:${heightPct}%;background:${p.mood ? p.mood.color : 'var(--line)'};opacity:${p.level ? 1 : 0.5}"></div>
        </div>
      `);
      col.title = p.mood ? `${formatDateNumeric(p.dateStr)} · ${p.mood.label}` : formatDateNumeric(p.dateStr);
      bars.appendChild(col);
      labels.appendChild(el(`<div class="mood-bar-label">${p.day}</div>`));
    });

    card.appendChild(bars);
    card.appendChild(labels);
    wrap.appendChild(card);
    return wrap;
  }

  async function loadAll() {
    const [diary, exercise, exCats, gallery, tasksArr] = await Promise.all([
      DB.getAll('diary'), DB.getAll('exerciseEntries'), DB.getAll('exerciseCategories'),
      DB.getAll('gallery'), DB.getAll('tasks'),
    ]);
    return { diary, exercise, exCats, gallery, tasksArr };
  }

  function buildDayMap({ diary, exercise, exCats, gallery, tasksArr }) {
    const catById = {};
    exCats.forEach((c) => { catById[c.id] = c; });
    const map = {};
    const ensure = (d) => (map[d] = map[d] || { diary: [], exercise: [], gallery: [], tasks: [] });

    diary.forEach((it) => ensure(it.date).diary.push(it));
    exercise.forEach((it) => ensure(it.date).exercise.push(it));
    gallery.forEach((it) => ensure(it.date).gallery.push(it));
    tasksArr.forEach((it) => ensure(it.date).tasks.push(it));

    Object.values(map).forEach((d) => {
      d.diary.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      d.exercise.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    });
    return { map, catById };
  }

  function renderCalendarGrid(container, year, month, dayMap) {
    container.innerHTML = '';
    THAI_DAYS_SHORT.forEach((d) => container.appendChild(el(`<div class="cal-dow">${d}</div>`)));

    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < startOffset; i++) container.appendChild(el(`<div class="cal-day empty"></div>`));

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${pad2(month + 1)}-${pad2(d)}`;
      const info = dayMap[dateStr];
      const btn = el(`<button type="button" class="cal-day"><span>${d}</span><span class="dots"></span></button>`);
      if (dateStr === todayStr()) btn.classList.add('today');
      if (dateStr === selectedDate) btn.classList.add('selected');
      if (info) {
        const dotsWrap = btn.querySelector('.dots');
        if (info.diary.length) {
          const mood = moodByKey(info.diary[0].mood) || {};
          dotsWrap.appendChild(el(`<span class="dot" style="background:${mood.color || '#ccc'}"></span>`));
        }
        if (info.exercise.length) {
          dotsWrap.appendChild(el(`<span class="dot" style="background:${EXERCISE_DOT_FALLBACK}"></span>`));
        }
        if (info.gallery.length) dotsWrap.appendChild(el(`<span class="dot" style="background:${GALLERY_DOT}"></span>`));
        if (info.tasks.length) dotsWrap.appendChild(el(`<span class="dot" style="background:${TASK_DOT}"></span>`));
      }
      btn.addEventListener('click', () => {
        selectedDate = dateStr;
        renderAll(container.closest('.view'));
        openDayDetail(dateStr, dayMap, container._catById);
      });
      container.appendChild(btn);
    }
  }

  function catTag(cat) {
    const c = cat ? cat.color : EXERCISE_DOT_FALLBACK;
    const name = cat ? cat.name : 'ออกกำลังกาย';
    return `<span class="tag" style="background:${c}">${escapeHtml(name)}</span>`;
  }

  function openDayDetail(dateStr, dayMap, catById) {
    const info = dayMap[dateStr] || { diary: [], exercise: [], gallery: [], tasks: [] };
    const body = el('<div></div>');
    const total = info.diary.length + info.exercise.length + info.gallery.length + info.tasks.length;

    if (total === 0) {
      body.appendChild(el(`<div class="empty-state"><div class="big">🌤️</div><div class="txt">ยังไม่มีบันทึกในวันนี้</div></div>`));
    } else {
      const list = el('<div class="day-detail-list"></div>');

      info.diary.forEach((it) => {
        const mood = moodByKey(it.mood) || {};
        const row = el(`
          <div class="mini-entry">
            <span class="tag" style="background:${mood.color || '#999'}">${mood.emoji || ''} ${escapeHtml(mood.label || '')}</span>
            <div class="body"><div class="t">บันทึกประจำวัน</div>${escapeHtml(it.title || '') || '<i style=\'color:var(--ink-soft)\'>ไม่มีหัวข้อ</i>'}</div>
          </div>
        `);
        row.addEventListener('click', () => { closeSheet(); navigate('diary', { filterDate: dateStr }); });
        list.appendChild(row);
      });

      info.exercise.forEach((it) => {
        const cat = catById[it.categoryId];
        const row = el(`
          <div class="mini-entry">
            ${catTag(cat)}
            <div class="body"><div class="t">ออกกำลังกาย</div>${it.notes ? escapeHtml(it.notes) : ''}</div>
          </div>
        `);
        row.addEventListener('click', () => { closeSheet(); navigate('exercise', { filterDate: dateStr }); });
        list.appendChild(row);
      });

      info.gallery.forEach((it) => {
        const row = el(`
          <div class="mini-entry">
            <span class="tag" style="background:${GALLERY_DOT}">รูป+Quote</span>
            <div class="body"><div class="t">โพสต์</div>${escapeHtml((it.quote || '').slice(0, 80))}</div>
          </div>
        `);
        row.addEventListener('click', () => { closeSheet(); navigate('gallery', { filterDate: dateStr }); });
        list.appendChild(row);
      });

      info.tasks.forEach((it) => {
        const row = el(`
          <div class="mini-entry">
            <span class="tag" style="background:${TASK_DOT}">${it.time ? escapeHtml(it.time) : 'งาน'}</span>
            <div class="body"><div class="t">${escapeHtml(it.location || '')}</div>${escapeHtml(it.content || '')}</div>
          </div>
        `);
        row.addEventListener('click', () => { closeSheet(); navigate('tasks', { filterDate: dateStr }); });
        list.appendChild(row);
      });

      body.appendChild(list);
    }
    openSheet(formatDateNumeric(dateStr), body);
  }

  async function renderAll(root) {
    rootEl = root;
    const profile = await loadProfile();
    const data = await loadAll();
    const { map, catById } = buildDayMap(data);
    const moodPoints = buildMoodPoints(data.diary);

    root.innerHTML = '';

    const dateColor = colorForString(todayStr());
    const hello = el(`
      <div class="hello-card">
        <div class="profile-date" style="color:${dateColor}">${formatDateBig(todayStr())}</div>
        <div class="profile-row">
          <div class="profile-avatar" id="profile-avatar"></div>
          <div class="profile-info">
            <div class="profile-name" id="profile-name"></div>
            <div class="profile-extra" id="profile-extra"></div>
          </div>
          <button class="profile-edit-btn" id="profile-edit-btn">${icon('pencil', 15)}</button>
        </div>
        <div class="stat-row">
          <div class="stat-pill"><div class="num">${new Set(data.exercise.filter((d) => d.date.startsWith(todayStr().slice(0, 7))).map((d) => d.date)).size}</div><div class="lbl">ออกกำลังกาย</div></div>
          <div class="stat-pill"><div class="num">${(map[todayStr()] || { tasks: [] }).tasks.length}</div><div class="lbl">งานวันนี้</div></div>
          <div class="stat-pill"><div class="num">${happyScore(moodPoints)}%</div><div class="lbl">คะแนนแฮปปี้</div></div>
        </div>
      </div>
    `);
    root.appendChild(hello);

    hello.querySelector('#profile-avatar').innerHTML = profile.avatar
      ? `<img src="${photoUrl(profile.avatar)}">`
      : icon('camera', 28);
    const nameEl = hello.querySelector('#profile-name');
    nameEl.textContent = profile.name || 'พิมพ์ชื่อของคุณ';
    if (!profile.name) nameEl.style.color = 'var(--ink-soft)';

    const extraEl = hello.querySelector('#profile-extra');
    if (profile.birthday) extraEl.appendChild(el(`<div class="profile-line">🎂 ${formatDateNumeric(profile.birthday)}</div>`));
    if (profile.goal) {
      const goalLine = el('<div class="profile-line">🎯 <span></span></div>');
      goalLine.querySelector('span').textContent = profile.goal;
      extraEl.appendChild(goalLine);
    }
    if (profile.message) {
      const msgLine = el('<div class="profile-line profile-message"></div>');
      msgLine.textContent = profile.message;
      extraEl.appendChild(msgLine);
    }

    hello.querySelector('#profile-edit-btn').addEventListener('click', () => openProfileEditor(profile));

    root.appendChild(moodChartSection(moodPoints));

    const calSection = el('<div></div>');
    const header = el(`
      <div class="cal-header">
        <button class="cal-nav-btn" id="prev-m">${icon('chevronLeft', 16)}</button>
        <span class="cal-title" id="cal-title"></span>
        <button class="cal-nav-btn" id="next-m">${icon('chevronRight', 16)}</button>
      </div>
    `);
    const grid = el('<div class="cal-grid"></div>');
    grid._catById = catById;
    calSection.appendChild(header);
    calSection.appendChild(grid);

    const legend = el(`
      <div class="legend">
        <div class="legend-item"><span class="legend-dot" style="background:#22c55e"></span>บันทึกอารมณ์</div>
        <div class="legend-item"><span class="legend-dot" style="background:${EXERCISE_DOT_FALLBACK}"></span>ออกกำลังกาย</div>
        <div class="legend-item"><span class="legend-dot" style="background:${GALLERY_DOT}"></span>รูป+Quote</div>
        <div class="legend-item"><span class="legend-dot" style="background:${TASK_DOT}"></span>งานที่ต้องทำ</div>
      </div>
    `);
    calSection.appendChild(legend);
    root.appendChild(calSection);

    function drawMonth() {
      header.querySelector('#cal-title').textContent = `${THAI_MONTHS[viewDate.getMonth()]} ${viewDate.getFullYear()}`;
      renderCalendarGrid(grid, viewDate.getFullYear(), viewDate.getMonth(), map);
    }
    header.querySelector('#prev-m').addEventListener('click', () => { viewDate.setMonth(viewDate.getMonth() - 1); drawMonth(); });
    header.querySelector('#next-m').addEventListener('click', () => { viewDate.setMonth(viewDate.getMonth() + 1); drawMonth(); });
    drawMonth();
  }

  return {
    render(root) {
      renderAll(root);
    },
  };
})();

window.Views = window.Views || {};
window.Views.home = HomeView;
