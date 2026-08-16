# Menu image library

This folder contains generated menu photography prepared for the customer UI and a later S3 upload.

## Structure

Each active menu item has a category and item-slug directory containing:

- `large.jpg` — 1200×750 for full cards and item details
- `medium.jpg` — 640×400 for responsive cards
- `thumb.jpg` — 192×120 for rows, cart summaries, and compact selectors

All variants use an 8:5 crop with the dish centered and crop-safe. `manifest.json` maps the current database menu-item ID to every local asset path.

## Suggested S3 keys

Preserve the path below `/menu-images`, for example:

`menu-images/starters/chicken-tikka/large.jpg`

After upload, the database can store the large URL as `imageUrl`. The UI can later use the manifest's medium and thumbnail variants through `srcset` or a dedicated image-variant object.

## Generation style

Images were generated with the built-in image tool using a consistent prompt system: premium authentic Indian catering photography, landscape 16:10 composition, centered dish, warm neutral tabletop, realistic ingredients and garnish, and no people, text, logos, badges, icons, or watermarks.
