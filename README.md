# My Wardrobe, Indigo Americana Field Guide

A personal wardrobe site backed by a real database (Back4App). Garments, repairs,
wishlist items, and loved outfits all live there and are editable from one
admin page, no export step, no build tools.

## Structure

```
index.html               Home, interactive paper doll
wardrobe.html              Garment grid with search + filters
item.html                  Garment detail page (?id=<objectId>)
outfits.html                Random outfit generator + loved outfits gallery
calendar.html                Outfit calendar, log what you wore, tracks last worn + cost per wear
uniforms.html                The six life-uniform systems
constitution.html            The Wardrobe Constitution, collapsible articles + a tenet draw
wishlist.html                 Replacement-only wishlist (not a shopping list)
repairs.html                   Visible-mending gallery + timeline
statistics.html                 Wardrobe stats and charts
field-notes.html                 Running journal
about.html                        Philosophy + colophon
closet-admin.html                  Owner-only: grid editor, repairs, wishlist, paper doll
css/style.css                       Design system (colors, type, layout)
js/data.js                           Still-static data: UNIFORMS, FIELD_NOTES
js/back4app-client.js                Shared Back4App connection + CRUD for every class
js/wardrobe-loader.js                Public pages' async loader (WARDROBE, REPAIRS, WISHLIST, OUTFITS, SITE_CONFIG)
js/wardrobe-seed-data.js             Your original CSV import, for the one-time import button
js/app.js                             Shared behavior (nav, outfit generator, helpers)
js/closet-admin.js                    "Add via Photo" tab logic
js/closet-grid.js                     "Manage Wardrobe" tab, the live spreadsheet grid
js/closet-extras.js                   Repairs, Wishlist, and Paper Doll admin tabs
```

## Where your data lives

Everything except `UNIFORMS` and `FIELD_NOTES` lives in Back4App, in the closet's
own app (App ID `rLyvaf4wL6oXTKqKyOXLLHjQJWBAU2aJqmOb08Pg`):

- `Garment`, every piece you own, plus paper doll illustration and position
- `Repair`, mending log entries
- `WishlistItem`, potential replacements
- `Outfit`, combinations you've loved and tested
- `WornLog`, days you logged wearing something, drives last worn + cost per wear
- `FieldNote`, journal entries for the Field Notes page
- `SiteConfig`, one row holding the paper doll's character image

Every public page fetches live, so an edit in Closet Admin shows up everywhere
immediately.

## Closet Admin (owner only)

`closet-admin.html` is login-gated, and now linked right in the main nav since
this is a single-user tool, there's no reason to keep the URL secret from
yourself. Five tabs:

- **Manage Wardrobe**, the spreadsheet grid. Click a cell to edit it, it saves
  the moment you click away. Click a photo cell to open your camera on a
  phone or a file picker on a laptop. "More" expands a row for the rest of
  the fields. Role, quality tier, and wash/dry care are dropdowns now, pick
  from the list or leave unspecified.
- **Repairs**, add, edit, and delete mending log entries, linked to a garment
  by a dropdown.
- **Wishlist**, add, edit, and delete replacement candidates.
- **Paper Doll**, upload the character image once, then upload an
  illustration per garment and drag it into place on the figure. Positions
  save as you drop them.
- **Add via Photo**, the original single-item flow: snap a photo, fill in
  the details, save.

### Setup, in order

1. **Deploy the Cloud Code.** In the Back4App dashboard for
   `rLyvaf4wL6oXTKqKyOXLLHjQJWBAU2aJqmOb08Pg`, go to **Cloud Code, Edit**,
   paste in `cloud-code/main.js`, set your own `ADMIN_USERNAME` and
   `ADMIN_PASSWORD`, and **Deploy**.
2. **Client Key.** Already filled in for you in `js/back4app-client.js`.
   If you ever rotate it, this is the one file to update, every page reads
   from it.
3. **Open permissions.** Each class (`Garment`, `Repair`, `WishlistItem`,
   `Outfit`, `WornLog`, `FieldNote`, `SiteConfig`) needs public Find, Get, Create, Update, and
   Delete enabled in the Back4App dashboard under that class's lock icon
   (CLPs). Classes are created automatically the first time something is
   saved to them, so do this right after your first save to each.
4. **Import your CSV data.** Log into Closet Admin, stay on Manage
   Wardrobe, click **Import CSV Data (one-time)**. Loads your original 75
   keeping + 29 letting go items. Running it twice creates duplicates, it
   doesn't check for existing rows.
5. **Build the paper doll.** In the Paper Doll tab, upload a character
   image, then upload an illustration and drag it into place for each
   piece you want on the home page figure.

**A note on the login:** a shared single-password check, not a full
per-user account system, appropriate for a tool only you will ever use.

**A note on photo uploads:** Back4App's free tier only allows file uploads
from a logged-in Parse User, not from a plain Client Key request. Rather
than require a paid plan, this site logs in as one small dedicated
`wardrobe-closet-uploader` service user behind the scenes right before any
upload, just to satisfy that requirement. It's created automatically the
first time you upload a photo, character image, or illustration. Nothing
else reads or writes as this user. Same approach used in the open:grounds
blog admin.

**A note on permissions:** open CLPs mean anyone with your Client Key and
class names could technically write to your data too, the login only gates
the admin page, not the Back4App API itself. Acceptable for a single-user
hobby project, not something to reuse for anything with real stakes.

## Hosting on GitHub Pages

1. Create a new GitHub repository and push this folder's contents to it.
2. In the repo, go to **Settings, Pages**.
3. Under **Build and deployment**, set **Source** to `Deploy from a branch`,
   branch `main`, folder `/ (root)`.
4. Save. Your site will publish at `https://<username>.github.io/<repo-name>/`.

No build tools or npm install are required, it's plain HTML/CSS/JS talking to
Back4App over `fetch()`.

## Notes

- Colors, fonts, and layout follow the Indigo Americana design brief: warm
  paper background, Source Serif display type, Inter body type, IBM Plex
  Mono for metadata/labels, with indigo, olive, and rust accents.
- The random outfit generator (now on `outfits.html`) respects categories
  so it never produces impossible combinations like two bottoms. Click
  "Love This Outfit" to save it to the loved outfits gallery below.
- The home page paper doll starts empty until you add a character image and
  at least one garment illustration in Closet Admin, Paper Doll. Clicking a
  placed piece shows its details right there on the page.
- `RETIRED_ITEMS` (the "Letting Go" segment in the admin grid) holds items
  marked not-keeping in your CSV, stored with `keep: false`. Not shown on
  any public page yet, only in the admin grid.
- The constitution page is a collapsible index of articles with a scroll
  progress bar and a "Draw a Tenet" button for a random daily reminder.
