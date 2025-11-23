// Basic client-side sign in / sign up logic
// - stores simple user records in localStorage under "tidal_users"
// - provides form validation, feedback, simulated network delay
// - toggles between Sign in / Sign up and shows a welcome view on success

(function () {
  // --- helpers ---
  const qs = (s, el = document) => el.querySelector(s);
  const qsa = (s, el = document) => Array.from(el.querySelectorAll(s));
  const delay = (ms) => new Promise((res) => setTimeout(res, ms));

  // --- elements ---
  const signinForm = qs('#signin-form');
  const signupForm = qs('#signup-form');
  const showSigninBtn = qs('#show-signin');
  const showSignupBtn = qs('#show-signup');
  const signinMsg = qs('#signin-message');
  const signupMsg = qs('#signup-message');
  const welcomeView = qs('#welcome-view');
  const welcomeMessage = qs('#welcome-message');
  const welcomeTitle = qs('#welcome-title');
  const signoutBtn = qs('#signout-btn');
  const accountDeleteBtn = qs('#account-delete');

  const signinBtn = qs('#signin-btn');
  const signupBtn = qs('#signup-btn');

  // --- storage helpers ---
  function _loadUsers() {
    try {
      const raw = localStorage.getItem('tidal_users');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function _saveUsers(users) {
    localStorage.setItem('tidal_users', JSON.stringify(users));
  }

  // Minimal "hash" (not secure) for demo purposes only
  function _simpleHash(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    return (h >>> 0).toString(16);
  }

  // --- UI helpers ---
  function showMessage(el, type, text, timeout = 3500) {
    if (!el) return;
    el.classList.remove('success', 'error');
    el.classList.add(type === 'success' ? 'success' : 'error');
    el.textContent = text;
    if (timeout) {
      setTimeout(() => {
        if (el) {
          el.textContent = '';
          el.classList.remove('success', 'error');
        }
      }, timeout);
    }
  }

  function clearMessages() {
    [signinMsg, signupMsg, welcomeMessage].forEach((m) => {
      if (m) {
        m.textContent = '';
        m.classList.remove('success', 'error');
      }
    });
  }

  // Toggle visible form
  function showForm(name) {
    clearMessages();
    if (name === 'signin') {
      signinForm.style.display = '';
      signupForm.style.display = 'none';
      welcomeView.style.display = 'none';
      showSigninBtn.setAttribute('aria-pressed', 'true');
      showSignupBtn.setAttribute('aria-pressed', 'false');
    } else if (name === 'signup') {
      signupForm.style.display = '';
      signinForm.style.display = 'none';
      welcomeView.style.display = 'none';
      showSigninBtn.setAttribute('aria-pressed', 'false');
      showSignupBtn.setAttribute('aria-pressed', 'true');
    } else if (name === 'welcome') {
      signinForm.style.display = 'none';
      signupForm.style.display = 'none';
      welcomeView.style.display = '';
      showSigninBtn.setAttribute('aria-pressed', 'false');
      showSignupBtn.setAttribute('aria-pressed', 'false');
    }
  }

  // --- Auth logic ---
  async function handleSignUp(e) {
    e.preventDefault();
    signupBtn.disabled = true;
    const name = qs('#signup-name').value.trim();
    const email = qs('#signup-email').value.trim().toLowerCase();
    const password = qs('#signup-password').value;
    const confirm = qs('#signup-password-confirm').value;

    if (!email || !password || !confirm) {
      showMessage(signupMsg, 'error', 'Please fill all required fields');
      signupBtn.disabled = false;
      return;
    }
    if (!email.includes('@') || email.length < 5) {
      showMessage(signupMsg, 'error', 'Please enter a valid email');
      signupBtn.disabled = false;
      return;
    }
    if (password.length < 6) {
      showMessage(signupMsg, 'error', 'Password must be at least 6 characters');
      signupBtn.disabled = false;
      return;
    }
    if (password !== confirm) {
      showMessage(signupMsg, 'error', 'Passwords do not match');
      signupBtn.disabled = false;
      return;
    }

    const users = _loadUsers();
    if (users[email]) {
      showMessage(signupMsg, 'error', 'An account with that email already exists');
      signupBtn.disabled = false;
      return;
    }

    // simulate network delay
    await delay(700);

    users[email] = {
      name: name || email.split('@')[0],
      email,
      passwordHash: _simpleHash(password),
      createdAt: new Date().toISOString(),
    };
    _saveUsers(users);

    showMessage(signupMsg, 'success', 'Account created — you are now signed in');
    // Clear forms
    signupForm.reset();

    // show welcome state
    welcomeTitle.textContent = `Welcome, ${users[email].name}`;
    showForm('welcome');
    signupBtn.disabled = false;
  }

  async function handleSignIn(e) {
    e.preventDefault();
    signinBtn.disabled = true;
    const email = qs('#signin-email').value.trim().toLowerCase();
    const password = qs('#signin-password').value;

    if (!email || !password) {
      showMessage(signinMsg, 'error', 'Please enter email and password');
      signinBtn.disabled = false;
      return;
    }

    const users = _loadUsers();

    // simulate network delay
    await delay(600);

    const user = users[email];
    if (!user || user.passwordHash !== _simpleHash(password)) {
      showMessage(signinMsg, 'error', 'Invalid email or password');
      signinBtn.disabled = false;
      return;
    }

    showMessage(signinMsg, 'success', 'Signed in successfully');
    signinForm.reset();
    welcomeTitle.textContent = `Welcome, ${user.name}`;
    showForm('welcome');
    signinBtn.disabled = false;
  }

  // Sign out - goes back to sign in
  function handleSignOut() {
    showMessage(welcomeMessage, 'success', 'Signed out');
    showForm('signin');
  }

  // Delete account (with confirmation)
  function handleDeleteAccount() {
    const text = welcomeTitle.textContent || '';
    const likelyEmail = prompt('To confirm deletion, type your email address:');
    if (!likelyEmail) return;
    const email = likelyEmail.trim().toLowerCase();
    const users = _loadUsers();
    if (!users[email]) {
      showMessage(welcomeMessage, 'error', 'No account found for that email');
      return;
    }
    if (!confirm('This will permanently delete the account. Proceed?')) return;
    delete users[email];
    _saveUsers(users);
    showMessage(welcomeMessage, 'success', 'Account deleted');
    showForm('signin');
  }

  // Toggle password visibility for any .btn-icon with data-target
  function handlePasswordToggles() {
    qsa('.btn-icon').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        const input = qs(`#${targetId}`);
        if (!input) return;
        if (input.type === 'password') {
          input.type = 'text';
          btn.textContent = '🙈';
        } else {
          input.type = 'password';
          btn.textContent = '👁️';
        }
      });
    });
  }

  // Social button placeholders
  function wireSocials() {
    qs('#google-signin').addEventListener('click', () => {
      showMessage(signinMsg, 'error', 'Google sign-in not implemented in demo');
    });
    qs('#github-signin').addEventListener('click', () => {
      showMessage(signinMsg, 'error', 'GitHub sign-in not implemented in demo');
    });
  }

  // init wiring
  function init() {
    showSigninBtn.addEventListener('click', () => showForm('signin'));
    showSignupBtn.addEventListener('click', () => showForm('signup'));

    signinForm.addEventListener('submit', handleSignIn);
    signupForm.addEventListener('submit', handleSignUp);

    qs('#signin-cancel').addEventListener('click', () => signinForm.reset());
    qs('#signup-cancel').addEventListener('click', () => signupForm.reset());

    signoutBtn.addEventListener('click', handleSignOut);
    accountDeleteBtn.addEventListener('click', handleDeleteAccount);

    // password visibility toggles
    handlePasswordToggles();

    wireSocials();

    // default view
    showForm('signin');
  }

  // run
  init();
})();