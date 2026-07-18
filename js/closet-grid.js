/* ============================================================
   closet-grid.js

   The "Manage Wardrobe" tab: a live, Notion-style spreadsheet
   grid over the Garment class in Back4App. Every cell edit saves
   immediately (PUT to Back4App), there's no separate save step
   and no export file. Photo cells open the camera on a phone or
   a file picker on a laptop, upload straight to Back4App file
   storage, and attach the result to that row.
   ============================================================ */

var gridRows = []; // normalized garments currently loaded (both active + retired)
var gridSet = 'active';
var expandedId = null;

var CATEGORY_OPTIONS_G = ['top', 'bottom', 'outer', 'shoe', 'accessory', 'dress'];
var UNIFORM_OPTIONS_G = ['Everyday Casual', 'Weekend', 'Work', 'Field', 'Party', 'Home'];
var SEASON_OPTIONS_G = ['Spring', 'Summer', 'Fall', 'Winter', 'All Season'];
var ROLE_OPTIONS_G = ['Everyday Hero', 'Supporting Basic', 'Character Piece', 'Work Essential', 'Field Essential', 'Home Comfort', 'Seasonal Favorite'];
var TIER_OPTIONS_G = ['Low', 'High', 'Very'];
var WASH_OPTIONS_G = ['Cold Wash', 'Warm Wash', 'Hand Wash', 'Dry Clean Only', 'Do Not Wash'];
var DRY_OPTIONS_G = ['Air Dry', 'Machine Dry Low', 'Flat Dry', 'Do Not Dry'];

function selectFieldMarkup(label, elId, options, currentValue) {
  var opts = options.slice();
  if (currentValue && opts.indexOf(currentValue) === -1) opts.unshift(currentValue);
  var optionsHtml = '<option value="">Unspecified</option>' + opts.map(function (o) {
    return '<option value="' + o + '"' + (o === currentValue ? ' selected' : '') + '>' + o + '</option>';
  }).join('');
  return '<div class="field-group"><label for="' + elId + '">' + label + '</label><select id="' + elId + '">' + optionsHtml + '</select></div>';
}

function setStatus(msg) {
  document.querySelector('#m-status').textContent = msg || '';
}

async function initGrid() {
  document.querySelector('#m-search').addEventListener('input', renderGrid);
  document.querySelector('#m-category').addEventListener('change', renderGrid);
  document.querySelector('#m-add-new').addEventListener('click', addNewRow);
  document.querySelector('#m-import-seed').addEventListener('click', importSeedData);

  document.querySelectorAll('#m-segment button').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('#m-segment button').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      gridSet = btn.dataset.set;
      expandedId = null;
      renderGrid();
    });
  });

  await reloadGrid();
}

async function reloadGrid() {
  setStatus('loading from Back4App…');
  try {
    var raw = await fetchGarments();
    gridRows = raw.map(normalizeGarment);
    setStatus(gridRows.length ? '' : 'no garments yet, import your CSV data or add one manually.');
  } catch (error) {
    setStatus('could not load from Back4App: ' + error.message + ', check your Client Key in js/back4app-client.js and the Garment class permissions in the Back4App dashboard.');
    gridRows = [];
  }
  renderGrid();
}

function currentSetRows() {
  return gridRows.filter(function (g) { return gridSet === 'active' ? g.keep : !g.keep; });
}

function renderGrid() {
  var search = document.querySelector('#m-search').value.trim().toLowerCase();
  var category = document.querySelector('#m-category').value;
  var body = document.querySelector('#m-grid-body');

  var filtered = currentSetRows().filter(function (g) {
    if (category && g.category !== category) return false;
    if (!search) return true;
    var hay = [g.name, g.brand, g.color, g.material].join(' ').toLowerCase();
    return hay.indexOf(search) !== -1;
  });

  document.querySelector('#m-count').textContent = filtered.length + ' of ' + currentSetRows().length + ' item' + (currentSetRows().length === 1 ? '' : 's');

  if (!filtered.length) {
    body.innerHTML = '<tr><td colspan="8" class="empty-state">no items match.</td></tr>';
    return;
  }

  body.innerHTML = filtered.map(rowMarkup).join('');
  wireRow(body);

  if (expandedId) {
    var stillThere = filtered.some(function (g) { return g.id === expandedId; });
    if (stillThere) openExpand(expandedId); else { expandedId = null; document.querySelector('#m-edit-slot').innerHTML = ''; }
  }
}

