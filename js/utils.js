/* ---------- Shared helpers ---------- */

const MOODS = [
  { key: 'angry', emoji: '😡', label: 'โมโห', color: '#ef4444', bg: '#fee2e2' },
  { key: 'annoyed', emoji: '😤', label: 'หงุดหงิด', color: '#f97316', bg: '#ffedd5' },
  { key: 'neutral', emoji: '😐', label: 'เฉยๆ', color: '#9ca3af', bg: '#f3f4f6' },
  { key: 'good', emoji: '😊', label: 'อารมณ์ดี', color: '#3b82f6', bg: '#dbeafe' },
  { key: 'happy', emoji: '🥳', label: 'แฮปปี้มากๆ', color: '#22c55e', bg: '#dcfce7' },
];

const THAI_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const THAI_MONTHS_SHORT = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const THAI_DAYS_SHORT = ['อา','จ','อ','พ','พฤ','ศ','ส'];
const EN_MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const PROFILE_ACCENT_COLORS = ['#f97316','#ef4444','#ec4899','#a855f7','#6366f1','#3b82f6','#14b8a6','#22c55e','#eab308'];

function pad2(n) { return n.toString().padStart(2, '0'); }

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function dateToStr(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatTimeHHMM(ts) {
  const d = new Date(ts);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function formatDateNumeric(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${pad2(d)}/${pad2(m)}/${pad2(y % 100)}`;
}

/* "15 Aug 26" */
function formatDateBig(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${d} ${EN_MONTHS_SHORT[m - 1]} ${pad2(y % 100)}`;
}

/* Stable pseudo-random color for a given string (e.g. a date), so it doesn't flicker on rerender */
function colorForString(str, palette = PROFILE_ACCENT_COLORS) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}

function formatTime(t) {
  return t || '';
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function moodByKey(key) {
  return MOODS.find((m) => m.key === key);
}

/* Resize + compress an image file to a JPEG Blob to keep IndexedDB lean */
function fileToResizedBlob(file, maxDim = 1280, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => { img.src = e.target.result; };
    reader.onerror = reject;
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
    };
    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}


/* ---------- Minimal line-icon set (stroke-based, matches app icon style) ---------- */
const ICONS = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1v-9"/>',
  journal: '<rect x="5" y="6" width="14" height="15" rx="1.5"/><path d="M8 3v4"/><path d="M12 3v4"/><path d="M16 3v4"/><path d="M8 11h8"/><path d="M8 14.5h8"/><path d="M8 18h5"/>',
  dumbbell: '<path d="M4.5 9v6"/><path d="M2.5 10.5v3"/><path d="M8 6.5v11"/><path d="M16 6.5v11"/><path d="M19.5 10.5v3"/><path d="M21.5 9v6"/><path d="M8 12h8"/>',
  camera: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7l1.3-2.6A1 1 0 0 1 10.2 4h3.6a1 1 0 0 1 .9.6L16 7"/><circle cx="12" cy="13.5" r="3.3"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M8 3v4"/><path d="M16 3v4"/><path d="M3.5 10h17"/>',
  pencil: '<path d="M12.5 19.5H21"/><path d="M16.4 4.6a2.1 2.1 0 0 1 3 3L7.5 19.5l-4 1 1-4L16.4 4.6z"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.8-4.8"/>',
  exportArrow: '<path d="M7 17L17 7"/><path d="M8 7h9v9"/>',
  trash: '<path d="M4 6.5h16"/><path d="M8.5 6.5v-2a1.5 1.5 0 0 1 1.5-1.5h4a1.5 1.5 0 0 1 1.5 1.5v2"/><path d="M18.5 6.5 17.7 19a2 2 0 0 1-2 1.8H8.3a2 2 0 0 1-2-1.8L5.5 6.5"/><path d="M10 10.5v6"/><path d="M14 10.5v6"/>',
  plus: '<path d="M12 4.5v15"/><path d="M4.5 12h15"/>',
  close: '<path d="M18 6 6 18"/><path d="M6 6l12 12"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  mail: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3 7l9 6.5L21 7"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>',
  eye: '<path d="M2 12s3.7-7 10-7 10 7 10 7-3.7 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3 3l18 18"/><path d="M6.6 6.6C3.9 8.3 2 12 2 12s3.7 7 10 7c1.4 0 2.7-.3 3.8-.9"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="M14.1 6.1A9.7 9.7 0 0 1 12 5c6.3 0 10 7 10 7a17 17 0 0 1-2.3 3.2"/>',
  chevronLeft: '<path d="M15 18l-6-6 6-6"/>',
  chevronRight: '<path d="M9 18l6-6-6-6"/>',
};

function icon(name, size = 20) {
  const body = ICONS[name] || '';
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function qs(sel, root = document) { return root.querySelector(sel); }
function qsa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

/* group array of {date} items by date string */
function groupByDate(items) {
  const map = {};
  for (const it of items) {
    (map[it.date] = map[it.date] || []).push(it);
  }
  return map;
}
