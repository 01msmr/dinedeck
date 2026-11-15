# dinedeck

Group food ordering. One person opens an **order** at a restaurant, everyone adds items and marks themselves **ready**, later **paid**. Everyone sees the same state live.

Vanilla JS, no build step, no dependencies. Node ≥ 22.13 (`node:sqlite`), live updates via SSE.

## Features

**Ordering**
- **Items:** article, variant, price, quantity; equal items are grouped, own rows editable until ready (delete has an undo).
- **Catalog per restaurant:** names and variants from earlier orders are suggested; prices are never prefilled, deviations are flagged.
- **Tabs:** own items, everyone, and the order list (one line per dish, copy for phoning); on wide screens the list stays in a right pane.
- **Deadline** (default 20 min) with optional auto-close once everyone is ready; items of unready users do not count.

**Flow**
- **Status line = controls:** `opened › ready › ordered › delivered › paid`, pinned below the top bar. Buyer, creator and admins operate it (close, `+5`, step forward/back, delivery time); each step asks once more. Locked from `ordered`.
- **Ready and paid** are per-user flags; only the user or the buyer sets paid.
- **Time warnings:** pulsing and red time, flashing logo row, optional phone ring at 5/3/1 min (see Sound).

**Paying**
- **Open payments:** a dark grey block under the order header with count, sum, the **pay link** (copy, QR code, amount button) and one red chip per debt with "mark as paid".
- **On return** an overlay lists payments **from you** and **to you** (earlier days, once per session).
- **Buyer and payment:** PayPal address and delivery fee (split among users with items) are remembered; the address is visible to participants only.

**Managing**
- **Order header:** a slim pill (arrow, name, `#id` that copies the order link, buyer, phone, website); the arrow or name opens details.
- **Delete / restore:** creator or admin only; the last 3 deleted orders stay restorable for 2 weeks (grey bar in "All orders"), their numbers stay reserved.
- **Navigation:** sidebar (docked from 1280 px, else drawer), "All orders" with an unpaid filter, one URL per order (`#/r/<id>`).
- **Also:** statistics without per-user data, admin JSON export, light/dark/auto and colour themes, German/English, installable app icon, compact phone layout.

![dinedeck](https://github.com/01msmr/dinedeck/blob/main/docs/screenshots/order-open.png?raw=true)

## Run

```sh
npm start                  # http://127.0.0.1:3000
ADMINS=anna,ben npm start  # admins can manage every order
npm test
```

| Variable | Default | Meaning |
|---|---|---|
| `HOST` | `127.0.0.1` | Bind address |
| `PORT` | `3000` | Port |
| `DB_FILE` | `./data/dinedeck.db` | SQLite file |
| `ADMINS` | empty | Comma-separated usernames |
| `FRAME_ANCESTORS` | empty | Origins allowed to embed the app (`any` = all, empty = none) |

Backup while running: `sqlite3 data/dinedeck.db ".backup backup.db"`.

## Demo

`npm run demo` fills an empty database (`./data/demo.db` or `DB_FILE`) with four invented orders and names (Alex, Sam, Jo, Kim, Robin, Lee); a database with orders is never touched. Try: `DB_FILE=data/demo.db npm start`. With Docker: `DEMO=1 docker compose up -d --build`.

| Open order | Delivered, partly paid |
|---|---|
| ![Open order](docs/screenshots/order-open.png) | ![Delivered order](docs/screenshots/order-delivered.png) |
| **Order list** | **All orders** |
| ![Order list](docs/screenshots/order-list.png) | ![All orders](docs/screenshots/all-orders.png) |
| **Open payments on return** | |
| ![Open payments overlay](docs/screenshots/payments-notice.png) | |

## Sound

The ring is a recording **not in the repository** (`public/sounds/` is git-ignored). Put an MP3 at `public/sounds/old-telephone-ringing.mp3` (about 3 s) to enable it, otherwise the app is silent. Name, volume and minutes are in `SOUND` in `public/config.js`. Browsers play sound only after the first click. Check the licence of any recording you use.

## Hosting with Docker Compose

No clone needed: save this as `compose.yaml` on your server and run `docker compose up -d --build` (Compose builds the image straight from GitHub).

```yaml
services:
  dinedeck:
    build: https://github.com/01msmr/dinedeck.git
    restart: unless-stopped
    environment:
      ADMINS: "${ADMINS:-}"                    # comma-separated usernames, may manage every order
      DEMO: "${DEMO:-}"                        # 1 = fill an empty database with fictional demo orders
      FRAME_ANCESTORS: "${FRAME_ANCESTORS:-}"  # origins allowed to embed the app in an iframe (empty = blocked)
    ports:
      - "127.0.0.1:3000:3000"  # local only; for a LAN use "3000:3000"
    volumes:
      - dinedeck-data:/data
volumes:
  dinedeck-data:
```

Settings come from the shell or a `.env` file next to it (`echo 'ADMINS=anna,ben' > .env`). The `compose.yaml` in the repository is the same, but builds the local checkout (`build: .`).

- **Port:** published on `127.0.0.1:3000` only. For a local network use `"3000:3000"`; for the internet put an HTTPS reverse proxy in front (e.g. Caddy: `dinedeck.example.org { reverse_proxy 127.0.0.1:3000 }`). Clipboard and iframe embedding need HTTPS; with nginx set `proxy_buffering off` for `/api/events` (SSE).
- **Data:** SQLite in the volume `dinedeck-data`, survives rebuilds. Update: `git pull && docker compose up -d --build`. Stop: `docker compose down` (`-v` deletes the data).
- **Backup / restore** (container stopped):
  ```sh
  docker compose stop
  docker run --rm -v dinedeck-data:/data -v "$PWD":/backup alpine cp /data/dinedeck.db /backup/
  # restore: swap the volume path and use
  #   sh -c 'rm -f /data/dinedeck.db-* && cp /backup/dinedeck.db /data/dinedeck.db && chown 1000:1000 /data/dinedeck.db'
  docker compose start
  ```

## Structure

```
server.js, security.js   HTTP server, routes, SSE; security headers
db.js, db/               business logic, schema, queries, reads
public/config.js         all tunable values, shared by server and client
public/format.js         pure helpers, unit-tested
public/                  app.js (router), side.js, notice.js, dialog.js, icons.js, qr.js, i18n.js, style.css
public/views/            home, all, stats, round (+ round/: status, users, order, pay, …)
test/                    npm test
```

Conventions: colours, radii, type scale and pill sizes are tokens in `:root` of `public/style.css` (no colour literals elsewhere); reuse existing components (`.badge`, `.link-pill`, `.card`, `.btn`) before adding classes. New UI text: `t('German text')` plus the English entry in `public/i18n.js`; amounts via `money()`. The code still says **round** (`/api/rounds`) where the UI says "order".

## Security

Security headers on all responses; static files are `no-cache` and `index.html` adds a cache-busting `?v=`. There is deliberately **no login**: the username comes from the browser and is trusted, so hiding the PayPal address is only a visibility rule. For trusted networks only; do not expose it unprotected to the internet.