function rowMarkup(g) {
  var photoCell = g.photo
    ? '<img class="cell-photo-thumb" src="' + g.photo.url + '" alt="">'
    : '<div class="cell-photo-placeholder">+</div>';

  var catOptions = CATEGORY_OPTIONS_G.map(function (c) {
    return '<option value="' + c + '"' + (g.category === c ? ' selected' : '') + '>' + c + '</option>';
  }).join('');

  return (
    '<tr data-id="' + g.id + '">' +
      '<td class="cell-photo" data-label="Photo">' +
        '<input type="file" accept="image/*" capture="environment" class="photo-input" style="display:none">' +
        photoCell +
      '</td>' +
      editableCell('name', g.name, null, 'Name') +
      '<td class="cell-editable" data-field="category" data-label="Category">' +
        '<select class="field-category">' + catOptions + '</select>' +
      '</td>' +
      editableCell('brand', g.brand, null, 'Brand') +
      editableCell('color', g.color, null, 'Color') +
      editableCell('loveRating', g.loveRating, 'number', 'Love') +
      '<td class="cell-checkbox" data-label="Keep"><input type="checkbox" class="field-keep"' + (g.keep ? ' checked' : '') + '></td>' +
      '<td class="cell-actions" data-label="">' +
        '<button type="button" class="btn quiet expand-btn" style="font-size:0.65rem; padding:0.3em 0.7em">More</button> ' +
        '<button type="button" class="btn quiet delete-row-btn" style="font-size:0.65rem; padding:0.3em 0.7em; color:var(--rust)">Delete</button>' +
      '</td>' +
    '</tr>'
  );
}

function editableCell(field, value, type, label) {
  return '<td class="cell-editable" data-field="' + field + '" data-label="' + (label || field) + '">' + escHtmlG(value == null ? '' : value) + '<input type="' + (type || 'text') + '" value="' + escHtmlG(value == null ? '' : value) + '" style="display:none"></td>';
}

function escHtmlG(value) {
  var replacements = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value).replace(/[&<>"']/g, function (c) { return replacements[c]; });
}

function wireRow(body) {
  // click-to-edit text/number cells
  body.querySelectorAll('.cell-editable[data-field]').forEach(function (td) {
    if (td.querySelector('select')) return; // category handled separately
    td.addEventListener('click', function () {
      if (td.querySelector('input').style.display !== 'none') return;
      var input = td.querySelector('input');
      td.childNodes[0].nodeValue = '';
      input.style.display = 'block';
      input.focus();
      input.select();
    });
  });

  body.querySelectorAll('.cell-editable[data-field] input').forEach(function (input) {
    var commit = function () {
      var td = input.closest('td');
      var field = td.dataset.field;
      var row = td.closest('tr');
      var id = row.dataset.id;
      var value = input.type === 'number' ? (parseFloat(input.value) || 0) : input.value.trim();
      input.style.display = 'none';
      td.childNodes[0].nodeValue = String(value);
      saveField(id, field, value, row);
    };
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') input.blur();
      if (e.key === 'Escape') { input.value = input.defaultValue; input.blur(); }
    });
  });

  body.querySelectorAll('.field-category').forEach(function (select) {
    select.addEventListener('change', function () {
      var row = select.closest('tr');
      saveField(row.dataset.id, 'category', select.value, row);
    });
  });

  body.querySelectorAll('.field-keep').forEach(function (cb) {
    cb.addEventListener('change', function () {
      var row = cb.closest('tr');
      saveField(row.dataset.id, 'keep', cb.checked, row).then(function () {
        // item moved sets, refresh the list after the flash
        setTimeout(function () {
          var g = gridRows.find(function (x) { return x.id === row.dataset.id; });
          if (g) g.keep = cb.checked;
          renderGrid();
        }, 400);
      });
    });
  });

  body.querySelectorAll('.expand-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = btn.closest('tr').dataset.id;
      expandedId = expandedId === id ? null : id;
      if (expandedId) openExpand(id); else document.querySelector('#m-edit-slot').innerHTML = '';
    });
  });

  body.querySelectorAll('.delete-row-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var row = btn.closest('tr');
      var id = row.dataset.id;
      var g = gridRows.find(function (x) { return x.id === id; });
      if (!g) return;
      if (!window.confirm('Delete "' + g.name + '" from Back4App? This cannot be undone.')) return;
      deleteGarment(id).then(function () {
        gridRows = gridRows.filter(function (x) { return x.id !== id; });
        if (expandedId === id) { expandedId = null; document.querySelector('#m-edit-slot').innerHTML = ''; }
        renderGrid();
        showToast('deleted');
      }).catch(function (err) { showToast('delete failed: ' + err.message); });
    });
  });

  // photo cells
  body.querySelectorAll('tr').forEach(function (row) {
    var trigger = row.querySelector('.cell-photo-thumb, .cell-photo-placeholder');
    var input = row.querySelector('.photo-input');
    if (!trigger || !input) return;
    trigger.addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () {
      if (!input.files.length) return;
      var id = row.dataset.id;
      trigger.outerHTML = '<div class="cell-photo-placeholder">…</div>';
      uploadGarmentPhoto(input.files[0])
        .then(function (fileRef) { return saveField(id, 'photo', fileRef, row).then(function () { return fileRef; }); })
        .then(function (fileRef) {
          var g = gridRows.find(function (x) { return x.id === id; });
          if (g) g.photo = fileRef;
          renderGrid();
          showToast('photo saved');
        })
        .catch(function (err) { showToast('photo upload failed: ' + err.message); renderGrid(); });
    });
  });
}

