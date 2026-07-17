/*
===========================================================================
  My Wardrobe, Back4App Cloud Code  (main.js)
===========================================================================
  This goes on the SEPARATE Back4App app used for the closet uploader ,
  App ID rLyvaf4wL6oXTKqKyOXLLHjQJWBAU2aJqmOb08Pg, not the open:grounds
  blog app. It's the same adminLogin pattern as the blog, copied over so
  the closet has its own independent login.

  adminLogin cloud function
  --------------------------
  Accepts { username, password } from closet-admin.html and verifies both
  before returning a session token. Throw a Parse.Error to reject, the
  client treats anything other than a { token } result as "wrong creds".

  To deploy:
    1. Open the rLyvaf4wL6oXTKqKyOXLLHjQJWBAU2aJqmOb08Pg app dashboard
    2. Go to Cloud Code → Edit
    3. Paste this whole file in as main.js
    4. Click Deploy
===========================================================================
*/

// ---------------------------------------------------------------------------
// CREDENTIALS, change these before deploying.
// Use a strong, unique password, this is what protects who can upload
// photos and garments to your closet. The username can be anything.
// ---------------------------------------------------------------------------
const ADMIN_USERNAME = "your-username-here";
const ADMIN_PASSWORD = "replace-with-a-strong-password";

// ---------------------------------------------------------------------------
// adminLogin
// Called by closet-admin.html's login form with { username, password }
// ---------------------------------------------------------------------------
Parse.Cloud.define("adminLogin", async (request) => {
  const { username, password } = request.params;

  if (!username || !password) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, "username and password are required");
  }

  const usernameOk = username === ADMIN_USERNAME;
  const passwordOk = password === ADMIN_PASSWORD;

  if (!usernameOk || !passwordOk) {
    // Deliberately vague: don't reveal which field was wrong
    throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, "unauthorized");
  }

  // Return a simple session token the client can check for.
  // This is a shared-secret style check, same as the blog's admin page ,
  // it's fine for a single-owner tool, but it is not a real per-user
  // Parse session, so don't reuse this token scheme for anything with
  // more than one trusted user.
  return { token: "closet-admin-" + Date.now() };
});
