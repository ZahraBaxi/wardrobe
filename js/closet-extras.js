/* ============================================================
   closet-extras.js

   Handles three more Closet Admin tabs, all backed by Back4App:
   Repairs, Wishlist, and Paper Doll (character image + per-garment
   illustration placement).
   ============================================================ */

var repairRows = [];
var wishlistRows = [];
var editingRepairId = null;
var editingWishId = null;
var extrasGarments = [];

async function loadExtrasGarments() {
  try {
    extrasGarments = (await fetchGarments()).map(normalizeGarment);
  } catch (error) {
    extrasGarments = [];
  }
}

function escHtmlM(value) {
  var replacements = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return replacements[c]; });
}

/* ---------------- REPAIRS ---------------- */

async function initRepairsTab() {
  document.querySelector('#r-add-new').addEventListener('click', function () { openRepairEdit('new'); });
  await loadExtrasGarments();
  await reloadRepairsTab();
}

async function reloadRepairsTab() {
  var list = document.querySelector('#r-list');
  list.innerHTML = '<div class="empty-state">loading…</div>';
  try {
    repairRows = (await fetchRepairs()).map(normalizeRepair);
  } catch (error) {
    list.innerHTML = '<div class="empty-state">could not load: ' + error.message + '</div>';
    return;
  }
  renderRepairsList();
}

function renderRepairsList() {
  var list = document.querySelector('#r-list');
  if (!repairRows.length) {
    list.innerHTML = '<div class="empty-state">no repairs logged yet.</div>';
    return;
  }
  list.innerHTML = repairRows
    .map(function (r) {
      var g = extrasGarments.find(function (x) { return x.id === r.garmentId; });
      return (
        '<div class="manage-row" data-id="' + r.id + '" style="grid-template-columns: 1fr 1fr 1fr auto">' +
          '<span class="row-name">' + escHtmlM(g ? g.name : 'Unknown garment') + '</span>' +
          '<span class="row-meta">' + escHtmlM(r.date) + '</span>' +
          '<span class="row-meta">' + escHtmlM(r.method) + '</span>' +
          '<span class="row-actions">' +
            '<button type="button" class="edit-repair-btn">Edit</button>' +
            '<button type="button" class="danger delete-repair-btn">Delete</button>' +
          '</span>' +
        '</div>'
      );
    })
    .join('');

  list.querySelectorAll('.edit-repair-btn').forEach(function (btn) {
    btn.addEventListener('click', function () { openRepairEdit(btn.closest('.manage-row').dataset.id); });
  });
  list.querySelectorAll('.delete-repair-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = btn.closest('.manage-row').dataset.id;
      if (!window.confirm('Delete this repair entry?')) return;
      deleteRepair(id).then(function () {
        repairRows = repairRows.filter(function (x) { return x.id !== id; });
        renderRepairsList();
        showToast('deleted');
      }).catch(function (err) { showToast('delete failed: ' + err.message); });
    });
  });
}

