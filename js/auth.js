(function () {
  const sb = window.loveSupabase;
  if (sb === undefined) return;

  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const loginMessage = document.getElementById('loginMessage');
  const signupMessage = document.getElementById('signupMessage');
  const loginSubmit = document.getElementById('loginSubmit');
  const signupSubmit = document.getElementById('signupSubmit');
  const toast = document.getElementById('authToast');
  const tabs = Array.from(document.querySelectorAll('.auth-tab'));
  const panels = Array.from(document.querySelectorAll('.auth-panel'));
  let toastTimer = 0;

  function text(key, fallback) {
    const node = document.querySelector('#authMessages [data-msg="' + key + '"]');
    return node ? node.textContent : (fallback || key);
  }

  function showToast(message) {
    if (toast === null) return;
    toast.textContent = message;
    toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toast.classList.remove('is-visible');
    }, 2800);
  }

  function setBusy(button, busy, label) {
    if (button === null) return;
    button.disabled = busy;
    if (busy) {
      button.dataset.original = button.textContent;
      button.textContent = label;
    } else if (button.dataset.original) {
      button.textContent = button.dataset.original;
    }
  }

  function findError(error) {
    const raw = String(error && error.message ? error.message : '');
    const lower = raw.toLowerCase();
    if (lower.includes('invalid login credentials')) return text('invalid_login');
    if (lower.includes('email not confirmed')) return text('email_not_confirmed');
    if (lower.includes('user already registered')) return text('email_exists');
    if (lower.includes('password should be at least')) return text('err_password');
    if (lower.includes('duplicate key') || lower.includes('profiles_slug_key')) return text('err_slug_taken');
    return raw || text('generic_error');
  }

  function switchTab(name) {
    tabs.forEach(function (tab) {
      const active = tab.dataset.tab === name;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    panels.forEach(function (panel) {
      panel.hidden = panel.dataset.panel !== name;
    });
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      switchTab(tab.dataset.tab);
    });
  });

  if (loginForm) {
    loginForm.addEventListener('submit', async function (event) {
      event.preventDefault();
      loginMessage.textContent = '';
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;
      if (email === '' || password === '') {
        loginMessage.textContent = text('err_fill');
        return;
      }
      setBusy(loginSubmit, true, text('logging_in'));
      const result = await sb.auth.signInWithPassword({ email: email, password: password });
      if (result.error) {
        loginMessage.textContent = findError(result.error);
        setBusy(loginSubmit, false);
        return;
      }
      showToast(text('signed_in'));
      window.setTimeout(function () { window.location.href = 'space.html'; }, 650);
    });
  }

  if (signupForm) {
    signupForm.addEventListener('submit', async function (event) {
      event.preventDefault();
      signupMessage.textContent = '';
      const displayName = document.getElementById('signupName').value.trim();
      const slug = document.getElementById('signupSlug').value;
      const email = document.getElementById('signupEmail').value.trim();
      const password = document.getElementById('signupPassword').value;
      if (displayName === '') {
        signupMessage.textContent = text('err_nickname');
        return;
      }
      if (slug !== 'xiaozhe' && slug !== 'linxi') {
        signupMessage.textContent = text('err_identity');
        return;
      }
      if (email === '' || password === '') {
        signupMessage.textContent = text('err_fill');
        return;
      }
      if (password.length < 6) {
        signupMessage.textContent = text('err_password');
        return;
      }
      setBusy(signupSubmit, true, text('signing_up'));
      const result = await sb.auth.signUp({
        email: email,
        password: password,
        options: { data: { slug: slug, display_name: displayName } }
      });
      if (result.error) {
        signupMessage.textContent = findError(result.error);
        setBusy(signupSubmit, false);
        return;
      }
      if (result.data.session) {
        showToast(text('signed_in'));
        window.setTimeout(function () { window.location.href = 'space.html'; }, 650);
      } else {
        signupMessage.textContent = text('check_email');
        setBusy(signupSubmit, false);
      }
    });
  }

  sb.auth.getSession().then(function (result) {
    if (result.data.session) {
      window.location.href = 'space.html';
    }
  });
})();
