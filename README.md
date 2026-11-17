<div align="center">

# 🌸 Zoecomsos · v2

**A self-owned florist storefront — Next.js, Postgres, Prisma, Clerk, and an admin panel that doesn't pay rent to anyone.**


![Next.js](https://img.shields.io/badge/Next.js-15-000?logo=next.js&logoColor=white)
![React 19](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Postgres](https://img.shields.io/badge/Postgres-16-336791?logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?logo=prisma&logoColor=white)
![Clerk](https://img.shields.io/badge/Auth-Clerk-6C47FF)
[![CI](https://github.com/Embox99/flower_shop/actions/workflows/ci.yml/badge.svg)](https://github.com/Embox99/flower_shop/actions/workflows/ci.yml)
![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)

</div>

---

## What changed in v2

v1 was a redesign on top of **Wix Headless**. v2 brings the backend home:

| Layer | v1 | v2 |
|---|---|---|
| Products & cart | Wix Stores SDK | **Postgres** via Prisma |
| Cart & checkout | Wix `currentCart` + Wix redirect | **Own** anon-cart cookie + REST API |
| Auth | Wix OAuth visitor / member | **Clerk** (sign-in, sign-up, and sessions) |
| Storage | Wix Media | **S3-compatible** (Supabase Storage) |
| Admin | Wix dashboard | **Custom** admin under `/admin` |
| Payments | Wix-hosted | Mocked — staff marks PAID in admin |



## Preview

![Catalog Preview](./public//images//main_preview.png)

![Admin Preview](./public/images/admin_preview.png)

## Highlights

- **Fast by default.** Server components read the catalogue straight from Postgres through one cached data layer (`unstable_cache` + tag revalidation), so pages never round-trip through their own API. The home page is statically prerendered with ISR.
- **Mobile-first storefront.** Responsive down to 360px: bottom-sheet filters, sticky add-to-basket bar, touch-friendly quick add, no iOS input zoom.
- **Real commerce plumbing.** Server-side pricing, atomic stock decrement in a transaction, guest and signed-in carts that merge on sign-in, owner-editable delivery fees.
- **Secure where it matters.** Redis rate limiting on cart, checkout and order lookup; order details only visible to their owner or the browser that placed them; drafts never leak through public endpoints.
- **SEO ready.** Per-product metadata, Open Graph, schema.org `Product` JSON-LD, `sitemap.xml` and `robots.txt`.
- **Accessible.** Focus-visible rings, skip link, Escape-to-close dialogs with scroll lock, `prefers-reduced-motion` support.
- **A real admin.** Dashboard, order pipeline, drag-and-drop delivery board, product editor with S3 uploads, customers and subscriptions — usable on a phone too, with a slide-out sidebar.

## Tech stack

- **Next.js 15** App Router · server components, route handlers
- **TypeScript** end-to-end (including Prisma migrations & seeds)
- **PostgreSQL 16** + **Prisma 5** schema-first
- **Clerk** for sign-in, sign-up, sessions, and authentication email
- **Zod** for request validation
- **Zustand** for client cart + UI store
- **Supabase Storage** for product photos via signed PUT URLs
- **Vitest** for unit tests · **Playwright** for E2E

## Quick start

Cloud deployment guidance is in [`docs/deployment.md`](./docs/deployment.md).
The application uses hosted services and does not require Docker.

### Prerequisites
- **Node.js 18.17+**
- Hosted PostgreSQL, Redis, S3-compatible storage, and a Clerk instance

### 1. Install
```bash
git clone https://github.com/Embox99/flower_shop.git
cd flower_shop
npm install
```

### 2. Configure hosted services

Create a Supabase project with PostgreSQL and a **public** Storage bucket named
`uploads`. Create an Upstash Redis database and an SMTP account with Brevo,
Resend, or Gmail. Copy their credentials into `env.example`.

### 3. Configure environment
```bash
cp env.example .env.local
cp env.example .env

# generate a secret and paste it into NEXTAUTH_SECRET in .env.local:
openssl rand -base64 32
```

`env.example` is the cloud/Vercel template. Use separate Supabase, Upstash,
storage, and SMTP credentials for development, preview, and production.

### 4. Schema + seed
```bash
npm run db:migrate    # creates the schema
npm run db:seed       # seeds catalog + an owner account
```

…or do it all in one shot:
```bash
npm run setup
```

### 5. Run the app
```bash
npm run dev
```

| URL | What |
|---|---|
| http://localhost:3000 | Storefront |
| http://localhost:3000/admin | Admin (sign in as the owner) |
| http://localhost:3000/login | Customer sign-in (magic link via hosted SMTP) |
| http://localhost:5555 | `npm run db:studio` — Prisma Studio (DB browser) |

**Default owner login** (set in `.env.local`):

```
email:    owner@flower-shop.local
password: studio
```

## API

### Public
- `GET  /api/products` — live products w/ filters (category, q, min, max, color, stems, deliver, sort, page)
- `GET  /api/products/[slug]` — single product w/ variants + stems
- `GET  /api/categories`
- `GET  /api/cart` — current cart (anon or signed-in; merges the guest cart on sign-in)
- `POST /api/cart` — add a line item
- `PATCH /api/cart/items/[id]` — update qty / vase / message (qty=0 removes)
- `DELETE /api/cart/items/[id]`
- `DELETE /api/cart` — clear the cart
- `POST /api/checkout` — convert the cart into an Order
- `GET  /api/orders?code=FS-XXXXX` — fetch an order you own or placed from this browser
- `GET  /api/orders` — list own orders (signed in)

### Account (signed-in customer)
- `GET   /api/account/addresses` — saved delivery addresses
- `POST  /api/account/addresses` — add an address
- `PATCH /api/account/addresses/[id]` — edit / set default
- `DELETE /api/account/addresses/[id]`

### Staff-only (`STAFF` or `OWNER`)
- `GET   /api/admin/dashboard` — KPIs + activity feed + stock alerts
- `GET   /api/admin/orders` — paged list with filters
- `GET   /api/admin/orders/[id]` — full order + events
- `PATCH /api/admin/orders/[id]` — change status / payment / append note
- `GET   /api/admin/products` — paged list
- `POST  /api/admin/products` — create
- `GET   /api/admin/products/[id]` — single
- `PATCH /api/admin/products/[id]` — update
- `DELETE /api/admin/products/[id]` — archive (default) or hard delete (`?hard=1`)
- `GET   /api/admin/customers` — paged list with LTV
- `PATCH /api/admin/subscriptions/[id]` — pause / resume / cancel a plan
- `GET   /api/admin/settings` — shop hours + delivery config
- `PATCH /api/admin/settings` — update hours / delivery windows / fees (owner)
- `POST  /api/admin/upload-url` — signed S3 PUT URL for product photography

### Auth
- Sign-in and sign-up are handled by Clerk.

All endpoints validate input via Zod and return JSON with appropriate status codes.

## Admin walkthrough

| Page | Purpose |
|---|---|
| `/admin` | Dashboard — today's revenue, status counts, activity feed, low stock |
| `/admin/orders` | Filterable order list with status tabs + search |
| `/admin/orders/[code]` | Order detail — line items, totals, customer, gift note, timeline; one-click status advance + payment marking |
| `/admin/deliveries` | Today's kanban — drag cards between New / Tying / Ready / Out to advance status |
| `/admin/products` | Catalog — sortable by status, sales, stock |
| `/admin/products/[id]` | Editor — basics, palette swatch picker, pricing, variant table |
| `/admin/customers` | Customer list with lifetime value |
| `/admin/subscriptions` | Active / paused / canceled plans with pause / resume / cancel controls |
| `/admin/settings` | Owner-only — editable shop hours, delivery windows, fees |

## Authentication & roles

- Clerk handles customer and staff authentication; application roles are resolved server-side.
- `OWNER_EMAIL` identifies the owner. `ADMIN_EMAIL` grants staff access to a verified Clerk primary email, without owner-only settings access.
- Order emails use OpenMail. See [email configuration](docs/email-configuration.md) for setup and delivery limitations.
- Apply Prisma migrations before deploying checkout changes.

To promote a customer to staff:
```sql
update "User" set role = 'STAFF' where email = 'naama@flower-shop.local';
```
…or use Prisma Studio.

## Images

To upload from the admin, the browser calls `POST /api/admin/upload-url`, then
PUTs the file directly to Supabase Storage; only the public URL gets stored in
the database.

For production:
- **Supabase Storage** — use the S3 endpoint, credentials, and public object URL
  from the project. See [`docs/storage-migration.md`](./docs/storage-migration.md).

## Tests

```bash
npm run test          # Vitest — unit
npm run test:watch
npm run test:e2e      # Playwright — opens a real browser
npm run test:e2e:ui   # Playwright UI mode
npm run lint
npm run typecheck
```

CI runs lint, typecheck, unit tests and a production build on every push and pull request.

## Contributing

Issues and pull requests are welcome. Run `npm run lint && npm run typecheck && npm test` before opening a PR.

<div align="center">
Released under the [MIT License](./LICENSE).

<sub>If this saved you a Wix subscription, consider giving it a ⭐.</sub>
</div>