function openRepairEdit(id) {
  editingRepairId = id;
  var r = id === 'new'
    ? { garmentId: '', date: '', method: '', thread: '', patchMaterial: '', notes: '' }
    : repairRows.find(function (x) { return x.id === id; });
  if (!r) return;

  var allGarments = extrasGarments;
  var garmentOptions = allGarments.map(function (g) {
    return '<option value="' + g.id + '"' + (g.id === r.garmentId ? ' selected' : '') + '>' + escHtmlM(g.name) + '</option>';
  }).join('');

  var slot = document.querySelector('#r-edit-slot');
  slot.innerHTML =
    '<div class="edit-panel">' +
      '<h3>' + (id === 'new' ? 'Add Repair' : 'Edit Repair') + '</h3>' +
      '<div class="field-row">' +
        '<div class="field-group"><label for="r-garment">Garment</label><select id="r-garment"><option value="">Select a garment</option>' + garmentOptions + '</select></div>' +
        '<div class="field-group"><label for="r-date">Date</label><input type="date" id="r-date" value="' + escHtmlM(r.date) + '"></div>' +
      '</div>' +
      '<div class="field-row">' +
        '<div class="field-group"><label for="r-method">Method</label><input type="text" id="r-method" value="' + escHtmlM(r.method) + '" placeholder="Sashiko patch"></div>' +
        '<div class="field-group"><label for="r-thread">Thread Color</label><input type="text" id="r-thread" value="' + escHtmlM(r.thread) + '"></div>' +
        '<div class="field-group"><label for="r-patch">Patch Material</label><input type="text" id="r-patch" value="' + escHtmlM(r.patchMaterial) + '"></div>' +
      '</div>' +
      '<div class="field-group"><label for="r-notes">Notes</label><textarea id="r-notes">' + escHtmlM(r.notes) + '</textarea></div>' +
      '<div style="display:flex; gap:0.6em">' +
        '<button type="button" class="btn primary" id="r-save">Save</button>' +
        '<button type="button" class="btn quiet" id="r-cancel">Cancel</button>' +
      '</div>' +
    '</div>';

  slot.querySelector('#r-cancel').addEventListener('click', function () { editingRepairId = null; slot.innerHTML = ''; });
  slot.querySelector('#r-save').addEventListener('click', async function () {
    var fields = {
      garmentId: slot.querySelector('#r-garment').value,
      date: slot.querySelector('#r-date').value,
      method: slot.querySelector('#r-method').value.trim(),
      thread: slot.querySelector('#r-thread').value.trim(),
      patchMaterial: slot.querySelector('#r-patch').value.trim(),
      notes: slot.querySelector('#r-notes').value.trim()
    };
    try {
      if (id === 'new') {
        var created = await createRepair(fields);
        fields.id = created.objectId;
        repairRows.push(fields);
      } else {
        await updateRepair(id, fields);
        var idx = repairRows.findIndex(function (x) { return x.id === id; });
        if (idx !== -1) repairRows[idx] = Object.assign({ id: id }, fields);
      }
      editingRepairId = null;
      slot.innerHTML = '';
      renderRepairsList();
      showToast('saved');
    } catch (error) {
      showToast('save failed: ' + error.message);
    }
  });
}

/* ---------------- WISHLIST ---------------- */

async function initWishlistTab() {
  document.querySelector('#w-add-new').addEventListener('click', function () { openWishEdit('new'); });
  await reloadWishlistTab();
}

async function reloadWishlistTab() {
  var list = document.querySelector('#w-list');
  list.innerHTML = '<div class="empty-state">loading…</div>';
  try {
    wishlistRows = (await fetchWishlist()).map(normalizeWishlistItem);
  } catch (error) {
    list.innerHTML = '<div class="empty-state">could not load: ' + error.message + '</div>';
    return;
  }
  renderWishlistList();
}

function renderWishlistList() {
  var list = document.querySelector('#w-list');
  if (!wishlistRows.length) {
    list.innerHTML = '<div class="empty-state">nothing on the wishlist.</div>';
    return;
  }
  list.innerHTML = wishlistRows
    .map(function (w) {
      return (
        '<div class="manage-row" data-id="' + w.id + '" style="grid-template-columns: 1fr 1fr 1fr auto">' +
          '<span class="row-name">' + escHtmlM(w.name) + '</span>' +
          '<span class="row-meta">' + escHtmlM(w.priority) + '</span>' +
          '<span class="row-meta">' + (w.threeOutfits ? 'Yes' : 'Not yet') + '</span>' +
          '<span class="row-actions">' +
            '<button type="button" class="edit-wish-btn">Edit</button>' +
            '<button type="button" class="danger delete-wish-btn">Delete</button>' +
          '</span>' +
        '</div>'
      );
    })
    .join('');

  list.querySelectorAll('.edit-wish-btn').forEach(function (btn) {
    btn.addEventListener('click', function () { openWishEdit(btn.closest('.manage-row').dataset.id); });
  });
  list.querySelectorAll('.delete-wish-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = btn.closest('.manage-row').dataset.id;
      if (!window.confirm('Delete this wishlist item?')) return;
      deleteWishlistItem(id).then(function () {
        wishlistRows = wishlistRows.filter(function (x) { return x.id !== id; });
        renderWishlistList();
        showToast('deleted');
      }).catch(function (err) { showToast('delete failed: ' + err.message); });
    });
  });
}

