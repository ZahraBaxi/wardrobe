/* ============================================================
   closet-admin.js

   Owner-only tool: log in, take/upload a photo, fill in the
   garment's details, and save it to Back4App. Talks to a
   SEPARATE Back4App app from the open:grounds blog, this one
   is just for the closet.

   Uses the same request shape as open:grounds/scripts.js
   (fetch + X-Parse-* headers), pointed at a different app ID,
   a different Cloud Code function, and a different class
   ("Garment" instead of "BlogPost").
   ============================================================ */

// ---- back4app connection info ----
// Shared connection config now lives in js/back4app-client.js (B4A_ID,
// B4A_KEY, B4A_URL, b4aHeaders), loaded before this file, so this form
// writes to the same Garment class the Manage Wardrobe grid reads from.

// ---- session state ----
// Kept in memory only (no localStorage/sessionStorage), so logging
// in again after a page refresh is expected, this matches how the
// rest of the site avoids browser storage. If you want to stay
// logged in across refreshes once this is hosted for real, you can
// add sessionStorage.setItem/getItem around ADMIN_TOKEN yourself.
var ADMIN_TOKEN = null;
var selectedFile = null;

/* ---------------- login ---------------- */

async function handleLogin(event) {
  event.preventDefault();
  var username = document.querySelector('#login-username').value.trim();
  var password = document.querySelector('#login-password').value;
  var errorEl = document.querySelector('#login-error');
  var submitBtn = document.querySelector('#login-submit');

  errorEl.classList.remove('show');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner"></span> checking…';

  try {
    var response = await fetch(B4A_URL + '/functions/adminLogin', {
      method: 'POST',
      headers: b4aHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ username: username, password: password })
    });
    var data = await response.json();

    if (response.ok && data.result && data.result.token) {
      ADMIN_TOKEN = data.result.token;
      enterAdminView(username);
    } else {
      errorEl.textContent = 'wrong username or password.';
      errorEl.classList.add('show');
    }
  } catch (error) {
    errorEl.textContent = 'could not reach back4app, check your connection and the app keys in closet-admin.js.';
    errorEl.classList.add('show');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Log In';
  }
}

function enterAdminView(username) {
  document.querySelector('#view-login').style.display = 'none';
  document.querySelector('#view-admin').style.display = 'block';
  document.querySelector('#owner-chip').textContent = username;
  loadUploaded();
}

function handleLogout() {
  ADMIN_TOKEN = null;
  selectedFile = null;
  document.querySelector('#view-admin').style.display = 'none';
  document.querySelector('#view-login').style.display = 'block';
  document.querySelector('#login-password').value = '';
}

/* ---------------- photo picking ---------------- */

function initDropzone() {
  var dropzone = document.querySelector('#dropzone');
  var fileInput = document.querySelector('#file-input');
  var preview = document.querySelector('#photo-preview');

  dropzone.addEventListener('click', function () { fileInput.click(); });

  dropzone.addEventListener('dragover', function (event) {
    event.preventDefault();
    dropzone.classList.add('drag-over');
  });
  dropzone.addEventListener('dragleave', function () {
    dropzone.classList.remove('drag-over');
  });
  dropzone.addEventListener('drop', function (event) {
    event.preventDefault();
    dropzone.classList.remove('drag-over');
    if (event.dataTransfer.files.length) setSelectedFile(event.dataTransfer.files[0]);
  });

  fileInput.addEventListener('change', function () {
    if (fileInput.files.length) setSelectedFile(fileInput.files[0]);
  });

  function setSelectedFile(file) {
    if (!file.type.startsWith('image/')) return;
    selectedFile = file;
    preview.src = URL.createObjectURL(file);
    preview.style.display = 'block';
    dropzone.querySelector('.dropzone-label').textContent = file.name;
  }
}

/* ---------------- checkbox helpers ---------------- */

function buildCheckboxSet(container, values, name) {
  container.innerHTML = values
    .map(
      function (v) {
        return '<label><input type="checkbox" name="' + name + '" value="' + v + '"> ' + v + '</label>';
      }
    )
    .join('');
}

function getCheckedValues(container) {
  return Array.from(container.querySelectorAll('input:checked')).map(function (el) { return el.value; });
}

/* ---------------- save garment ---------------- */

