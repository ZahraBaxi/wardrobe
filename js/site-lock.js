/* ============================================================
   site-lock.js

   Gates every public page behind the same passcode used for
   Closet Admin, checked against the same Back4App adminLogin
   Cloud Code function (see cloud-code/main.js). Include this as
   the very first script right after <body> opens, before any
   other content, so the lock screen covers the page before it
   has a chance to flash on screen.

   Unlike the admin page's in-memory-only session (which asks
   again on every refresh on purpose), this uses sessionStorage
   so browsing from page to page doesn't ask again every time.
   It clears when the browser tab closes.

   Important: this is a front-end gate only. Your Back4App
   classes still need public read access for the site to work at
   all, so this hides the page from casual visitors but isn't
   real security, the same caveat already documented for the
   admin login. Don't use it to protect anything sensitive.

   Needs js/back4app-client.js loaded first (for B4A_URL and
   b4aHeaders).
   ============================================================ */

(function () {
  if (sessionStorage.getItem('wardrobe_site_unlocked') === 'true') {
    addRelockButton();
    return;
  }

  function addRelockButton() {
    if (document.getElementById('site-relock-btn')) return;
    var btn = document.createElement('button');
    btn.id = 'site-relock-btn';
    btn.type = 'button';
    btn.title = 'Lock this site again';
    btn.textContent = 'Lock';
    btn.addEventListener('click', function () {
      sessionStorage.removeItem('wardrobe_site_unlocked');
      window.location.reload();
    });
    if (document.body) document.body.appendChild(btn);
    else document.addEventListener('DOMContentLoaded', function () { document.body.appendChild(btn); });
  }

  var overlay = document.createElement('div');
  overlay.id = 'site-lock-overlay';
  overlay.innerHTML =
    '<div class="wrap">' +
      '<div class="login-shell">' +
        '<p class="eyebrow">My Wardrobe</p>' +
        '<h1 style="font-size:1.6rem">Enter Passcode</h1>' +
        '<p class="lede" style="font-size:0.9rem">This site is private. Log in to continue.</p>' +
        '<form id="site-lock-form" style="margin-top:var(--space-3)">' +
          '<div class="field-group">' +
            '<label for="site-lock-username">Username</label>' +
            '<input type="text" id="site-lock-username" autocomplete="username" required>' +
          '</div>' +
          '<div class="field-group">' +
            '<label for="site-lock-password">Password</label>' +
            '<input type="password" id="site-lock-password" autocomplete="current-password" required>' +
          '</div>' +
          '<button type="submit" class="btn primary" id="site-lock-submit" style="width:100%; justify-content:center">Enter</button>' +
          '<p class="form-error" id="site-lock-error"></p>' +
        '</form>' +
      '</div>' +
    '</div>';

  document.documentElement.appendChild(overlay);
  document.documentElement.classList.add('site-locked');

  function handleUnlock(event) {
    event.preventDefault();
    var username = document.querySelector('#site-lock-username').value.trim();
    var password = document.querySelector('#site-lock-password').value;
    var errorEl = document.querySelector('#site-lock-error');
    var submitBtn = document.querySelector('#site-lock-submit');

    errorEl.classList.remove('show');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> checking\u2026';

    fetch(B4A_URL + '/functions/adminLogin', {
      method: 'POST',
      headers: b4aHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ username: username, password: password })
    })
      .then(function (response) { return response.json().then(function (data) { return { ok: response.ok, data: data }; }); })
      .then(function (result) {
        if (result.ok && result.data.result && result.data.result.token) {
          sessionStorage.setItem('wardrobe_site_unlocked', 'true');
          document.documentElement.classList.remove('site-locked');
          overlay.remove();
          addRelockButton();
        } else {
          errorEl.textContent = 'wrong username or password.';
          errorEl.classList.add('show');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Enter';
        }
      })
      .catch(function () {
        errorEl.textContent = 'could not reach back4app, check your connection.';
        errorEl.classList.add('show');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Enter';
      });
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelector('#site-lock-form').addEventListener('submit', handleUnlock);
  });
})();