function openWishEdit(id) {
  editingWishId = id;
  var w = id === 'new'
    ? { name: '', priority: 'Medium', why: '', replaces: '', threeOutfits: false, notes: '' }
    : wishlistRows.find(function (x) { return x.id === id; });
  if (!w) return;

  var slot = document.querySelector('#w-edit-slot');
  slot.innerHTML =
    '<div class="edit-panel">' +
      '<h3>' + (id === 'new' ? 'Add Wishlist Item' : 'Edit Wishlist Item') + '</h3>' +
      '<div class="field-row">' +
        '<div class="field-group"><label for="w-name">Name</label><input type="text" id="w-name" value="' + escHtmlM(w.name) + '"></div>' +
        '<div class="field-group"><label for="w-priority">Priority</label><select id="w-priority">' +
          ['Low', 'Medium', 'High'].map(function (p) { return '<option' + (p === w.priority ? ' selected' : '') + '>' + p + '</option>'; }).join('') +
        '</select></div>' +
      '</div>' +
      '<div class="field-group"><label for="w-why">Why is this needed?</label><textarea id="w-why">' + escHtmlM(w.why) + '</textarea></div>' +
      '<div class="field-group"><label for="w-replaces">What will it replace?</label><input type="text" id="w-replaces" value="' + escHtmlM(w.replaces) + '"></div>' +
      '<div class="field-group"><label class="chip-toggle" style="cursor:pointer"><input type="checkbox" id="w-three"' + (w.threeOutfits ? ' checked' : '') + ' style="accent-color:var(--indigo); margin-right:0.4em"> can three outfits already be imagined?</label></div>' +
      '<div class="field-group"><label for="w-notes">Notes</label><textarea id="w-notes">' + escHtmlM(w.notes) + '</textarea></div>' +
      '<div style="display:flex; gap:0.6em">' +
        '<button type="button" class="btn primary" id="w-save">Save</button>' +
        '<button type="button" class="btn quiet" id="w-cancel">Cancel</button>' +
      '</div>' +
    '</div>';

  slot.querySelector('#w-cancel').addEventListener('click', function () { editingWishId = null; slot.innerHTML = ''; });
  slot.querySelector('#w-save').addEventListener('click', async function () {
    var fields = {
      name: slot.querySelector('#w-name').value.trim(),
      priority: slot.querySelector('#w-priority').value,
      why: slot.querySelector('#w-why').value.trim(),
      replaces: slot.querySelector('#w-replaces').value.trim(),
      threeOutfits: slot.querySelector('#w-three').checked,
      notes: slot.querySelector('#w-notes').value.trim()
    };
    try {
      if (id === 'new') {
        var created = await createWishlistItem(fields);
        fields.id = created.objectId;
        wishlistRows.push(fields);
      } else {
        await updateWishlistItem(id, fields);
        var idx = wishlistRows.findIndex(function (x) { return x.id === id; });
        if (idx !== -1) wishlistRows[idx] = Object.assign({ id: id }, fields);
      }
      editingWishId = null;
      slot.innerHTML = '';
      renderWishlistList();
      showToast('saved');
    } catch (error) {
      showToast('save failed: ' + error.message);
    }
  });
}

/* ---------------- FIELD NOTES ---------------- */

var fieldNoteRows = [];
var editingFieldNoteId = null;

async function initFieldNotesTab() {
  document.querySelector('#fn-add-new').addEventListener('click', function () { openFieldNoteEdit('new'); });
  await reloadFieldNotesTab();
}

async function reloadFieldNotesTab() {
  var list = document.querySelector('#fn-list');
  list.innerHTML = '<div class="empty-state">loading…</div>';
  try {
    fieldNoteRows = (await fetchFieldNotes()).map(normalizeFieldNote);
  } catch (error) {
    list.innerHTML = '<div class="empty-state">could not load: ' + error.message + '</div>';
    return;
  }
  renderFieldNotesList();
}

