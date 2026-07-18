/* ============================================================
   back4app-client.js

   Shared low-level client for the "Garment" class in the closet's
   own Back4App app (separate from the open:grounds blog's app).
   Used by both the admin grid (closet-admin.html) and the public
   pages (wardrobe.html, item.html, etc.) so there's one source of
   truth for connection info and REST calls.

   Setup: same as before, deploy cloud-code/main.js to this app,
   set your own ADMIN_USERNAME/ADMIN_PASSWORD there, then paste
   your Client Key below. Once you save your first garment, also
   go to Garment class -> Security in the Back4App dashboard and
   turn on public Find/Get/Update/Delete/Create (or write your own
   Cloud Code to check the admin token instead), otherwise only
   reads with the class's default permissions will work.
   ============================================================ */

var B4A_ID = 'rLyvaf4wL6oXTKqKyOXLLHjQJWBAU2aJqmOb08Pg';

// TODO: fill this in, Back4App dashboard -> your app -> App Settings
// -> Security & Keys -> "Client Key" (or "JavaScript Key" on older apps).
var B4A_KEY = 'w4NctSGaJFTBRPWfbgDPxd07EIvJzQVBLiNhjwOI';

var B4A_URL = 'https://parseapi.back4app.com';

function b4aHeaders(extra) {
  return Object.assign(
    {
      'X-Parse-Application-Id': B4A_ID,
      'X-Parse-Client-Key': B4A_KEY
    },
    extra || {}
  );
}

// ---- file upload workaround ----
// Back4App's free tier only allows file uploads from a logged-in Parse
// User (public/anonymous uploads are off unless you're on a paid plan
// with Custom Parse Server Options). Rather than require that upgrade,
// this logs in as one small dedicated "service" Parse User right before
// an upload, just to satisfy that "must be an authenticated user"
// requirement. Nothing else reads or writes as this user, and it's
// created automatically the first time anyone uploads a photo. Same
// trick already used in the open:grounds blog admin.
var UPLOADER_USERNAME = 'wardrobe-closet-uploader';
var UPLOADER_PASSWORD = '7f2b9e4d61ac8830f5de1279b6c40aa9';
var uploaderSessionToken = null;

async function ensureUploaderSession() {
  if (uploaderSessionToken) return uploaderSessionToken;

  var authHeaders = b4aHeaders({ 'Content-Type': 'application/json' });

  // try logging in first
  var loginRes = await fetch(
    B4A_URL + '/login?username=' + encodeURIComponent(UPLOADER_USERNAME) + '&password=' + encodeURIComponent(UPLOADER_PASSWORD),
    { headers: authHeaders }
  );
  if (loginRes.ok) {
    var loginData = await loginRes.json();
    uploaderSessionToken = loginData.sessionToken;
    return uploaderSessionToken;
  }

  // doesn't exist yet, create it once (first upload ever)
  var signupRes = await fetch(B4A_URL + '/users', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ username: UPLOADER_USERNAME, password: UPLOADER_PASSWORD })
  });
  if (signupRes.ok) {
    var signupData = await signupRes.json();
    uploaderSessionToken = signupData.sessionToken;
    return uploaderSessionToken;
  }

  var msg = 'could not start an upload session';
  try {
    var errData = await signupRes.json();
    if (errData && errData.error) msg = errData.error;
  } catch (parseError) { /* response wasn't json */ }
  throw new Error(msg);
}

/* ---------------- garments CRUD ---------------- */

async function fetchGarments() {
  var results = [];
  var skip = 0;
  var limit = 1000;
  while (true) {
    var res = await fetch(B4A_URL + '/classes/Garment?limit=' + limit + '&skip=' + skip + '&order=name', {
      headers: b4aHeaders()
    });
    var data = await res.json();
    if (!res.ok) throw new Error(data.error || 'could not load garments');
    results = results.concat(data.results || []);
    if (!data.results || data.results.length < limit) break;
    skip += limit;
  }
  return results;
}

async function createGarment(fields) {
  var res = await fetch(B4A_URL + '/classes/Garment', {
    method: 'POST',
    headers: b4aHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(fields)
  });
  var data = await res.json();
  if (!res.ok) throw new Error(data.error || 'could not create garment');
  return data; // { objectId, createdAt }
}

