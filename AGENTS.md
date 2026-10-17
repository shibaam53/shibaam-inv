# AGENTS.md — Shibaam

Operating instructions for AI coding agents (Claude Code, Codex, Cursor, Copilot, etc.).
Read this file first, then `PROJECT.md` for product context. If the two ever conflict with the SRS (`Shibaam_SRS_v1_0.md`), the SRS wins. If any of them conflict with a user's explicit instruction in the current task, follow the user and flag the conflict.

> Tip: tools that look for `CLAUDE.md`, `.cursorrules` or `.github/copilot-instructions.md` should point to this file (symlink or a one-line "See AGENTS.md").

---

## 1. What this project is

Shibaam is two things in one repo/domain:

1. **Public website** — static marketing site for a wire-mesh / industrial products business. No database, no live stock.
2. **Private inventory app** — authenticated stock management for 1 Super User + 4 Normal Users.

**Prime directive: inventory correctness and auditability beat convenience, speed of delivery, and cleverness.**

---

## 2. Stack (fixed — do not substitute)

| Layer | Choice |
| --- | --- |
| UI | React + Vite + TypeScript (strict) |
| Styling | Tailwind CSS **v4** + shadcn/ui + Radix |
| Icons | Lucide React |
| Forms | React Hook Form + Zod |
| Backend | Supabase: PostgreSQL, Auth, RLS, SQL functions (RPC), Edge Functions |
| Hosting | Vercel |
| Charts | Recharts, only where a chart earns its place |

**Not allowed without explicit approval:** Express/Node backend, MongoDB, Firebase, Redux, microservices, any AI-driven stock logic, new UI kits, ORMs layered over Supabase.
**Allowed only if justified in the PR/commit message:** TanStack Query, Zustand, an animation library.

---

## 3. Non-negotiable rules

### 3.1 Inventory integrity
- **All stock mutations go through Postgres functions (RPC).** The client never `insert`/`update`/`delete`s `stock_movements`, balances, or roll/lot rows directly.
- Each RPC is **one transaction**: validate → lock the affected balance/lot rows (`SELECT … FOR UPDATE`) → re-check stock **at commit time** → write movement + update balance → write audit. No partial writes.
- **Negative stock is rejected in the database.** UI checks are a convenience only.
- **The ledger is immutable.** No `UPDATE`/`DELETE` on movements — enforce with revoked privileges **and** a trigger that raises. Mistakes are fixed by a reversal or adjustment movement.
- Every movement stores: product, actor, type, entered qty + UOM, actual measurements, authoritative converted qty/dimensions, previous & resulting stock, reason/reference, timestamp, roll/lot, **conversion rule + version**.
- **Corrections** and **opening stock** are Super User-only, have their own RPCs, require a reason (corrections) and are fully audited. They are never ordinary add/remove.
- **Bill status is mandatory on every stock add and stock remove.** Each movement stores `bill_status` (`with_bill` | `without_bill`), set by the RPC from the user's selection and immutable like the rest of the ledger (fix mistakes with a reversal/correction). It is a **tag only**: it never splits stock balances (one stock pool), never changes quantities, and implies no GST/accounting logic. Opening stock and corrections have `bill_status = NULL` (not applicable); a reversal inherits the original's value. Enforce with a `CHECK` constraint keyed on movement type, and reject missing/invalid values in the RPC.

### 3.2 Numbers
- Use PostgreSQL `numeric` with explicit precision/scale chosen for real business ranges. Never `float`/`real`/`double precision` for stock.
- **Never use JavaScript floating-point for authoritative math.** The client sends quantities as **strings**; the database computes. A client-side preview may use `decimal.js` (or similar) and must be labelled "preview" — the RPC result is the truth.
- **No rounding in calculations.** Conversion factors, intermediate values, stored quantities and ledger values keep full `numeric` precision. Never `ROUND`/`TRUNC`/`toFixed` inside a function, rule, preview calculation or stored column.
- **Round only the final displayed result, and only in the UI.** Rounding is a presentation concern: apply it at the last step of rendering (e.g. `Intl.NumberFormat` / decimal.js `toDecimalPlaces` on the already-computed value). The rounded figure is never written back, never re-used as an input, and never sent to the database.
- Because the UI rounds only for display, exports (CSV) and API/RPC results carry the full-precision value unless the user decides otherwise.

