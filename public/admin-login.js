// admin-login.js
// Small client-side helper to show error messages when redirected with ?err=1
// and to do minimal client-side validation before submit.

(function () {
  const msgEl = document.getElementById('login-message');
  const form = document.getElementById('admin-login-form');
  const password = document.getElementById('password');

  // Show server-provided error via query string (?err=1)
  const params = new URLSearchParams(window.location.search);
  if (params.get('err')) {
    msgEl.textContent = 'Invalid password. Please try again.';
    msgEl.classList.add('error');
  }

  // Minimal client-side validation to prevent empty submit
  form.addEventListener('submit', (e) => {
    if (!password.value || password.value.trim().length === 0) {
      e.preventDefault();
      msgEl.textContent = 'Please enter the admin password.';
      msgEl.classList.remove('success');
      msgEl.classList.add('error');
      password.focus();
      return false;
    }
    // allow submit to server
  });
})();