function renderFieldNotesList() {
  var list = document.querySelector('#fn-list');
  var sorted = fieldNoteRows.slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });

  if (!sorted.length) {
    list.innerHTML = '<div class="empty-state">no entries yet.</div>';
    return;
  }

  list.innerHTML = sorted
    .map(function (n) {
      var preview = (n.body || '').slice(0, 60) + ((n.body || '').length > 60 ? '…' : '');
      return (
        '<div class="manage-row" data-id="' + n.id + '" style="grid-template-columns: 110px 1fr auto">' +
          '<span class="row-meta">' + escHtmlM(n.date) + '</span>' +
          '<span class="row-name">' + escHtmlM(preview) + '</span>' +
          '<span class="row-actions">' +
            '<button type="button" class="edit-fn-btn">Edit</button>' +
            '<button type="button" class="danger delete-fn-btn">Delete</button>' +
          '</span>' +
        '</div>'
      );
    })
    .join('');

  list.querySelectorAll('.edit-fn-btn').forEach(function (btn) {
    btn.addEventListener('click', function () { openFieldNoteEdit(btn.closest('.manage-row').dataset.id); });
  });
  list.querySelectorAll('.delete-fn-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = btn.closest('.manage-row').dataset.id;
      if (!window.confirm('Delete this field note?')) return;
      deleteFieldNote(id).then(function () {
        fieldNoteRows = fieldNoteRows.filter(function (x) { return x.id !== id; });
        renderFieldNotesList();
        showToast('deleted');
      }).catch(function (err) { showToast('delete failed: ' + err.message); });
    });
  });
}

function todayIsoG() {
  var t = new Date();
  return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
}

function openFieldNoteEdit(id) {
  editingFieldNoteId = id;
  var n = id === 'new'
    ? { date: todayIsoG(), body: '', tags: [] }
    : fieldNoteRows.find(function (x) { return x.id === id; });
  if (!n) return;

  var slot = document.querySelector('#fn-edit-slot');
  slot.innerHTML =
    '<div class="edit-panel">' +
      '<h3>' + (id === 'new' ? 'Add Field Note' : 'Edit Field Note') + '</h3>' +
      '<div class="field-row">' +
        '<div class="field-group"><label for="fn-date">Date</label><input type="date" id="fn-date" value="' + escHtmlM(n.date) + '"></div>' +
        '<div class="field-group"><label for="fn-tags">Tags (comma separated)</label><input type="text" id="fn-tags" value="' + escHtmlM((n.tags || []).join(', ')) + '"></div>' +
      '</div>' +
      '<div class="field-group"><label for="fn-body">Entry</label><textarea id="fn-body" style="min-height:8em">' + escHtmlM(n.body) + '</textarea></div>' +
      '<div style="display:flex; gap:0.6em">' +
        '<button type="button" class="btn primary" id="fn-save">Save</button>' +
        '<button type="button" class="btn quiet" id="fn-cancel">Cancel</button>' +
      '</div>' +
    '</div>';

  slot.scrollIntoView({ behavior: 'smooth', block: 'start' });

  slot.querySelector('#fn-cancel').addEventListener('click', function () { editingFieldNoteId = null; slot.innerHTML = ''; });
  slot.querySelector('#fn-save').addEventListener('click', async function () {
    var fields = {
      date: slot.querySelector('#fn-date').value,
      body: slot.querySelector('#fn-body').value.trim(),
      tags: slot.querySelector('#fn-tags').value.split(',').map(function (t) { return t.trim(); }).filter(Boolean)
    };
    if (!fields.body) { showToast('write something first'); return; }
    try {
      if (id === 'new') {
        var created = await createFieldNote(fields);
        fields.id = created.objectId;
        fieldNoteRows.push(fields);
      } else {
        await updateFieldNote(id, fields);
        var idx = fieldNoteRows.findIndex(function (x) { return x.id === id; });
        if (idx !== -1) fieldNoteRows[idx] = Object.assign({ id: id }, fields);
      }
      editingFieldNoteId = null;
      slot.innerHTML = '';
      renderFieldNotesList();
      showToast('saved');
    } catch (error) {
      showToast('save failed: ' + error.message);
    }
  });
}

