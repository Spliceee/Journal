/* ---------- Email/password login gate ---------- */

const AuthView = (() => {
  function render(root) {
    root.innerHTML = '';
    let mode = 'signin'; // or 'signup'

    const wrap = el(`
      <div class="auth-wrap">
        <div class="auth-card">
          <div class="auth-emoji">📔</div>
          <h1 class="auth-title">Daily Journal</h1>
          <p class="auth-sub" id="auth-sub">เข้าสู่ระบบเพื่อซิงค์ข้อมูลของคุณ</p>

          <div class="field"><label>อีเมล</label><input type="email" id="auth-email" autocomplete="email" placeholder="you@example.com"></div>
          <div class="field"><label>รหัสผ่าน</label><input type="password" id="auth-password" autocomplete="current-password" placeholder="อย่างน้อย 6 ตัวอักษร"></div>

          <div class="auth-error" id="auth-error" style="display:none;"></div>

          <button class="btn block" id="auth-submit">เข้าสู่ระบบ</button>
          <button type="button" class="auth-toggle" id="auth-toggle">ยังไม่มีบัญชี? สมัครสมาชิก</button>
        </div>
      </div>
    `);
    root.appendChild(wrap);

    const subEl = wrap.querySelector('#auth-sub');
    const submitBtn = wrap.querySelector('#auth-submit');
    const toggleBtn = wrap.querySelector('#auth-toggle');
    const errorEl = wrap.querySelector('#auth-error');
    const emailEl = wrap.querySelector('#auth-email');
    const passEl = wrap.querySelector('#auth-password');

    function applyMode() {
      subEl.textContent = mode === 'signin' ? 'เข้าสู่ระบบเพื่อซิงค์ข้อมูลของคุณ' : 'สร้างบัญชีใหม่เพื่อเริ่มบันทึก';
      submitBtn.textContent = mode === 'signin' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก';
      toggleBtn.textContent = mode === 'signin' ? 'ยังไม่มีบัญชี? สมัครสมาชิก' : 'มีบัญชีแล้ว? เข้าสู่ระบบ';
      errorEl.style.display = 'none';
    }

    toggleBtn.addEventListener('click', () => {
      mode = mode === 'signin' ? 'signup' : 'signin';
      applyMode();
    });

    async function submit() {
      const email = emailEl.value.trim();
      const password = passEl.value;
      if (!email || !password) {
        errorEl.textContent = 'กรุณากรอกอีเมลและรหัสผ่าน';
        errorEl.style.display = 'block';
        return;
      }
      submitBtn.disabled = true;
      submitBtn.textContent = 'กำลังดำเนินการ...';
      errorEl.style.display = 'none';

      const { data, error } = mode === 'signin'
        ? await sb.auth.signInWithPassword({ email, password })
        : await sb.auth.signUp({ email, password });

      submitBtn.disabled = false;
      applyMode();

      if (error) {
        errorEl.textContent = error.message;
        errorEl.style.display = 'block';
        return;
      }
      if (mode === 'signup' && !data.session) {
        errorEl.textContent = 'สมัครสำเร็จ! เช็คอีเมลของคุณเพื่อยืนยันบัญชีก่อนเข้าสู่ระบบ';
        errorEl.style.display = 'block';
      }
      // signed in with a session -> onAuthStateChange in app.js takes over
    }

    submitBtn.addEventListener('click', submit);
    passEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  }

  return { render };
})();

window.Views = window.Views || {};
window.Views.auth = AuthView;