### 3.3 Units and conversions — never invent data
- A product only offers a UOM when its configuration **and** required conversion/measurement data make the operation valid.
- Do **not** assume `1 bundle = N kg/m/pcs`. Do **not** assume a roll's length or weight. If it varies, capture the **actual** measurement per roll/lot/entry.
- Do **not** convert across incompatible dimensions without product data and an approved formula.
- **SWG is a lookup scale, not a linear unit.** Model it as a reference table + calculation module, never as a multiplier.
- **Mesh = mesh count** (openings per linear inch). It is not micron size and not opening size. Keep these fields separate.
- **Perforated sheets: Pitch is a critical, client-required specification.** Pitch = centre-to-centre distance between adjacent holes. Together with hole diameter it determines **open area** (% of the sheet that is empty vs solid). Pitch, hole diameter, hole pattern and sheet thickness are separate fields; never merge pitch with mesh count, hole diameter or opening size.
- **Open area is derived, never typed in.** Compute it in the database (function/view) from pitch, hole diameter and hole pattern at full precision; it follows the no-rounding rule (UI rounds for display only). Validate `pitch > hole diameter` (round holes) and `0 < open area < 100`. Only formulas listed in `PROJECT.md §6` and confirmed by the client may be activated; hole shapes/patterns without an approved formula show **no** open-area figure rather than a guess.
- Pitch and hole diameter are stored in one canonical unit (mm) at full precision and may be entered in other permitted units only through a verified conversion rule.
- If a rule or measurement is missing, **show nothing** rather than a guessed equivalent.
- The reference values in the SRS (1 m = 3.281 ft, 1 m² = 10.764 ft², 1 in = 25.4 mm, 1 mm = 1000 µm, the SWG chart) are **pending verification**. Do not hard-code them in application code. Load them only as versioned, inactive-by-default rule rows until the user confirms an approved source, factor, direction and precision. Store the **exact** factor (e.g. 3.280839895, not the rounded 3.281); the rounding in the supplied sheet must not be baked into the rule.

### 3.4 Security and authorization
- **RLS enabled on every table in `public`.** A table without RLS is a bug. Default deny; add the narrowest policy that works.
- Authorization is enforced by **RLS + RPC checks**, never by hiding UI controls.
- Role comes from the **`profiles` table** (looked up via `auth.uid()`), **never** from `user_metadata` (user-editable) or client-supplied values.
- `SECURITY DEFINER` functions must: set `search_path = ''`, schema-qualify every object, check `auth.uid()` + role + `is_active` first, and `REVOKE EXECUTE … FROM public, anon` then grant only to `authenticated`.
- A deactivated account must fail every protected operation, including with a still-valid session.
- **Public signup is disabled.** Users are created by the Super User through a **Supabase Edge Function** that verifies the caller is an active Super User. The service-role key lives only in Edge Function / Vercel server secrets — **never** in client code, `VITE_*` variables, logs or commits.
- Validate in the UI (Zod) **and** again at the DB boundary (constraints, `CHECK`, function guards).
- Error messages shown to users must not leak secrets, tokens, SQL or stack traces.

### 3.5 Public / private separation
- Public pages **must not** import the Supabase client or call any inventory endpoint, and must render with the backend completely down. Enforce with an ESLint `no-restricted-imports` rule scoped to `src/public/**`.
- Public catalogue content is **static** (typed content files / MDX / JSON in the repo). No live stock, internal notes, or user data ever appear publicly.
- Do not invent a logo or brand asset. Use a text wordmark placeholder until final assets are supplied.

---

## 4. Decisions already made (do not re-ask)

These close minor ambiguities in the SRS. Change them only if the user says so.