/* ---------------- PAPER DOLL ---------------- */

var dollConfig = null;
var dollDragging = null;
var hiddenDollIds = new Set(); // admin-only, session-local, doesn't touch saved data

async function initDollTab() {
  document.querySelector('#doll-char-input').addEventListener('change', handleCharUpload);
  document.querySelector('#doll-char-dropzone').addEventListener('click', function () {
    document.querySelector('#doll-char-input').click();
  });
  document.querySelector('#doll-show-all-btn').addEventListener('click', function () {
    hiddenDollIds = new Set();
    renderDollAdmin();
  });
  await loadExtrasGarments();
  await reloadDollTab();
}

async function reloadDollTab() {
  try {
    var config = await fetchSiteConfig();
    dollConfig = config ? { id: config.objectId, characterImage: config.characterImage || null } : null;
  } catch (error) {
    showToast('could not load paper doll config: ' + error.message);
    dollConfig = null;
  }
  renderDollAdmin();
}

async function handleCharUpload() {
  var input = document.querySelector('#doll-char-input');
  if (!input.files.length) return;
  try {
    var fileRef = await uploadFile(input.files[0], 'character_');
    var saved = await saveSiteConfig(dollConfig ? dollConfig.id : null, { characterImage: fileRef });
    dollConfig = { id: dollConfig ? dollConfig.id : saved.objectId, characterImage: fileRef };
    renderDollAdmin();
    showToast('character image saved');
  } catch (error) {
    showToast('upload failed: ' + error.message);
  }
}