async function updateGarment(objectId, fields) {
  var res = await fetch(B4A_URL + '/classes/Garment/' + objectId, {
    method: 'PUT',
    headers: b4aHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(fields)
  });
  var data = await res.json();
  if (!res.ok) throw new Error(data.error || 'could not save changes');
  return data;
}

async function deleteGarment(objectId) {
  var res = await fetch(B4A_URL + '/classes/Garment/' + objectId, {
    method: 'DELETE',
    headers: b4aHeaders()
  });
  if (!res.ok) {
    var data = await res.json().catch(function () { return {}; });
    throw new Error(data.error || 'could not delete garment');
  }
  return true;
}

/* ---------------- generic class CRUD ---------------- */
// Repairs, wishlist items, and loved outfits all follow the same
// shape of operations as garments, so this is shared instead of
// copy-pasted per class.

async function fetchClass(className, order) {
  var results = [];
  var skip = 0;
  var limit = 1000;
  while (true) {
    var qs = 'limit=' + limit + '&skip=' + skip + (order ? '&order=' + order : '');
    var res = await fetch(B4A_URL + '/classes/' + className + '?' + qs, { headers: b4aHeaders() });
    var data = await res.json();
    if (!res.ok) throw new Error(data.error || ('could not load ' + className));
    results = results.concat(data.results || []);
    if (!data.results || data.results.length < limit) break;
    skip += limit;
  }
  return results;
}

async function createInClass(className, fields) {
  var res = await fetch(B4A_URL + '/classes/' + className, {
    method: 'POST',
    headers: b4aHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(fields)
  });
  var data = await res.json();
  if (!res.ok) throw new Error(data.error || ('could not create ' + className + ' record'));
  return data;
}

async function updateInClass(className, objectId, fields) {
  var res = await fetch(B4A_URL + '/classes/' + className + '/' + objectId, {
    method: 'PUT',
    headers: b4aHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(fields)
  });
  var data = await res.json();
  if (!res.ok) throw new Error(data.error || ('could not save ' + className + ' record'));
  return data;
}

async function deleteInClass(className, objectId) {
  var res = await fetch(B4A_URL + '/classes/' + className + '/' + objectId, {
    method: 'DELETE',
    headers: b4aHeaders()
  });
  if (!res.ok) {
    var data = await res.json().catch(function () { return {}; });
    throw new Error(data.error || ('could not delete ' + className + ' record'));
  }
  return true;
}

/* convenience wrappers, kept for readability at call sites */
function fetchRepairs() { return fetchClass('Repair', '-date'); }
function createRepair(fields) { return createInClass('Repair', fields); }
function updateRepair(id, fields) { return updateInClass('Repair', id, fields); }
function deleteRepair(id) { return deleteInClass('Repair', id); }

function fetchWishlist() { return fetchClass('WishlistItem'); }
function createWishlistItem(fields) { return createInClass('WishlistItem', fields); }
function updateWishlistItem(id, fields) { return updateInClass('WishlistItem', id, fields); }
function deleteWishlistItem(id) { return deleteInClass('WishlistItem', id); }

function fetchOutfits() { return fetchClass('Outfit', '-createdAt'); }
function createOutfit(fields) { return createInClass('Outfit', fields); }
function updateOutfit(id, fields) { return updateInClass('Outfit', id, fields); }
function deleteOutfit(id) { return deleteInClass('Outfit', id); }

function fetchWornLogs() { return fetchClass('WornLog', '-date'); }
function createWornLog(fields) { return createInClass('WornLog', fields); }
function updateWornLog(id, fields) { return updateInClass('WornLog', id, fields); }
function deleteWornLog(id) { return deleteInClass('WornLog', id); }

function fetchFieldNotes() { return fetchClass('FieldNote', '-date'); }
function createFieldNote(fields) { return createInClass('FieldNote', fields); }
function updateFieldNote(id, fields) { return updateInClass('FieldNote', id, fields); }
function deleteFieldNote(id) { return deleteInClass('FieldNote', id); }

