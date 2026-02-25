# 💍 County — Jewellery Design Kiosk

A production-ready in-store kiosk application for a jewellery shop. Customers design a custom ring via guided AI chat, sketch pad, and optional inspiration image, then receive concept renders and a retail-only quote.

## Features

| Feature | Details |
|---|---|
| **AI Chat Design** | GPT-4o guided conversation extracts ring spec (metal, stones, size, style) |
| **Sketch Pad** | Canvas drawing (pen/eraser/undo/clear) sent to LLM as vision input |
| **Inspiration Upload** | Customer uploads a photo; LLM references it in design |
| **Concept Renders** | DALL-E 3 generates 1–3 photorealistic ring images |
| **Retail Quote** | 2× cost pricing engine with range estimate ± 20% + disclaimer |
| **PDF Export** | One-page branded PDF with images, spec, and quote |
| **Staff Panel** | PIN-protected view showing full cost breakdown (never shown to customer) |
| **Idle Reset** | 3-min idle timeout → "Tap to Begin" screen + session wipe |
| **Kiosk Mode** | Touch-friendly UI, large buttons, no browser chrome needed |

## Tech Stack

- **Next.js 14** App Router + TypeScript strict mode
- **Tailwind CSS** dark luxury theme
- **Prisma 5 + SQLite** (Postgres-ready)
- **OpenAI** — GPT-4o (chat/vision), DALL-E 3 (image generation)
- **pdf-lib** — server-side PDF generation
- **Zod** — input/output validation everywhere

---

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/blazebbq/county.git
cd county
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:

```env
OPENAI_API_KEY=sk-your-key-here
DATABASE_URL=file:./dev.db
STAFF_PIN=your-secure-pin
```

### 3. Set up the database

```bash
npm run prisma:migrate
```

### 4. Run in development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENAI_API_KEY` | ✅ | — | OpenAI API key |
| `OPENAI_MODEL` | | `gpt-4o` | Chat model (gpt-4o recommended) |
| `DATABASE_URL` | ✅ | `file:./dev.db` | SQLite path or Postgres URL |
| `STAFF_PIN` | ✅ | `1234` | PIN to unlock staff panel — **change this!** |
| `METALS_API_KEY` | | — | Optional: metals-api.com key for live gold spot prices |
| `ASSET_CLEANUP_HOURS` | | `24` | Hours before uploaded assets are cleaned up |
| `SHOP_NAME` | | `Your Jewellery Shop` | Shown on PDF header |
| `SHOP_ADDRESS` | | — | Shown on PDF footer |
| `SHOP_PHONE` | | — | Shown on PDF footer |
| `SHOP_EMAIL` | | — | Shown on PDF footer |
| `SMTP_HOST` | | — | For email PDF feature |
| `SMTP_PORT` | | `587` | SMTP port |
| `SMTP_USER` | | — | SMTP username |
| `SMTP_PASS` | | — | SMTP password |
| `SMTP_FROM` | | — | From address for emails |

---

## Docker Deployment

### Local development

```bash
docker-compose up --build
```

### Production VPS

```bash
# On your server:
git clone https://github.com/blazebbq/county.git
cd county
cp .env.example .env
# Edit .env with your keys

docker-compose up -d
```

The app will be available on port 3000. Use nginx or Caddy as a reverse proxy for HTTPS.

---

## Kiosk Mode Setup (Windows — Edge)