function renderDollAdmin() {
  var stage = document.querySelector('#admin-doll-stage');
  var empty = document.querySelector('#admin-doll-empty');
  var list = document.querySelector('#doll-piece-list');
  var count = document.querySelector('#doll-piece-count');

  stage.querySelectorAll('.doll-piece').forEach(function (el) { el.remove(); });

  if (!dollConfig || !dollConfig.characterImage) {
    stage.style.backgroundImage = '';
    if (empty) empty.style.display = 'block';
  } else {
    stage.style.backgroundImage = 'url(' + dollConfig.characterImage.url + ')';
    if (empty) empty.style.display = 'none';
  }

  var allGarments = extrasGarments.filter(function (g) { return g.keep; });
  var placed = allGarments.filter(function (g) { return g.illustration && g.dollX != null && g.dollY != null; });
  var visiblePlaced = placed.filter(function (g) { return !hiddenDollIds.has(g.id); });

  count.textContent = placed.length + ' of ' + allGarments.length + ' active items placed' +
    (hiddenDollIds.size ? ' (' + hiddenDollIds.size + ' hidden while you work)' : '');

  visiblePlaced.forEach(function (g) {
    var wrap = document.createElement('div');
    wrap.className = 'doll-piece-wrap';
    wrap.style.left = g.dollX + '%';
    wrap.style.top = g.dollY + '%';
    wrap.style.width = g.dollWidth + '%';
    wrap.style.zIndex = g.dollZ;
    wrap.dataset.id = g.id;

    var img = document.createElement('img');
    img.src = g.illustration.url;
    img.className = 'doll-piece-img';
    img.draggable = false;
    wrap.appendChild(img);

    var handle = document.createElement('div');
    handle.className = 'doll-resize-handle';
    handle.title = 'drag to resize';
    wrap.appendChild(handle);

    wrap.style.cursor = 'grab';
    wrap.addEventListener('pointerdown', function (e) {
      if (e.target === handle) return; // handle has its own drag below
      dollDragging = g.id;
      wrap.setPointerCapture(e.pointerId);
      wrap.style.cursor = 'grabbing';
    });
    wrap.addEventListener('pointermove', function (e) {
      if (dollDragging !== g.id) return;
      var rect = stage.getBoundingClientRect();
      var x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      var y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
      wrap.style.left = x + '%';
      wrap.style.top = y + '%';
      g.dollX = Math.round(x * 10) / 10;
      g.dollY = Math.round(y * 10) / 10;
    });
    wrap.addEventListener('pointerup', function (e) {
      if (dollDragging !== g.id) return;
      dollDragging = null;
      wrap.style.cursor = 'grab';
      updateGarment(g.id, { dollX: g.dollX, dollY: g.dollY }).catch(function (err) {
        showToast('could not save position: ' + err.message);
      });
    });

    var resizing = null;
    handle.addEventListener('pointerdown', function (e) {
      e.stopPropagation();
      var rect = stage.getBoundingClientRect();
      resizing = { startX: e.clientX, startWidth: g.dollWidth, stageWidth: rect.width };
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener('pointermove', function (e) {
      if (!resizing) return;
      var deltaPercent = ((e.clientX - resizing.startX) / resizing.stageWidth) * 100;
      var newWidth = Math.max(6, Math.min(90, resizing.startWidth + deltaPercent * 2));
      wrap.style.width = newWidth + '%';
      g.dollWidth = Math.round(newWidth * 10) / 10;
      var slider = document.querySelector('.doll-size-slider[data-id="' + g.id + '"]');
      if (slider) slider.value = g.dollWidth;
    });
    handle.addEventListener('pointerup', function (e) {
      if (!resizing) return;
      resizing = null;
      updateGarment(g.id, { dollWidth: g.dollWidth }).catch(function (err) {
        showToast('could not save size: ' + err.message);
      });
    });

    stage.appendChild(wrap);
  });

  list.innerHTML = allGarments
    .map(function (g) {
      var hasIllustration = !!g.illustration;
      var isPlaced = hasIllustration && g.dollX != null;
      var isHidden = hiddenDollIds.has(g.id);
      return (
        '<div class="manage-row" data-id="' + g.id + '" style="grid-template-columns: 40px 2fr 1fr auto' + (isHidden ? '; opacity:0.5' : '') + '">' +
          '<span class="row-swatch" style="background:' + g.swatch + '"></span>' +
          '<span class="row-name">' + escHtmlM(g.name) + (isHidden ? ' (hidden)' : '') + '</span>' +
          '<span class="row-meta">' + (hasIllustration ? 'has illustration' : 'no illustration') + '</span>' +
          '<span class="row-actions">' +
            '<input type="file" accept="image/*" class="doll-illustration-input" style="display:none">' +
            '<button type="button" class="doll-upload-btn">' + (hasIllustration ? 'Replace' : 'Upload') + '</button>' +
            (isPlaced ? '<button type="button" class="doll-hide-btn">' + (isHidden ? 'Show' : 'Hide') + '</button>' : '') +
            (isPlaced ? '<button type="button" class="doll-solo-btn">Solo</button>' : '') +
            (hasIllustration ? '<button type="button" class="danger doll-remove-btn">Remove from Doll</button>' : '') +
          '</span>' +
        '</div>' +
        (hasIllustration && g.dollX != null
          ? '<div class="doll-size-row">' +
              '<label>Size</label>' +
              '<input type="range" class="doll-size-slider" data-id="' + g.id + '" min="6" max="90" step="1" value="' + g.dollWidth + '">' +
            '</div>'
          : '')
      );
    })
    .join('');

  list.querySelectorAll('.doll-size-slider').forEach(function (slider) {
    slider.addEventListener('input', function () {
      var id = slider.dataset.id;
      var g = allGarments.find(function (x) { return x.id === id; });
      if (!g) return;
      g.dollWidth = parseFloat(slider.value);
      var wrap = stage.querySelector('.doll-piece-wrap[data-id="' + id + '"]');
      if (wrap) wrap.style.width = g.dollWidth + '%';
    });
    slider.addEventListener('change', function () {
      var id = slider.dataset.id;
      var g = allGarments.find(function (x) { return x.id === id; });
      if (!g) return;
      updateGarment(id, { dollWidth: g.dollWidth }).catch(function (err) {
        showToast('could not save size: ' + err.message);
      });
    });
  });

  list.querySelectorAll('.doll-upload-btn').forEach(function (btn) {
    var row = btn.closest('.manage-row');
    var input = row.querySelector('.doll-illustration-input');
    btn.addEventListener('click', function () { input.click(); });
    input.addEventListener('change', async function () {
      if (!input.files.length) return;
      var id = row.dataset.id;
      var g = allGarments.find(function (x) { return x.id === id; });
      try {
        var fileRef = await uploadFile(input.files[0], 'illustration_');
        var fields = { illustration: fileRef };
        if (g.dollX == null) { fields.dollX = 50; fields.dollY = 50; fields.dollWidth = 30; fields.dollZ = 1; }
        await updateGarment(id, fields);
        Object.assign(g, fields);
        renderDollAdmin();
        showToast('illustration saved, drag it into place on the figure');
      } catch (error) {
        showToast('upload failed: ' + error.message);
      }
    });
  });

  list.querySelectorAll('.doll-hide-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = btn.closest('.manage-row').dataset.id;
      if (hiddenDollIds.has(id)) hiddenDollIds.delete(id);
      else hiddenDollIds.add(id);
      renderDollAdmin();
    });
  });

  list.querySelectorAll('.doll-solo-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = btn.closest('.manage-row').dataset.id;
      hiddenDollIds = new Set(placed.map(function (g) { return g.id; }).filter(function (pid) { return pid !== id; }));
      renderDollAdmin();
    });
  });

  list.querySelectorAll('.doll-remove-btn').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      var id = btn.closest('.manage-row').dataset.id;
      var g = allGarments.find(function (x) { return x.id === id; });
      if (!window.confirm('Remove "' + g.name + '" from the paper doll? This clears its illustration and position, not the garment itself.')) return;
      try {
        await updateGarment(id, { illustration: null, dollX: null, dollY: null });
        g.illustration = null;
        g.dollX = null;
        g.dollY = null;
        hiddenDollIds.delete(id);
        renderDollAdmin();
        showToast('removed from doll');
      } catch (error) {
        showToast('could not remove: ' + error.message);
      }
    });
  });
}