async function saveField(id, field, value, rowEl) {
  var fields = {};
  fields[field] = value;
  try {
    await updateGarment(id, fields);
    var g = gridRows.find(function (x) { return x.id === id; });
    if (g) g[field] = value;
    if (rowEl) {
      rowEl.classList.add('row-saved-flash');
      setTimeout(function () { rowEl.classList.remove('row-saved-flash'); }, 900);
    }
  } catch (error) {
    showToast('save failed: ' + error.message);
    throw error;
  }
}

/* ---------------- expand panel (the rest of the fields) ---------------- */

function openExpand(id) {
  var g = gridRows.find(function (x) { return x.id === id; });
  var slot = document.querySelector('#m-edit-slot');
  if (!g) { slot.innerHTML = ''; return; }

  slot.innerHTML =
    '<div class="edit-panel">' +
      '<h3>' + escHtmlG(g.name) + ', full details</h3>' +
      '<div class="field-row">' +
        f('Layer Type', 'x-layertype', g.layerType) +
        f('Material', 'x-material', g.material) +
        f('Size', 'x-size', g.size) +
      '</div>' +
      '<div class="field-row">' +
        f('Made In', 'x-madein', g.madeIn) +
        f('Where Purchased', 'x-where', g.wherePurchased) +
        f('Date Acquired', 'x-date', g.dateAcquired, 'date') +
      '</div>' +
      '<div class="field-row">' +
        f('Cost ($)', 'x-cost', g.cost, 'number') +
        f('Times Worn', 'x-timesworn', g.timesWorn, 'number') +
        f('Last Worn', 'x-lastworn', g.lastWorn, 'date') +
      '</div>' +
      '<div class="field-row">' +
        selectField('Wash Care', 'x-wash', WASH_OPTIONS_G, g.care ? g.care.wash : '') +
        selectField('Dry Care', 'x-dry', DRY_OPTIONS_G, g.care ? g.care.dry : '') +
        selectField('Quality Tier', 'x-tier', TIER_OPTIONS_G, g.highendTier) +
      '</div>' +
      '<div class="field-row">' +
        f('Link', 'x-link', g.link) +
        selectField('Role', 'x-role', ROLE_OPTIONS_G, g.role) +
        f('Tags (comma separated)', 'x-tags', (g.tags || []).join(', ')) +
      '</div>' +
      '<div class="field-row">' +
        cb('Repaired', 'x-repaired', g.repaired) +
        cb('Worn In Last Year', 'x-worn-recent', g.wornInLastYear) +
      '</div>' +
      '<div class="field-group"><label>Uniforms</label><div class="checkbox-set" id="x-uniforms"></div></div>' +
      '<div class="field-group"><label>Season</label><div class="checkbox-set" id="x-season"></div></div>' +
      '<div class="field-group"><label for="x-notes">Notes</label><textarea id="x-notes">' + escHtmlG(g.notes) + '</textarea></div>' +
      '<div class="field-group"><label for="x-mending">Visible Mending Ideas</label><textarea id="x-mending">' + escHtmlG(g.mendingIdeas) + '</textarea></div>' +
      '<div style="display:flex; gap:0.6em">' +
        '<button type="button" class="btn primary" id="x-save">Save Details</button>' +
        '<button type="button" class="btn quiet" id="x-close">Close</button>' +
      '</div>' +
    '</div>';

  buildCheckboxSetChecked(slot.querySelector('#x-uniforms'), UNIFORM_OPTIONS_G, 'x-uniforms', g.uniforms || []);
  buildCheckboxSetChecked(slot.querySelector('#x-season'), SEASON_OPTIONS_G, 'x-season', g.season || []);

  slot.scrollIntoView({ behavior: 'smooth', block: 'start' });

  slot.querySelector('#x-close').addEventListener('click', function () {
    expandedId = null;
    slot.innerHTML = '';
  });

  slot.querySelector('#x-save').addEventListener('click', async function () {
    var q = function (sel) { return slot.querySelector(sel); };
    var fields = {
      layerType: q('#x-layertype').value.trim() || null,
      material: q('#x-material').value.trim(),
      size: q('#x-size').value.trim(),
      madeIn: q('#x-madein').value.trim(),
      wherePurchased: q('#x-where').value.trim(),
      dateAcquired: q('#x-date').value,
      cost: parseFloat(q('#x-cost').value) || 0,
      timesWorn: parseInt(q('#x-timesworn').value, 10) || 0,
      lastWorn: q('#x-lastworn').value,
      care: { wash: q('#x-wash').value.trim(), dry: q('#x-dry').value.trim() },
      highendTier: q('#x-tier').value.trim(),
      link: q('#x-link').value.trim(),
      role: q('#x-role').value.trim(),
      tags: q('#x-tags').value.split(',').map(function (t) { return t.trim(); }).filter(Boolean),
      repaired: q('#x-repaired').checked,
      wornInLastYear: q('#x-worn-recent').checked,
      uniforms: getCheckedValues(q('#x-uniforms')),
      season: getCheckedValues(q('#x-season')),
      notes: q('#x-notes').value.trim(),
      mendingIdeas: q('#x-mending').value.trim()
    };
    try {
      await updateGarment(id, fields);
      Object.assign(g, fields);
      showToast('saved');
    } catch (error) {
      showToast('save failed: ' + error.message);
    }
  });

  function f(label, elId, value, type) {
    return '<div class="field-group"><label for="' + elId + '">' + label + '</label>' +
      '<input type="' + (type || 'text') + '" id="' + elId + '" value="' + escHtmlG(value) + '"></div>';
  }
  function selectField(label, elId, options, currentValue) {
    return selectFieldMarkup(label, elId, options, currentValue);
  }
  function cb(label, elId, checked) {
    return '<div class="field-group"><label for="' + elId + '">' + label + '</label>' +
      '<label class="chip-toggle" style="cursor:pointer"><input type="checkbox" id="' + elId + '"' + (checked ? ' checked' : '') + ' style="accent-color:var(--indigo); margin-right:0.4em"> yes</label></div>';
  }
}