1. Install [Microsoft Edge](https://www.microsoft.com/edge) (latest)
2. Open Edge and navigate to `http://localhost:3000`
3. Press `F11` for fullscreen, or configure as kiosk via Windows:
   - **Windows 10/11 Assigned Access**: Settings → Accounts → Family & other users → Set up a kiosk → Select Edge → Enter `http://localhost:3000`
4. The app has a 3-minute idle timeout that returns to the "Tap to Begin" screen and wipes session data automatically.

For a dedicated kiosk user, create a Windows standard user account and configure Assigned Access to only allow Edge in kiosk URL mode.

---

## Staff Panel

1. On the kiosk home screen, **tap the ring logo 5 times** quickly to show the staff unlock panel.
2. Enter the PIN configured in `STAFF_PIN` environment variable.
3. The staff panel shows:
   - Full design spec JSON
   - Complete cost breakdown (metal, stones, labour, overhead, total)
   - Model reasoning summary
   - Session transcript

> ⚠️ The cost breakdown is **never** sent to the client or shown in the customer view. It is computed server-side and displayed only in the authenticated staff panel.

---

## Pricing Engine

The pricing engine (`/lib/pricing/pricingEngine.ts`) computes retail price as **2× all-in cost**:

```
All-in cost = Metal cost + Stone cost + Labour cost + Overhead
Retail price = All-in cost × 2  (100% profit margin)
```

### Metal cost
- Uses spot price (live from metals-api.com if `METALS_API_KEY` is set, otherwise falls back to config)
- Applies purity multiplier (e.g., 18ct = 0.750), premium %, and scrap/loss %
- Cached for 1 hour

### Stone cost
- Lab diamonds and moissanite priced from `/config/diamonds_lab.json`
- mm → carat conversion table included
- Three quality tiers: good / better / best

### Labour
- Simple ring: £120, Medium: £220, Complex: £350
- Pavé setting: +£8 per stone

### Configuration
Edit `/config/pricing.json` to update:
- Labour rates
- Overhead buffer
- Metal premiums
- Scrap/loss percentage

Edit `/config/diamonds_lab.json` to update stone prices.

### Live metal spot prices
Set `METALS_API_KEY` in `.env` to a [metals-api.com](https://metals-api.com) key. Rates are cached for 1 hour. If the fetch fails, the last known price (or config fallback) is used automatically.

---

## Security Notes

- `OPENAI_API_KEY` is server-side only — never sent to the browser
- Staff cost breakdown (`staffOnlyCosting`) is stripped from all API responses to the customer
- System prompt is stored in `prompts/system.txt` and never returned to the client
- The LLM is instructed never to output pricing/cost information; responses are post-processed for sensitive content
- Staff PIN uses an httpOnly, SameSite=strict session cookie
- All API inputs validated with Zod
- Uploaded files are stored in `/public/uploads/<sessionId>/` and cleaned up after session close

---

## Accepted Materials

| Metal | Code |
|---|---|
| 9ct Yellow Gold | `9k_yellow` |
| 14ct Yellow Gold | `14k_yellow` |
| 18ct Yellow Gold | `18k_yellow` |
| 14ct White Gold | `14k_white` |
| 18ct White Gold | `18k_white` |
| 925 Sterling Silver | `sterling_silver` |
| Platinum 950 | `platinum_950` |

The AI will refuse requests for silly or unsafe materials (clay, uranium, plastic, wood, etc.) and suggest appropriate alternatives.

---

## API Routes

| Method | Route | Description |
|---|---|---|
| POST | `/api/session/start` | Create new session, returns `sessionId` |
| POST | `/api/session/:id/message` | Send user message (+ optional image data URLs); returns AI reply + design spec |
| POST | `/api/session/:id/generate-images` | Generate DALL-E concept renders from design spec |
| POST | `/api/session/:id/quote` | Compute retail quote from design spec |
| GET | `/api/session/:id/pdf` | Download PDF quote |
| POST | `/api/session/:id/close` | Close session and schedule asset cleanup |
| POST | `/api/admin/unlock` | Verify staff PIN, set auth cookie |
| GET | `/api/admin/session/:id` | Staff-only: full session with cost breakdown |

---

## Data Model

```prisma
Session          # chat transcript, design spec, quote, image refs
UploadedAsset    # sketch / inspiration / generated images
AdminEvent       # staff actions log
```

---

## Development

```bash
# Dev server
npm run dev

# Type check
npx tsc --noEmit

# Database migrations
npm run prisma:migrate

# Generate Prisma client after schema changes
npm run prisma:generate

# Production build
npm run build
npm start
```

---

## Licence

MIT
