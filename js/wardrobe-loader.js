/* ============================================================
   wardrobe-loader.js

   Public pages fetch everything live from Back4App instead of
   reading static arrays: garments, repairs, wishlist items, loved
   outfits, and the paper doll's character image. Everything starts
   empty so nothing throws if a script reads it too early; await
   siteDataReady before rendering.

   Usage in a page's inline script:
     siteDataReady.then(() => { ...existing rendering code... });
   ============================================================ */

var WARDROBE = [];
var RETIRED_ITEMS = [];
var REPAIRS = [];
var WISHLIST = [];
var OUTFITS = [];
var SITE_CONFIG = null;

var siteDataReady = (async function () {
  try {
    var garmentRows = (await fetchGarments()).map(normalizeGarment);
    WARDROBE = garmentRows.filter(function (g) { return g.keep; });
    RETIRED_ITEMS = garmentRows.filter(function (g) { return !g.keep; });
  } catch (error) {
    console.error('Could not load garments from Back4App:', error);
  }

  try {
    REPAIRS = (await fetchRepairs()).map(normalizeRepair);
  } catch (error) {
    console.error('Could not load repairs from Back4App:', error);
  }

  try {
    WISHLIST = (await fetchWishlist()).map(normalizeWishlistItem);
  } catch (error) {
    console.error('Could not load wishlist from Back4App:', error);
  }

  try {
    OUTFITS = (await fetchOutfits()).map(normalizeOutfit);
  } catch (error) {
    console.error('Could not load outfits from Back4App:', error);
  }

  try {
    var config = await fetchSiteConfig();
    SITE_CONFIG = config ? { id: config.objectId, characterImage: config.characterImage || null } : null;
  } catch (error) {
    console.error('Could not load site config from Back4App:', error);
  }

  return WARDROBE;
})();

// kept as an alias since earlier pages were wired against this name
var wardrobeReady = siteDataReady;