1. **One Vite project, two route trees.** Public routes live at `/`, `/about`, `/products`, `/applications`, `/contact`. The private app lives under **`/app/*`** (`/app/dashboard`, `/app/inventory`, `/app/movements`, `/app/products`, `/app/reports`, `/app/users`, `/app/settings`), plus `/login`. This resolves the SRS's `/products` path collision.
2. Public routes are code-split and **statically pre-rendered at build time** for SEO; the private app is a client-rendered SPA. **The public site is built last**; until then `/` redirects to `/login` and agents must not build public pages, SEO or catalogue content unless asked.
3. **Supabase client is created only in `src/app/lib/supabase.ts`** and imported only by private-app code.
4. **Generated DB types** come from `supabase gen types typescript`; never hand-write table types.
5. **Migrations are the single source of truth** for schema, RLS and functions (`supabase/migrations/`). No schema changes through the dashboard.
6. **Roles:** `super_user` and `normal_user` as a Postgres enum on `profiles`. Exactly the permission matrix in `PROJECT.md §4`.
7. **Data fetching:** plain Supabase calls wrapped in a thin typed data-access layer. Add TanStack Query only when caching/invalidation becomes a real problem.
8. **Stock status** is computed in the database (view/function), not in the component, so every screen agrees.
9. **Perforated-sheet identity fields** (hole diameter, pitch, hole pattern, thickness) define the product. Once a product has any movement they are **locked**; a different pitch/diameter means a new product. Only the Super User edits them before that, audited.
10. **Bill status control:** a required two-option segmented control ("With bill" / "Without bill") on every add/remove form, both options always visible, **no silent default** so it cannot be skipped by habit. Both roles can set it. Optional free-text bill reference may be captured when "With bill" is chosen (reuses the movement `reference` field; not validated, no invoicing).
11. **Visibility:** Normal Users see bill status on movements they are permitted to view; reports and filters by bill status are Super User only.
12. **Stock model:** every product has one **base UOM**; the balance and every ledger `qty_delta` are stored in it. Entered units convert via an **active** conversion rule, or (for `requires_measurement` units such as rolls) the caller supplies the measured base quantity. Roll tracking uses `stock_rolls`; opening stock, corrections and reversals are Super User-only RPCs; a movement can be reversed once.
13. **Ledger visibility:** a Normal User reads only the movements they created; the Super User reads all. Loosen with a new migration if the business wants shared history.
14. **Internal functions** live in schema `private` (not exposed by the API). Public RPCs are `security definer` with `search_path = ''`, check the caller's role first, and are granted to `authenticated` only.

---

## 5. Tailwind v4 + shadcn/ui rules

These cause the most breakage; treat them as first-class.

- Tailwind v4 uses the **Vite plugin** (`@tailwindcss/vite`) and CSS-first config: `@import "tailwindcss";` in the main CSS file. **Do not create `tailwind.config.js`** and do not add `@tailwind base/components/utilities` directives or a PostCSS Tailwind plugin.
- Define brand tokens in CSS with `@theme` (and shadcn variables in `:root` / `.dark`), not in a JS config.
- Use the **shadcn CLI for Tailwind v4**. Animation utilities come from **`tw-animate-css`**, not the legacy `tailwindcss-animate` plugin.
- Add components with the CLI into `src/components/ui/`; keep edits to those files minimal and deliberate.
- Path alias `@/` must be set in **both** `tsconfig.json` (and `tsconfig.app.json`) and `vite.config.ts`.
- Before adding any Tailwind plugin or shadcn component, check that it supports Tailwind v4. If unsure, say so rather than guessing.

### Brand tokens

| Token | Hex | Use |
| --- | --- | --- |
| `--color-brand-red` | `#E11E24` | Alerts, destructive actions, key highlights. **Use sparingly.** |
| `--color-brand-blue` | `#004AAD` | Primary actions, links, nav emphasis |
| `--color-ink` | `#111111` | Body text, wordmark |
| `--color-navy` | `#0B1F3A` | Dark sections, footer |
| `--color-surface` | `#F6F8FB` | Light panels/backgrounds |
| white | `#FFFFFF` | Canvas |

Blue anchors the UI; red signals attention. A screen mostly red is wrong. Verify text/background contrast (WCAG AA) for every pairing.

---

## 6. Repository layout (target)

```
/
├─ AGENTS.md  PROJECT.md  Shibaam_SRS_v1_0.md
├─ docs/                   # bootstrap-super-user.sql, reset-test-data.sql (dev only)
├─ supabase/
│  ├─ migrations/          # schema, RLS, functions — source of truth (never edit an applied migration)
│  ├─ functions/           # Edge Functions (e.g. admin-create-user)
│  ├─ tests/               # pgTAP: RLS allow/deny, stock RPCs, concurrency
│  └─ seed.sql             # dev-only seed; never contains real secrets
├─ src/
│  ├─ public/              # static site: pages, content, SEO. NO supabase imports
│  ├─ app/                 # private app
│  │  ├─ lib/              # supabase client, auth, decimal helpers
│  │  ├─ features/         # inventory, movements, products, uom, reports, users, settings
│  │  │  └─ <feature>/     # components/ hooks/ api/ schemas/ (Zod) types.ts
│  │  └─ routes/
│  ├─ components/ui/       # shadcn
│  ├─ styles/              # globals.css (@import "tailwindcss", @theme)
│  └─ types/database.ts    # generated — do not edit
├─ vercel.json             # SPA rewrites for /app/* and /login; headers
└─ .env.example            # names only, never values
```

