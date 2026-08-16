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

function render(route, params) {
  const root = document.getElementById('view-root');
  root.innerHTML = '';
  clearFab();
  document.getElementById('topbar-title').textContent = ROUTE_TITLES[route];
  qsa('.navbtn').forEach((b) => b.classList.toggle('active', b.dataset.route === route));
  window.scrollTo(0, 0);
  Views[route].render(root, params || {});
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