/* singleton site config: one row holding the paper doll's character image */
async function fetchSiteConfig() {
  var rows = await fetchClass('SiteConfig');
  return rows[0] || null;
}
async function saveSiteConfig(objectId, fields) {
  if (objectId) return updateInClass('SiteConfig', objectId, fields);
  return createInClass('SiteConfig', fields);
}

async function uploadFile(file, prefix) {
  var token = await ensureUploaderSession();
  var safeFilename = (prefix || '') + Date.now() + '_' + file.name.replace(/[^a-z0-9.\-_]/gi, '_');
  var res = await fetch(B4A_URL + '/files/' + safeFilename, {
    method: 'POST',
    headers: b4aHeaders({
      'Content-Type': file.type || 'application/octet-stream',
      'X-Parse-Session-Token': token
    }),
    body: file
  });
  var data = await res.json();
  if (!res.ok || !data.url) throw new Error(data.error || 'file upload failed');
  return { __type: 'File', name: data.name, url: data.url };
}

async function uploadGarmentPhoto(file) {
  return uploadFile(file, 'photo_');
}

/* ---------------- normalize for page rendering ---------------- */
// Maps a raw Parse Garment object into the flat shape the rest of
// the site's pages (app.js, item.html, statistics.html, etc.) expect.

function normalizeGarment(row) {
  return {
    id: row.objectId,
    name: row.name || '(untitled)',
    category: row.category || 'top',
    layerType: row.layerType || null,
    brand: row.brand || '',
    color: row.color || '',
    swatch: row.swatch || '#9C9689',
    material: row.material || '',
    dateAcquired: row.dateAcquired || '',
    wherePurchased: row.wherePurchased || '',
    cost: typeof row.cost === 'number' ? row.cost : 0,
    madeIn: row.madeIn || '',
    loveRating: typeof row.loveRating === 'number' ? row.loveRating : 3,
    timesWorn: typeof row.timesWorn === 'number' ? row.timesWorn : 0,
    wornInLastYear: !!row.wornInLastYear,
    role: row.role || '',
    uniforms: row.uniforms || [],
    season: row.season || [],
    notes: row.notes || '',
    mendingIdeas: row.mendingIdeas || '',
    tags: row.tags || [],
    repaired: !!row.repaired,
    size: row.size || '',
    link: row.link || '',
    care: row.care || { wash: '', dry: '' },
    highendTier: row.highendTier || '',
    keep: row.keep !== false,
    photo: row.photo && row.photo.url ? row.photo : null,
    illustration: row.illustration && row.illustration.url ? row.illustration : null,
    dollX: typeof row.dollX === 'number' ? row.dollX : null,
    dollY: typeof row.dollY === 'number' ? row.dollY : null,
    dollWidth: typeof row.dollWidth === 'number' ? row.dollWidth : 30,
    dollZ: typeof row.dollZ === 'number' ? row.dollZ : 1,
    lastWorn: row.lastWorn || ''
  };
}

function normalizeWornLog(row) {
  return {
    id: row.objectId,
    date: row.date || '',
    garmentIds: row.garmentIds || [],
    outfitId: row.outfitId || '',
    notes: row.notes || ''
  };
}

function normalizeFieldNote(row) {
  return {
    id: row.objectId,
    date: row.date || '',
    body: row.body || '',
    tags: row.tags || []
  };
}

function normalizeRepair(row) {
  return {
    id: row.objectId,
    garmentId: row.garmentId || '',
    date: row.date || '',
    method: row.method || '',
    thread: row.thread || '',
    patchMaterial: row.patchMaterial || '',
    notes: row.notes || ''
  };
}

function normalizeWishlistItem(row) {
  return {
    id: row.objectId,
    name: row.name || '',
    priority: row.priority || 'Medium',
    why: row.why || '',
    replaces: row.replaces || '',
    threeOutfits: !!row.threeOutfits,
    notes: row.notes || ''
  };
}

function normalizeOutfit(row) {
  return {
    id: row.objectId,
    name: row.name || '',
    garmentIds: row.garmentIds || [],
    occasion: row.occasion || '',
    notes: row.notes || '',
    loveRating: typeof row.loveRating === 'number' ? row.loveRating : 3,
    createdAt: row.createdAt || ''
  };
}