async function handleSave(event) {
  event.preventDefault();
  var errorEl = document.querySelector('#save-error');
  var submitBtn = document.querySelector('#save-submit');
  errorEl.classList.remove('show');

  var name = document.querySelector('#f-name').value.trim();
  if (!name) {
    errorEl.textContent = 'this garment needs a name.';
    errorEl.classList.add('show');
    return;
  }
  if (!selectedFile) {
    errorEl.textContent = 'add a photo before saving.';
    errorEl.classList.add('show');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner"></span> saving…';

  try {
    // 1. upload the photo to back4app's file storage
    var uploadedFile = await uploadGarmentPhoto(selectedFile);

    // 2. create the garment record, pointing "photo" at the uploaded file
    var garment = {
      name: name,
      category: document.querySelector('#f-category').value,
      brand: document.querySelector('#f-brand').value.trim(),
      color: document.querySelector('#f-color').value.trim(),
      material: document.querySelector('#f-material').value.trim(),
      dateAcquired: document.querySelector('#f-date').value || null,
      wherePurchased: document.querySelector('#f-where').value.trim(),
      cost: parseFloat(document.querySelector('#f-cost').value) || 0,
      madeIn: document.querySelector('#f-madein').value.trim(),
      role: document.querySelector('#f-role').value,
      uniforms: getCheckedValues(document.querySelector('#f-uniforms')),
      season: getCheckedValues(document.querySelector('#f-season')),
      notes: document.querySelector('#f-notes').value.trim(),
      mendingIdeas: document.querySelector('#f-mending').value.trim(),
      tags: document.querySelector('#f-tags').value.split(',').map(function (t) { return t.trim(); }).filter(Boolean),
      loveRating: parseInt(document.querySelector('#f-love').value, 10) || 3,
      timesWorn: 0,
      wornInLastYear: false,
      size: '',
      link: '',
      care: { wash: document.querySelector('#f-wash').value, dry: document.querySelector('#f-dry').value },
      highendTier: document.querySelector('#f-tier').value,
      keep: true,
      photo: { __type: 'File', name: uploadedFile.name, url: uploadedFile.url }
    };

    var saveResponse = await fetch(B4A_URL + '/classes/Garment', {
      method: 'POST',
      headers: b4aHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(garment)
    });
    var saved = await saveResponse.json();
    if (!saveResponse.ok || !saved.objectId) {
      throw new Error(saved.error || 'save failed');
    }

    showToast('garment saved ✓');
    document.querySelector('#garment-form').reset();
    document.querySelector('#photo-preview').style.display = 'none';
    document.querySelector('.dropzone-label').textContent = 'tap to take a photo, or drop one here';
    selectedFile = null;
    loadUploaded();
  } catch (error) {
    errorEl.textContent = 'something went wrong: ' + error.message;
    errorEl.classList.add('show');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Save Garment';
  }
}

/* ---------------- recently uploaded gallery ---------------- */

async function loadUploaded() {
  var grid = document.querySelector('#uploaded-grid');
  grid.innerHTML = '<div class="state-msg">loading…</div>';

  try {
    var response = await fetch(
      B4A_URL + '/classes/Garment?order=-createdAt&limit=40',
      { headers: b4aHeaders() }
    );
    var data = await response.json();
    var garments = data.results || [];

    if (!garments.length) {
      grid.innerHTML = '<div class="empty-state">nothing uploaded yet, the first garment you save will show up here.</div>';
      return;
    }

    grid.innerHTML = garments
      .map(function (g) {
        var photoUrl = g.photo && g.photo.url ? g.photo.url : '';
        return (
          '<div class="uploaded-card">' +
            (photoUrl ? '<img src="' + photoUrl + '" alt="' + escHtml(g.name) + '">' : '') +
            '<div class="info">' +
              '<div class="name">' + escHtml(g.name || 'untitled') + '</div>' +
              '<div class="meta">' + escHtml(g.category || '') + ' &middot; ' + escHtml(g.color || '') + '</div>' +
            '</div>' +
          '</div>'
        );
      })
      .join('');
  } catch (error) {
    grid.innerHTML = '<div class="state-msg">could not load uploads.</div>';
  }
}

function escHtml(value) {
  var replacements = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value).replace(/[&<>"']/g, function (character) { return replacements[character]; });
}

/* ---------------- toast ---------------- */

function showToast(message) {
  var toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(function () { toast.classList.remove('show'); }, 2200);
}

/* ---------------- go ---------------- */

document.addEventListener('DOMContentLoaded', function () {
  document.querySelector('#login-form').addEventListener('submit', handleLogin);
  document.querySelector('#logout-btn').addEventListener('click', handleLogout);
  document.querySelector('#garment-form').addEventListener('submit', handleSave);

  initDropzone();
  buildCheckboxSet(document.querySelector('#f-uniforms'), ['Everyday Casual', 'Weekend', 'Work', 'Field', 'Party', 'Home'], 'uniforms');
  buildCheckboxSet(document.querySelector('#f-season'), ['Spring', 'Summer', 'Fall', 'Winter', 'All Season'], 'season');
});