/* ---------------- tab wiring ---------------- */

document.addEventListener('DOMContentLoaded', function () {
  var tabs = {
    manage: { btn: document.querySelector('#tab-manage'), pane: document.querySelector('#pane-manage'), title: 'Manage Wardrobe' },
    repairs: { btn: document.querySelector('#tab-repairs'), pane: document.querySelector('#pane-repairs'), title: 'Repairs' },
    wishlist: { btn: document.querySelector('#tab-wishlist'), pane: document.querySelector('#pane-wishlist'), title: 'Wishlist' },
    fieldnotes: { btn: document.querySelector('#tab-fieldnotes'), pane: document.querySelector('#pane-fieldnotes'), title: 'Field Notes' },
    doll: { btn: document.querySelector('#tab-doll'), pane: document.querySelector('#pane-doll'), title: 'Paper Doll' },
    add: { btn: document.querySelector('#tab-add'), pane: document.querySelector('#pane-add'), title: 'Add via Photo' }
  };
  var initialized = { repairs: false, wishlist: false, fieldnotes: false, doll: false };
  var title = document.querySelector('#admin-title');

  function activate(key) {
    Object.keys(tabs).forEach(function (k) {
      tabs[k].btn.classList.toggle('active', k === key);
      tabs[k].pane.style.display = k === key ? 'block' : 'none';
    });
    title.textContent = tabs[key].title;

    if (key === 'repairs' && !initialized.repairs) { initialized.repairs = true; initRepairsTab(); }
    if (key === 'wishlist' && !initialized.wishlist) { initialized.wishlist = true; initWishlistTab(); }
    if (key === 'fieldnotes' && !initialized.fieldnotes) { initialized.fieldnotes = true; initFieldNotesTab(); }
    if (key === 'doll' && !initialized.doll) { initialized.doll = true; initDollTab(); }
  }

  Object.keys(tabs).forEach(function (key) {
    tabs[key].btn.addEventListener('click', function () { activate(key); });
  });
});