function buildCheckboxSetChecked(container, values, name, checkedValues) {
  container.innerHTML = values.map(function (v) {
    var checked = checkedValues.indexOf(v) !== -1 ? ' checked' : '';
    return '<label><input type="checkbox" name="' + name + '" value="' + v + '"' + checked + '> ' + v + '</label>';
  }).join('');
}

/* ---------------- add / import ---------------- */

async function addNewRow() {
  var blank = {
    name: 'New Item', category: 'top', layerType: null, brand: '', color: '', swatch: '#9C9689',
    material: '', dateAcquired: '', wherePurchased: '', cost: 0, madeIn: '', loveRating: 3,
    timesWorn: 0, wornInLastYear: false, role: '', uniforms: [], season: [], notes: '',
    mendingIdeas: '', tags: [], repaired: false, size: '', link: '',
    care: { wash: '', dry: '' }, highendTier: '', keep: gridSet === 'active'
  };
  try {
    var created = await createGarment(blank);
    blank.id = created.objectId;
    blank.photo = null;
    gridRows.push(blank);
    renderGrid();
    showToast('added, click "More" to fill in the rest');
  } catch (error) {
    showToast('could not add item: ' + error.message);
  }
}

async function importSeedData() {
  if (typeof WARDROBE_SEED === 'undefined') { showToast('seed data not found'); return; }
  if (gridRows.length && !window.confirm('Back4App already has ' + gridRows.length + ' item(s). Import ' + (WARDROBE_SEED.length + RETIRED_SEED.length) + ' more from your CSV anyway? This does not check for duplicates.')) {
    return;
  }
  var all = WARDROBE_SEED.concat(RETIRED_SEED);
  var btn = document.querySelector('#m-import-seed');
  btn.disabled = true;
  var done = 0;
  for (var i = 0; i < all.length; i++) {
    var item = Object.assign({}, all[i]);
    delete item.id; // let Back4App assign a real objectId
    try {
      await createGarment(item);
      done++;
      setStatus('importing… ' + done + ' / ' + all.length);
    } catch (error) {
      setStatus('import stopped at item ' + (done + 1) + ': ' + error.message);
      btn.disabled = false;
      await reloadGrid();
      return;
    }
  }
  btn.disabled = false;
  setStatus('imported ' + done + ' items.');
  showToast('import complete');
  await reloadGrid();
}

/* ---------------- init on admin view visible ---------------- */
// tab switching itself is handled centrally in closet-extras.js

document.addEventListener('DOMContentLoaded', function () {
  var adminView = document.querySelector('#view-admin');
  var initialized = false;
  var observer = new MutationObserver(function () {
    if (!initialized && adminView.style.display !== 'none') {
      initialized = true;
      initGrid();
    }
  });
  observer.observe(adminView, { attributes: true, attributeFilter: ['style'] });
});