Keep UI, domain logic and data access separated. Domain rules (what is a valid movement) live in the database; the front end renders and collects input.

---

## 7. Commands

Expected scripts (update this section once the project is scaffolded):

```bash
npm run dev            # Vite dev server
npm run build          # type-check + production build (+ public pre-render)
npm run typecheck      # tsc --noEmit
npm run lint           # ESLint (incl. public/private import boundary)
npm run test           # unit tests (Vitest)
npx supabase start     # local Supabase stack
npx supabase db reset  # replay migrations + seed locally
npx supabase test db   # pgTAP tests
npx supabase gen types typescript --local > src/types/database.ts
```

**Docker is optional.** The local stack (`supabase start`, `db reset`) needs Docker; the project can instead use a hosted `shibaam-dev` Supabase project (no real data) as its test database, applying migrations with `npx supabase db push` (no Docker needed). Production is a separate project and is only changed through reviewed migrations.

Run `typecheck`, `lint`, `test` and (when DB files changed) `supabase test db` before declaring work done. If a command doesn't exist yet, say so; don't pretend it passed.

---

## 8. Coding standards

- TypeScript `strict: true`. No `any` (use `unknown` + narrowing). No non-null `!` to silence real nullability.
- Zod schema is the single source for form validation and parsed API data; infer types from schemas.
- Small, focused components; no premature abstractions or generic "frameworks". Three similar lines beat a wrong abstraction.
- Every data-driven view implements **loading, empty, error, and success** states.
- Stock forms: label **quantity and UOM clearly**, show the expected effect when reliably computable, require explicit confirmation, and disable submit while pending (no double-submits).
- Accessibility: semantic elements, labelled controls, visible focus, keyboard operable, sufficient contrast, no information by color alone (status badges also use text/icon).
- Mobile first for stock operations: touch-friendly targets, no avoidable horizontal scroll. Tables scroll inside their own container.
- Animation is minimal and purposeful; respect `prefers-reduced-motion`.
- Dates stored as `timestamptz` (UTC), displayed in the user's locale/timezone consistently.
- Prefer focused dependencies. Justify each new package (size, maintenance, why not existing tools).
- Comment the **why** for non-obvious rules, especially in SQL (RLS policies, locks, conversion logic).

### Database standards
- Name things in `snake_case`; plural table names; `id uuid primary key default gen_random_uuid()`; `created_at`/`updated_at timestamptz`.
- Add `CHECK` constraints (non-negative balances, positive movement quantities, valid enums) and foreign keys; index every FK and common filter columns.
- Every migration is forward-only, idempotent where practical, and ships with its tests.
- Document each RLS policy and RPC with a short header comment: who may call it, what it guarantees.

---

## 9. Testing requirements

Tests are part of the feature, not a follow-up.

- **RLS / authorization (pgTAP):** for each table and RPC, test **allowed and denied** for `super_user`, `normal_user`, deactivated user, and anonymous.
- **Stock RPCs:** add, remove, correction, opening stock; rejection of negative stock; invalid UOM; missing measurement; archived product; reversal.
- **Concurrency:** two simultaneous removals against limited stock must not oversubscribe; verify no lost updates.
- **Conversions:** rule/version recorded on the movement; incompatible conversions rejected; SWG lookup correctness once the chart is verified; **no rounding anywhere in the calculation path** (assert full-precision results); UI display rounding applied only at render.
- **Ledger immutability:** attempted update/delete fails.
- **Bill status:** add/remove without it is rejected; invalid value rejected; opening/correction store NULL; reversal inherits; balances identical regardless of bill status; Normal User cannot read Super User-only bill reports.
- **Perforated sheets:** open-area function matches hand-calculated cases at full precision for each approved pattern; `pitch <= diameter` rejected; unapproved shape/pattern returns no open area; identity fields locked after first movement.
- **Reconciliation:** balance equals the sum of ledger effects.
- **UI:** forms (validation, pending, error), role-based route guards, mobile layout of stock flows, public pages rendering with Supabase unreachable.
- **Accessibility:** automated checks (axe) on key screens plus keyboard walkthrough.

---

## 10. Deployment and operations (Vercel + Supabase)

