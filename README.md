# dinedeck

Group food ordering. One person opens an **order** at a restaurant, everyone adds items and marks themselves **ready**, later **paid**. Everyone sees the same state live.

Vanilla JS, no build step, no dependencies. Node ≥ 22.13 (`node:sqlite`), live updates via SSE.

## Features

- **Items:** article, variant, price, quantity. Own rows are editable until ready; deleting offers a 15 s undo. Items are grouped by name + variant + price, ignoring case, spacing, punctuation and umlaut spelling. Identical own rows are merged into one with a higher quantity (also when an edit makes two rows identical).
- **Catalog per restaurant:** names and variants from earlier orders are suggested. Prices are never prefilled; the last price is offered as an unchecked chip. Price deviations are flagged.
- **Tabs:** own items, everyone (one card per user), order list (for phoning or copying, with menu link). On wide screens the order list stays visible in a pane to the right of the tabs. The list is kept short: one line per dish (names behind it; on narrow widths the dish name stays on one line and the names wrap below), filler words such as "mit", "und", "zusätzlich" are dropped from variants in the display (the copied text keeps the original).
- **Status line (also the controls):** `opened › ready › ordered › delivered › paid` with times, pinned below the top bar. On the left it shows only the order time (today) or only the date (earlier days), aligned with the content below. Everyone sees the state, the paid count (`paid 1/3`, also before delivery) and the remaining time. Buyer, creator and admins also operate it:
  - `ready` carries a checkbox "close when everyone is ready" (greyed out for others), followed by `+5` (extend), the remaining time and a lock (close now). Closing, going forward (`ordered`, `delivered`) and taking a step back (arrow after the step) ask once more before they run.
  - After closing the line shows the lock with the closing time, `+5` is greyed out, and the arrow reopens. Reopening switches "close when ready" off.
  - After `ordered` a delivery time field appears before `delivered`; a new value is saved immediately and shown again after a reload.
- **Ready and paid** are independent per-user flags. Any change to your items resets your ready flag. Only the user or the buyer can set paid. Ready is yellow, unready red. The payment state is shown in colour only by the stripe of the user card (green paid, red unpaid); the pill stays grey (`✓ paid`, `mark as paid` for those who may set it).
- **Open payments:** a dark grey, square block below the order header: "Open payments (n) – in this order" with the **pay link** on the right (for payers: "Payment link" with a "Copy" button, QR code and the amount button; the PayPal address only appears as a tooltip; the buyer sees "Copy address" and the address), and one red chip per person (name, amount, white button "mark as paid"). It appears only when the order is ordered and something is open. The overlay on return uses the same dark grey block, its header reads "– from you" / "– to you" and shows the sum (∑) behind it; the chips show restaurant and date below them. When the order is delivered or paid, the flow shows `n/m paid` (always, also for one payer); "all paid" is a dark mark that does not compete with the green current step.
- **Deadline** (default 20 min). When it expires or an admin/creator/buyer closes the order, items of unready users stay visible but do not count. Optional auto-close once everyone is ready; new users then need approval.
- **Time warnings:** the remaining time pulses grey from 10 to 5 min, then turns red with a glowing pulse. From 3 min the logo row flashes red for 1 s every 6 s (the sidebar band flashes with it). A telephone ring plays at 5, 3 and 1 min remaining (`SOUND.bellAtMs`) if a recording is present (see Sound). Thresholds, tempo and volume are in `public/config.js` and `public/style.css`; reduced-motion settings switch the animation off.
- **Locked from "ordered":** no item or user changes, deadline and buyer data frozen; the step arrows take it back (delivered first, then ordered).
- **Buyer and payment:** buyer, PayPal address and delivery fee (split equally among users with items). PayPal address (per buyer) and fee (per restaurant) are remembered. The pay block offers a link with the user's amount and a QR code of it. The address is visible only to participants, buyer, creator and admins.
- **Order header:** collapsed by default as a slim pill with only the band (arrow, name, buyer, "copy order list", phone chip, "website" chip); the arrow is a font character at the size of the name and turns when it opens, the choice is remembered per order. Opened, it shows the order data, delivery fee and form. Below the order list the line "delivery and service fees" is always shown (service fees have no field yet and stay at 0).
- **Phones (up to 30 em):** compact layout. The order header puts the arrow and the restaurant name on one line, followed by the buyer, with less rounding on the ends; the contact row shows "copy order list", the phone number and the web link (no "Order:" label). The pay block is one rounded button with the amount and the PayPal address (the pay link itself) with the QR code behind it (tap to enlarge); there is no copy button. The control line wraps onto two lines, tab labels are larger, and a step and its undo arrow stay together.
- **Notification on return:** after opening the app, a centred overlay lists the open payments **from you** ("You still have to pay") and **to you** as buyer ("Open payments to you"), each as a red chip (name, amount; the same chips and header as in an order) with restaurant and date below it (time too when two orders share a day). Only earlier days; it appears once per session and state (`NOTICE.showEveryLoad` in `public/config.js` shows it on every load for testing). Close with ✕, Escape or a click beside it.
- **Deleting an order:** only the creator or an admin, in the expanded header ("Delete order"), after a confirmation dialog. Items and payment states are deleted with it.
- **Navigation:** sidebar ("Today" is always shown, with "no order yet" when there is none; open / unpaid / closed, live; the count of orders with unpaid items on "All orders") docked from 1280 px and as a drawer with a menu button below, the list also appears on the start page then. "All orders" can be filtered to unpaid only. Each order has its own URL (`#/r/<id>`). Orders from today show only the time.
- **Statistics:** top restaurant, favourite dish per restaurant, average item price and order total. No per-user statistics. Admins can export all item rows as JSON.
- **Appearance:** light/dark/auto, colour themes, German/English.
- **App icon:** black tile with the white dinedeck mark (`public/favicon.svg`, full-bleed `public/icon.svg` and PNGs for the home screen); `public/manifest.webmanifest` lets browsers install it as an app.

