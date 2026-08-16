/* ---------- Tab 3: Photo + Quote gallery ---------- */

const GALLERY_PAGE_SIZE = 6;

const GalleryView = (() => {
  let filterDate = null;
  let searchQuery = '';
  let rootEl = null;
  let trackEl = null;
  let currentPage = 0;

  async function loadEntries() {
    const all = await DB.getAll('gallery');
    all.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : (b.createdAt || 0) - (a.createdAt || 0)));
    return all;
  }

  function buildForm(existing) {
    const isEdit = !!existing;
    const body = el('<div></div>');
    const dateField = el(`<div class="field"><label>วันที่</label></div>`);
    const datePicker = createCalendarDatePicker({ value: existing ? existing.date : todayStr(), maxDate: todayStr() });
    dateField.appendChild(datePicker.root);
    const photoField = el(`<div class="field"><label>รูปภาพ</label></div>`);
    const pp = createPhotoPicker({ existing: existing && existing.photo ? [existing.photo] : [], max: 1 });
    photoField.appendChild(pp.root);
    const quoteField = el(`<div class="field"><label>ข้อความ / Quote</label><textarea id="f-quote" placeholder="เขียนอะไรสักหน่อย...">${existing ? escapeHtml(existing.quote || '') : ''}</textarea></div>`);
    const saveBtn = el(`<button class="btn block">${isEdit ? 'บันทึกการแก้ไข' : 'โพสต์'}</button>`);

    saveBtn.addEventListener('click', async () => {
      const { keepIds, newFiles } = pp.getState();
      if (!newFiles[0] && keepIds.length === 0) { toast('กรุณาเลือกรูปภาพ'); return; }
      const date = datePicker.getValue() || todayStr();
      const quote = body.querySelector('#f-quote').value.trim();

      saveBtn.disabled = true;
      saveBtn.textContent = 'กำลังบันทึก...';

      let photo = existing && existing.photo && keepIds.includes(existing.photo.id) ? existing.photo : null;
      if (newFiles[0]) {
        photo = await uploadPhoto(newFiles[0]);
      }

      const record = {
        id: existing ? existing.id : DB.uid(),
        date, quote, photo,
        createdAt: existing ? existing.createdAt : Date.now(),
      };
      await DB.put('gallery', record);
      closeSheet();
      toast('โพสต์แล้ว 📸');
      GalleryView.rerender();
    });

    body.appendChild(dateField);
    body.appendChild(photoField);
    body.appendChild(quoteField);
    body.appendChild(saveBtn);
    return body;
  }

  function openNew() { openSheet('โพสต์ใหม่', buildForm(null)); }
  function openEdit(entry) { openSheet('แก้ไขโพสต์', buildForm(entry)); }

  function openViewer(entry) {
    if (!entry.photo) return;
    openLightbox([entry.photo], 0, {
      date: formatDateNumeric(entry.date),
      text: entry.quote || null,
    }, [
      { icon: 'pencil', label: 'แก้ไข', onClick: (close) => { close(); openEdit(entry); } },
      {
        icon: 'trash', label: 'ลบ', danger: true,
        onClick: async (close) => {
          const ok = await confirmDialog('ลบโพสต์นี้หรือไม่?');
          if (ok) { await DB.delete('gallery', entry.id); close(); toast('ลบแล้ว'); GalleryView.rerender(); }
        },
      },
    ]);
  }

  function polaroidCard(entry) {
    const card = el(`<div class="polaroid"></div>`);
    if (entry.photo) {
      card.appendChild(el(`<img class="ph-photo" src="${photoUrl(entry.photo)}">`));
    } else {
      card.appendChild(el(`<div class="ph-photo" style="display:flex;align-items:center;justify-content:center;">${icon('camera', 22)}</div>`));
    }
    card.appendChild(el(`<span class="ph-date">${formatDateNumeric(entry.date)}</span>`));
    if (entry.quote) {
      const cap = el('<div class="ph-cap"></div>');
      cap.textContent = entry.quote;
      card.appendChild(cap);
    }
    card.addEventListener('click', () => openViewer(entry));
    return card;
  }

  function updatePageUi(totalPages) {
    const titleEl = rootEl.querySelector('#gal-page-title');
    if (titleEl) titleEl.textContent = `หน้า ${currentPage + 1} / ${totalPages}`;
    rootEl.querySelectorAll('.gal-dot').forEach((d, i) => d.classList.toggle('active', i === currentPage));
    const prevBtn = rootEl.querySelector('#gal-prev');
    const nextBtn = rootEl.querySelector('#gal-next');
    if (prevBtn) prevBtn.disabled = currentPage === 0;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages - 1;
  }

  function goToPage(idx, totalPages) {
    if (!trackEl) return;
    currentPage = Math.max(0, Math.min(idx, totalPages - 1));
    trackEl.scrollLeft = currentPage * trackEl.clientWidth;
    updatePageUi(totalPages);
  }

  async function renderList() {
    const listWrap = rootEl.querySelector('#gal-list');
    listWrap.innerHTML = '';
    trackEl = null;
    let entries = await loadEntries();
    if (filterDate) entries = entries.filter((e) => e.date === filterDate);
    const query = searchQuery.trim().toLowerCase();
    if (query) entries = entries.filter((e) => (e.quote || '').toLowerCase().includes(query));

    if (entries.length === 0) {
      const msg = query ? `ไม่พบโพสต์ที่ตรงกับ "${escapeHtml(searchQuery.trim())}"` : 'ยังไม่มีโพสต์ ลองเพิ่มรูปแรกของคุณ';
      listWrap.appendChild(el(`<div class="empty-state"><div class="big">${query ? '🔍' : '📸'}</div><div class="txt">${msg}</div></div>`));
      return;
    }

    const totalPages = Math.max(1, Math.ceil(entries.length / GALLERY_PAGE_SIZE));
    currentPage = Math.min(currentPage, totalPages - 1);

    const header = el(`
      <div class="cal-header">
        <button class="cal-nav-btn" id="gal-prev">${icon('chevronLeft', 16)}</button>
        <span class="cal-title" id="gal-page-title"></span>
        <button class="cal-nav-btn" id="gal-next">${icon('chevronRight', 16)}</button>
      </div>
    `);
    listWrap.appendChild(header);

    trackEl = el('<div class="gal-track"></div>');
    for (let p = 0; p < totalPages; p++) {
      const page = el('<div class="gal-page"></div>');
      entries.slice(p * GALLERY_PAGE_SIZE, p * GALLERY_PAGE_SIZE + GALLERY_PAGE_SIZE).forEach((e) => page.appendChild(polaroidCard(e)));
      trackEl.appendChild(page);
    }
    listWrap.appendChild(trackEl);

    if (totalPages > 1) {
      const dots = el('<div class="gal-dots"></div>');
      for (let p = 0; p < totalPages; p++) {
        const dot = el('<span class="gal-dot"></span>');
        dot.addEventListener('click', () => goToPage(p, totalPages));
        dots.appendChild(dot);
      }
      listWrap.appendChild(dots);
    }

    header.querySelector('#gal-prev').addEventListener('click', () => goToPage(currentPage - 1, totalPages));
    header.querySelector('#gal-next').addEventListener('click', () => goToPage(currentPage + 1, totalPages));

    let scrollTimer = null;
    trackEl.addEventListener('scroll', () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        currentPage = Math.round(trackEl.scrollLeft / trackEl.clientWidth);
        updatePageUi(totalPages);
      }, 80);
    });

    goToPage(currentPage, totalPages);
  }

  return {
    render(root, params = {}) {
      filterDate = params.filterDate || null;
      searchQuery = '';
      currentPage = 0;
      rootEl = root;
      root.innerHTML = '';

      if (filterDate) {
        const banner = el(`<div class="chip" style="background:var(--accent);margin-bottom:12px;display:inline-flex;">📅 ${formatDateNumeric(filterDate)} <span style="margin-left:6px;cursor:pointer;display:inline-flex;">${icon('close', 13)}</span></div>`);
        banner.querySelector('span').addEventListener('click', () => navigate('gallery'));
        root.appendChild(banner);
      }

      const searchWrap = el(`
        <div class="gal-search">
          <span class="gal-search-icon">${icon('search', 15)}</span>
          <input type="text" id="gal-search-input" placeholder="ค้นหาโพสต์...">
          <button type="button" class="gal-search-clear" style="display:none;">${icon('close', 13)}</button>
        </div>
      `);
      root.appendChild(searchWrap);
      const searchInput = searchWrap.querySelector('#gal-search-input');
      const clearBtn = searchWrap.querySelector('.gal-search-clear');
      searchInput.addEventListener('input', () => {
        searchQuery = searchInput.value;
        clearBtn.style.display = searchQuery ? 'flex' : 'none';
        currentPage = 0;
        renderList();
      });
      clearBtn.addEventListener('click', () => {
        searchQuery = '';
        searchInput.value = '';
        clearBtn.style.display = 'none';
        currentPage = 0;
        renderList();
        searchInput.focus();
      });

      const listWrap = el('<div id="gal-list"></div>');
      root.appendChild(listWrap);

      setFab(icon('plus', 24), openNew);
      renderList();
    },
    rerender() { renderList(); },
  };
})();

window.Views = window.Views || {};
window.Views.gallery = GalleryView;