- `vercel.json` must include an SPA rewrite so deep links under `/app/*` and `/login` resolve to the app shell, without breaking pre-rendered public pages and static assets. Test a hard refresh on a deep route in a preview deploy.
- **Migrations workflow:** `npx supabase migration new <name>` → edit the file → `npx supabase db push --dry-run` → `npx supabase db push`. Never change the schema in the dashboard; if someone did, capture it with `npx supabase db pull`. Every new table/view/function migration must enable RLS, revoke default privileges and grant narrowly (see migration 3).
- Env vars: `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` only in the client (the publishable key `sb_publishable_…` is public by design — safety comes from RLS). The secret key (`sb_secret_…`) and any other secrets are server-side only. Use the new publishable/secret keys, not the legacy `anon`/`service_role` JWT keys, which Supabase is deprecating by the end of 2026. Keep `.env.example` current; never commit `.env*` with values.
- Separate dev/preview and production Supabase projects where practical; never run experiments against production data.
- Add security headers (CSP, `X-Content-Type-Options`, `Referrer-Policy`, frame protections) and verify the CSP still permits Supabase and fonts actually used.
- SEO for public pages: titles, meta descriptions, canonicals, Open Graph, `sitemap.xml`, `robots.txt`, semantic headings, image alt text, accurate structured data only. `/app/*` and `/login` get `noindex`.
- If PWA/offline behavior is ever added: never cache authenticated API responses or stock data in a service worker; stale stock is a correctness bug.
- Before go-live: documented and **tested** backup/restore, confirmed Supabase backup tier/retention, restricted admin access, controlled production release.

---

## 11. Workflow for agents

1. **Read before writing.** Check `PROJECT.md`, existing migrations, and neighbouring code. Match existing patterns.
2. **Plan briefly** for anything touching schema, RLS, RPCs, conversions, or auth: state the approach and the failure cases before coding.
3. **Make minor decisions yourself and state them.** Don't stall on trivia. Record non-obvious choices in the commit/PR message.
4. **Smallest correct change.** Don't refactor unrelated code, rename broadly, or add features outside the task.
5. **Output style:** give complete, ready-to-paste code for new files and significant rewrites; use targeted diffs/snippets for small edits.
6. **Verify**, then report honestly: what you ran, what passed, what you could not run.
7. **Leave a trail:** update `PROJECT.md` (status/decisions) and this file's commands when reality changes.

### Stop and ask the user before…
- Adding or activating any conversion factor, UOM rule or SWG data (they are pending verification).
- Adding an open-area formula for a hole shape/pattern not yet confirmed by the client (slotted, square, hex, unequal X/Y pitch, 45° stagger, etc.).
- Adding accounting/GST/invoice behaviour behind bill status, or letting it split or alter stock balances.
- Changing the role/permission matrix, ledger semantics, or stock tracking model.
- Building anything listed as out of scope (§ `PROJECT.md` 3) — purchasing, sales, suppliers/customers, accounting/GST, barcode/QR, multi-warehouse, AI features, the Admin Conversion Creator.
- Introducing a new major dependency or architectural layer.
- Any destructive operation on data, migrations that drop/rename populated columns, or touching production.
- Inventing business content: company details, product specs, imagery, logo, copy. Use clearly marked placeholders.

---

## 12. Definition of done

A task is done only when all apply:

- [ ] Works on desktop and mobile widths; loading/empty/error/success states present.
- [ ] Types strict, lint clean, tests written and passing (including RLS allow/deny where relevant).
- [ ] No secrets or service-role usage in client code; no new table without RLS.
- [ ] Stock-affecting changes run through an RPC and produce a complete ledger/audit record.
- [ ] No float math on authoritative quantities; no invented conversions.
- [ ] Public pages still have zero dependency on Supabase.
- [ ] Accessibility basics verified (labels, focus, contrast, keyboard).
- [ ] Docs updated (`PROJECT.md`, SQL header comments, `.env.example`).

---

## 13. Anti-patterns (reject on sight)

- Client-side stock math that is trusted, or "optimistic" stock updates that bypass the RPC.
- Editing or deleting ledger rows to "fix" data.
- Role checks only in React.
- `user_metadata` used for authorization.
- A secret key (`sb_secret_…`) or legacy `service_role` key in the browser bundle or any `VITE_*` variable.
- A hard-coded bundle/roll equivalence, or SWG treated as a multiplier.
- Public pages fetching from Supabase "just for the catalogue".
- A `tailwind.config.js`, `tailwindcss-animate`, or v3-style directives in a v4 project.
- Letting users type open area by hand, or rounding open area before storing/using it.
- Treating pitch as hole diameter or mesh count, or hiding pitch from inventory list/search/detail.
- Making bill status optional, defaulting it silently, or storing it only in the UI.
- Building purchasing/sales/ERP features "while we're here".