## Run

```sh
npm start                  # http://127.0.0.1:3000
ADMINS=anna,ben npm start  # admins can manage every order
npm test
```

| Variable  | Default               | Meaning                   |
|-----------|-----------------------|---------------------------|
| `HOST`    | `127.0.0.1`           | Bind address              |
| `PORT`    | `3000`                | Port                      |
| `DB_FILE` | `./data/dinedeck.db`  | SQLite file               |
| `ADMINS`  | empty                 | Comma-separated usernames |
| `FRAME_ANCESTORS` | empty | Space/comma-separated origins (e.g. `https://l.example.org`) allowed to embed the app in an iframe; `any` = every site; empty = embedding blocked |

Backup while running: `sqlite3 data/dinedeck.db ".backup backup.db"`.

## Demo

`npm run demo` fills an empty database (`./data/demo.db`, or `DB_FILE`) with four invented orders and invented names (Alex, Sam, Jo, Kim, Robin, Lee). A database that already has orders is never touched. Try it: `DB_FILE=data/demo.db npm start`, then enter one of the names. With Docker Compose, `DEMO=1 docker compose up -d --build` seeds the empty volume on start.

| Open order | Delivered, partly paid |
|---|---|
| ![Open order](docs/screenshots/order-open.png) | ![Delivered order](docs/screenshots/order-delivered.png) |
| **Order list** | **All orders** |
| ![Order list](docs/screenshots/order-list.png) | ![All orders](docs/screenshots/all-orders.png) |
| **Open payments on return** | |
| ![Open payments overlay](docs/screenshots/payments-notice.png) | |

## Sound

The warning ring uses a recording that is **not part of the repository** (`public/sounds/` is git-ignored). Put an MP3 at `public/sounds/old-telephone-ringing.mp3` (about 3 s, one ring) to enable it; without the file the app stays silent. The file name, volume and the minutes of remaining time that ring are in `SOUND` in `public/config.js`. Browsers only play sound after the first click on the page. With Docker the file is copied into the image if it exists at build time. Check the licence of any recording you use.

## Hosting with Docker Compose

```sh
git clone https://github.com/01msmr/dinedeck && cd dinedeck
echo 'ADMINS=anna,ben' > .env         # optional settings, see below
docker compose up -d --build           # builds the image, starts it in the background
```

