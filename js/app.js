/* ---------- Router / App shell ---------- */

const ROUTES = ['home', 'diary', 'exercise', 'gallery', 'tasks'];
const ROUTE_TITLES = {
  home: 'Daily Journal',
  diary: 'บันทึกประจำวัน',
  exercise: 'ออกกำลังกาย',
  gallery: 'Moment',
  tasks: 'งานที่ต้องทำ',
};

let isAuthed = false;

function currentRoute() {
  const h = (location.hash || '').replace('#', '');
  return ROUTES.includes(h) ? h : 'home';
}

function navigate(route, params) {
  if (currentRoute() === route) {
    render(route, params);
  } else {
    location.hash = route;
    _pendingParams = params;
  }
}

let _pendingParams = null;

async function render(route, params, isRetry) {
  const root = document.getElementById('view-root');
  root.innerHTML = '';
  clearFab();
  document.getElementById('topbar-title').textContent = ROUTE_TITLES[route];
  qsa('.navbtn').forEach((b) => b.classList.toggle('active', b.dataset.route === route));
  window.scrollTo(0, 0);
  try {
    await Views[route].render(root, params || {});
  } catch (err) {
    console.error('Failed to load', route, err);
    if (!isRetry) {
      // most failures here are a one-off network/timing blip — try once more before bothering the user
      setTimeout(() => render(route, params, true), 500);
      return;
    }
    root.innerHTML = '';
    const errState = el(`
      <div class="empty-state">
        <div class="big">⚠️</div>
        <div class="txt">โหลดข้อมูลไม่สำเร็จ ลองเช็คอินเทอร์เน็ตแล้วลองใหม่</div>
      </div>
    `);
    const retryBtn = el('<button class="btn" style="margin-top:14px;">ลองอีกครั้ง</button>');
    retryBtn.addEventListener('click', () => render(route, params));
    errState.appendChild(retryBtn);
    root.appendChild(errState);
  }
}

window.addEventListener('hashchange', () => {
  if (!isAuthed) return;
  const params = _pendingParams;
  _pendingParams = null;
  render(currentRoute(), params);
});

qsa('.navbtn').forEach((btn) => {
  btn.addEventListener('click', () => navigate(btn.dataset.route));
});

function showApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').style.display = '';
  isAuthed = true;
  render(currentRoute());
}

function showAuthScreen() {
  isAuthed = false;
  document.getElementById('app').style.display = 'none';
  document.getElementById('modal-root').innerHTML = '';
  clearFab();
  const authRoot = document.getElementById('auth-screen');
  authRoot.style.display = '';
  Views.auth.render(authRoot);
}

async function signOut() {
  await sb.auth.signOut();
}

async function initApp() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) showApp(); else showAuthScreen();

  sb.auth.onAuthStateChange((event, session) => {
    if (session && !isAuthed) showApp();
    else if (!session && isAuthed) showAuthScreen();
  });
}

initApp();