- **Settings:** `compose.yaml` reads `ADMINS` and `FRAME_ANCESTORS` from the shell or from a `.env` file next to it (`ADMINS=anna,ben`). `HOST`, `PORT` and `DB_FILE` are set in the image (`0.0.0.0`, `3000`, `/data/dinedeck.db`).
- **Port:** The default publishes `127.0.0.1:3000` only. For a local network change it to `"3000:3000"`. For the internet put a reverse proxy with HTTPS in front and keep the default.
- **HTTPS:** The browser only copies to the clipboard (copy buttons) and an embedding site only accepts an iframe over HTTPS. Example with Caddy: `dinedeck.example.org { reverse_proxy 127.0.0.1:3000 }`. Live updates use server-sent events; the proxy must not buffer them (Caddy does not, with nginx set `proxy_buffering off` for `/api/events`).
- **Data:** The SQLite file lives in the named volume `dinedeck-data` and survives rebuilds. There is no login, see Security below.
- **Update:** `git pull && docker compose up -d --build`. New source files must be added to the `COPY` lines in the `Dockerfile`.
- **Logs and stop:** `docker compose logs -f`, `docker compose down` (the volume stays; `down -v` deletes the data).
- **Backup:** Stop the container, copy the file out, start it again:
  ```sh
  docker compose stop
  docker run --rm -v dinedeck-data:/data -v "$PWD":/backup alpine cp /data/dinedeck.db /backup/
  docker compose start
  ```
- **Restore or import** an existing database (same steps, other direction, container stopped):
  ```sh
  docker compose stop
  docker run --rm -v dinedeck-data:/data -v "$PWD":/backup alpine sh -c 'rm -f /data/dinedeck.db-* && cp /backup/dinedeck.db /data/dinedeck.db && chown 1000:1000 /data/dinedeck.db'
  docker compose start
  ```
  The `rm` removes old `-wal`/`-shm` files that could overlay the imported file, the `chown` gives the file to the image's `node` user (uid 1000).

## Structure

```
server.js            HTTP server, routes, SSE, static files
security.js          Security headers (CSP, nosniff, referrer policy, frame denial)
db.js                Business logic: writes, permissions, validation
db/                  schema.js, queries.js, read.js (reads, stats, export), helpers.js, errors.js
public/config.js     All tunable values (limits, defaults, lists, timings), shared by server and client
public/format.js     Pure helpers (times, payHref, round stage, bell thresholds, variant shortening), unit-tested
public/qr.js         QR encoder (byte mode, ECC M, up to 106 bytes)
public/app.js        Entry: name prompt, router, live updates
public/side.js       Sidebar, countdown ticks, time warnings
public/phone.js      Ring sound (plays the recording if present)
public/notice.js     Overlay with the open payments on return
public/dialog.js     Confirmation dialog (same overlay pattern)
public/icons.js      All icons from one SVG template
public/views/        home, all, stats, round; round/ holds status (the control line), users, order, pay, qr-icon
public/i18n.js       Translations (German text is the key)
public/style.css     Colours via light-dark(), lengths in rem (1rem = 16 px)
test/                api, format, group, qr, demo, merge  (npm test)
```

Design conventions (`public/style.css`):

- Colours, radii, type scale, pill padding and the round button size are tokens in `:root` (`--radius-pill`, `--radius-sm`, `--fs-xs` … `--fs-lg`, `--pill-pad`, `--pill-pad-lg`, `--chip`). New rules use `var(--…)`, not literals; a colour never appears outside `:root`.
- One component per concept, reused everywhere: `.badge` and `.link-pill` (pills), `.card` and `.user-card` (cards with a status stripe and a header band), `.btn` (buttons). An open payment is a `.user-card.unpaid` built by `debtCard()` (`public/views/round/debt-row.js`), the same in the status bar and in the notification overlay.
- Keep to the existing component before adding a new class; if a new value is needed twice, make it a token first.

Notes:

- The code still calls an order a **round** (`rounds` table, `/api/rounds`); the UI says "order".
- New UI text: use `t('German text')` and add the English entry to `public/i18n.js`.
- Limits appear as text in server errors in `db.js`; update them together with `config.js` and `i18n.js`.
- Amounts in the UI go through `money()` (decimal mark per language).

## Security

All responses carry security headers; static files are served with `Cache-Control: no-cache` and `index.html` adds a cache-busting `?v=`.

There is deliberately **no login**: the username comes from the browser and is trusted, so hiding the PayPal address is only a visibility rule. Intended for trusted networks (local, office, home). Do not expose it to the internet unprotected.
