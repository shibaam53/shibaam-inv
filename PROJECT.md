# PROJECT.md — Shibaam

Product context for humans and AI agents. Distilled from `Shibaam_SRS_v1_0.md` (v1.0, 12 Oct 2026). The SRS is the authority; this file is the working summary plus status and decisions. Agent operating rules are in `AGENTS.md`.

---

## 1. Summary

**Shibaam** is a public business website plus a private inventory management app for a business dealing mainly in **wire mesh and related industrial products**.

**Vision:** make day-to-day stock management simple while protecting inventory accuracy, supporting product-specific units and measurements, and keeping a complete, auditable history of every stock change.

**Principles**
1. Correctness and data integrity over convenience shortcuts.
2. Fast, clear workflows on desktop and mobile.
3. Public site stays up even if the backend is down.
4. Configurable products and units, not hard-coded assumptions.
5. Lean now, able to grow later, without building ERP complexity early.

**Users:** 1 Super User + 4 Normal Users (initial).

---

## 2. Architecture at a glance

```
            ┌──────────────────────────────┐
 Visitors → │ Public site (static)         │  no DB, no inventory API
            └──────────────────────────────┘
            ┌──────────────────────────────┐        ┌───────────────────────────┐
 Staff    → │ Private app (/login, /app/*) │ ─────→ │ Supabase                  │
            │ React SPA                    │  RPC   │  Auth · Postgres · RLS    │
            └──────────────────────────────┘        │  SQL functions · Edge Fn  │
                       Vercel                        └───────────────────────────┘
```

- **Stack:** React + Vite + TypeScript, Tailwind CSS v4, shadcn/ui (Radix), Lucide, React Hook Form + Zod, Supabase (PostgreSQL/Auth/RLS/RPC), Vercel, Recharts (only if valuable).
- **Source of truth for stock:** PostgreSQL transactions/functions. The client displays and collects; it does not decide.
- **Not in the stack:** Express, MongoDB, Firebase, Redux, microservices, AI-first architecture.

### Routes

| Route | Access | Purpose |
| --- | --- | --- |
| `/`, `/about`, `/products`, `/applications`, `/contact` | Public (static) | Business site |
| `/login` | Public entry | Staff sign-in |
| `/app/dashboard` | Authenticated | Overview |
| `/app/inventory` | Authenticated | List, search, filter, stock status |
| `/app/movements` | Authenticated | Ledger / history |
| `/app/products` | Super User manages; staff view permitted details | Product admin and details |
| `/app/reports` | Authenticated (role-sensitive) | Reports |
| `/app/users` | Super User | User management |
| `/app/settings` | Super User | System configuration |

Private routes are prefixed `/app` to avoid colliding with the public `/products` page (implementation decision; the SRS allows route names to change as long as public/private boundaries hold).

---

## 3. Scope

### In scope (v1.0)
- Static public website: home, about, catalogue, applications/use cases, contact.
- Authentication + role-based access (1 Super User, 4 Normal Users).
- Products and categories; configurable specifications; active/archived status.
- UOM definitions; product-specific permitted units.
- Standard conversions; **SWG reference/calculation module**.
- Add / remove stock, Super User-only corrections, opening stock, immutable ledger, audit trail.
- **Bill status** (With bill / Without bill) captured on every stock add/remove.
- **Perforated-sheet specifications**: hole diameter, **pitch**, hole pattern, thickness, and derived **open area**.
- Variable measurement capture; configurable **roll vs lot/aggregate** tracking per product.
- Inventory search, filters, stock status, dashboard, basic reports, low-stock identification.
- Responsive and accessible UI; validation; clear loading/empty/success/error states.
- Deployment, security testing, backup and recovery plan.

### Out of scope (v1.0)
Accounting, GST automation, payroll, HR, CRM, invoicing, payments; purchase/sales orders; supplier/customer management; multi-company ERP, warehouse robotics/orchestration; advanced barcode/QR; AI chatbot or AI stock calculations. The **Admin Conversion Creator** is a later phase.

### Future-compatible (do not build now)
Purchasing, sales, suppliers, customers, barcode/QR, additional warehouses, richer analytics, custom conversion creator. Keep the design from blocking them; do not implement them.

---

## 4. Roles and permissions

| Capability | Super User | Normal User |
| --- | :---: | :---: |
| Sign in; view/search/filter inventory | ✅ | ✅ |
| View product details, permitted UOMs, stock history | ✅ | ✅ |
| Add stock / remove stock (valid UOM + required measurements) | ✅ | ✅ |
| Create/edit/activate/deactivate/archive products and categories | ✅ | ❌ |
| Manage UOMs, conversion rules, tracking method, stock thresholds | ✅ | ❌ |
| Set opening stock (controlled workflow) | ✅ | ❌ |
| Stock corrections (reason mandatory) | ✅ | ❌ |
| View all movements, audit logs, user activity, all reports | ✅ | ❌ (own/permitted views only) |
| Create/manage users, activate/deactivate access, system settings | ✅ | ❌ |
| Select bill status on stock add/remove | ✅ | ✅ |
| Reports and filters by bill status | ✅ | ❌ |
| Edit/delete historical movements | ❌ | ❌ |
| Bypass stock validation | ❌ | ❌ |

Enforced in the database (RLS + RPC checks). A deactivated account can do nothing protected.

---

## 5. Domain model (conceptual)

Final schema is decided in technical design. Required concepts:

- **profiles** — user, role (`super_user` | `normal_user`), `is_active`.
- **categories**, **products** — stable ID, unique business code, name, category, description, status (active/archived), timestamps.
- **product attributes/specifications** — structured and configurable (mesh count, SWG/gauge, wire diameter, material, dimensions, and for perforated sheets: hole diameter, **pitch**, hole pattern, thickness), not hard-coded columns on the product table. Open area is derived (see §6).
- **uoms** and **product_uoms** — configurable units; which units each product may transact in.
- **conversion_rules** — versioned, activatable, with source/target units, full-precision factor or formula, scope.
- **swg_reference** — gauge → wire diameter lookup.
- **product measurement requirements** — what must be captured per entry/roll/lot.
- **stock balances** — canonical state, always reconcilable with the ledger; must not lose multi-dimensional info (e.g., roll count **and** measured length/weight).
- **stock_movements (ledger)** — immutable; add, remove, opening, correction, reversal.
- **rolls/lots** — optional, for products needing traceability.
- **audit_events**, **system_settings**.

### Ledger record (where applicable)
movement ID · product · actor · type · entered qty + UOM · actual measurements · authoritative converted qty/dimensions · previous and resulting stock · reason · reference · **bill status** (add/remove only) · timestamp · roll/lot · conversion rule + version.

### Audit events
Product, UOM, conversion, threshold, user activation/deactivation and system-setting changes.

---

## 6. Units, conversions and measurement rules

- **Configurable UOMs.** Known examples: meter, roll, piece, bundle, square meter; weight/length units as approved. No unit is automatically valid for every product.
- **Three modules:**
  1. *Standard Conversions* — validated reference rules between compatible dimensions.
  2. *SWG Reference* — gauge → diameter lookup and related calculations. **A scale, not a linear UOM.**
  3. *Admin Conversion Creator* — Super User-defined custom conversions; **later phase**.
- **Safeguards**
  - Never assume a fixed bundle quantity, or a roll's weight/length.
  - Never convert across incompatible dimensions without data + an approved formula.
  - Variable measurements (roll length/weight) are **captured per roll/lot/entry**.
  - **Mesh** = mesh count (openings per linear inch). Not micron, not opening size.
  - Conversion results keep the **rule + version** used.
  - UI may preview; the database decides the authoritative effect.
  - No reliable rule/measurement → no displayed equivalent.

### Reference values — PENDING VERIFICATION (do not ship as truth)

| Item | Supplied value | Note |
| --- | --- | --- |
| meter → feet | 3.281 | Supplied value is rounded; exact is 3.280839895…. Store the exact factor once verified |
| m² → ft² | 10.764 | Supplied value is rounded; exact is 10.7639104…. Store the exact factor once verified |
| inch → mm | 25.4 | Exact by definition |
| mm → µm | 1,000 | Exact by definition |
| SWG → diameter | table (to transcribe) | Validate every pair against an approved reference |

Before activation, record: approved source, factor (full precision), direction, version.

### Perforated sheets: pitch and open area
**Pitch** is the most critical measurement when specifying a perforated sheet: it is the centre-to-centre distance between adjacent holes. The relationship between hole diameter and pitch determines the sheet's **open area**, the percentage of the sheet that is empty space versus solid material. It is therefore required for every perforated-sheet product, shown on the inventory list, detail and filters, and searchable.

- **Fields (separate, never merged):** hole diameter, pitch, hole pattern, hole shape, thickness, material. Stored in a canonical unit (mm) at full precision; other units only via verified conversion rules.
- **Open area is derived** in the database, never entered by hand, never rounded in calculation (UI rounds for display only).
- **Validation:** `pitch > hole diameter` (round holes); `0 < open area < 100`.
- **Identity:** diameter, pitch, pattern and thickness define the product; locked once the product has movements (a new pitch = a new product).

Proposed formulas for **round holes**, with `d` = hole diameter, `p` = nearest-neighbour centre distance, same unit. **Pending client confirmation; do not activate until confirmed.**

| Pattern | Open area % |
| --- | --- |
| 60° staggered (equilateral triangle layout) | `(π / (2·√3)) × (d / p)² × 100` (≈ 90.69 × (d/p)²) |
| 90° straight (square layout) | `(π / 4) × (d / p)² × 100` (≈ 78.54 × (d/p)²) |

Other shapes and patterns (slotted, square, hex, 45° stagger, unequal X/Y pitch) have **no formula yet** and show no open-area figure until the client supplies one. Use full-precision π in the database.

### Rounding policy (decided)
- **No rounding in calculations.** Factors, intermediates, stored quantities and ledger values keep full precision.
- **Round only the final result, and only on the UI side**, purely for display. The rounded value is never stored, re-used in calculation, or sent to the database.
- Exports and RPC results carry full precision unless decided otherwise.

---

## 7. Stock workflows

### Add stock
Select product → app loads permitted UOMs, tracking mode and required measurements → enter quantity + UOM + measurements/lot/roll details → **choose bill status (With bill / Without bill, required, no default)** → validate → preview effect (only if reliably computable) → confirm → database applies movement atomically and writes ledger + audit.

### Remove stock
Choose UOM appropriate to the transaction (only if a valid conversion or actual measurement supports it) → **choose bill status (required)** → check available stock within the right dimensions/lot/roll scope → reject if it would go negative or consume unavailable stock → show expected effect → commit and record.

### Tracking
Super User picks per product: **individual roll records** or **batch/lot/aggregate**. Roll-specific measurements are recorded against the relevant roll/entry. Exact UX is a design task.

### Correction
Super User only; reason required; separate from add/remove; fully audited; never overwrites history.

### Opening stock
Controlled workflow recording quantity, UOM/measurements, actor, timestamp and reference/reason. No untracked client-side insert.

### Bill status
- Two options, always shown: **With bill** and **Without bill**. Required on every add and remove; no silent default.
- A **tag on the movement only**. It does not split stock (one stock pool), change quantities, or trigger accounting/GST/invoicing behaviour (still out of scope).
- Optional free-text bill reference when **With bill** is chosen (uses the movement `reference` field).
- Not applicable (NULL) for opening stock and corrections; a reversal inherits the original's value.
- Immutable once saved; correct mistakes via reversal/correction.
- Shown in the movement ledger for permitted viewers; reports and filters by bill status are Super User only.

### Atomicity and concurrency
One DB transaction per operation; lock affected rows; re-check stock at commit; no lost updates, no double-consumption, no partial writes, no orphan movements.

---

## 8. UI, search, status

- **Inventory list:** identifiers, category, current stock/measurements, applicable UOM info, status. Search by name, code, category, relevant specs. Filters: category, status, configuration-justified fields (including pitch and hole diameter for perforated sheets). Perforated-sheet rows show pitch, hole diameter and open area.
- **Statuses:** *Healthy* (above threshold) · *Low* (at/below threshold) · *Out of stock* (nothing available in the relevant tracked dimensions) · *Overstocked* optional, only if a max threshold exists.
- **Dashboard (lean):** total active products, low/out-of-stock counts, today's movements, recent activity (permission-aware). No decorative analytics.
- **UX:** mobile-friendly stock operations; touch-friendly forms; clear quantity/UOM labels; confirmation with effect summary; clear loading/empty/validation/success/error states; keyboard accessible; minimal motion.

### Reports (v1.0)
Current inventory · movements over a date range · per-product history · low/out-of-stock · user activity · movements filtered by bill status (Super User only). CSV export is the baseline if export ships; Excel/PDF only if confirmed later.

### After core reliability
Low-stock alerts, reorder suggestions, usage trends, concise summaries. These **never** become the authority for quantities, conversions, permissions or validation.

---

## 9. Security essentials

Supabase Auth · protected routes and data · RLS + trusted RPCs for least privilege · no service-role secrets in the browser · UI **and** DB validation · protection against unauthorized stock changes and role escalation · secure sessions · no internal data on public pages · errors without secrets/stack traces · tests for **allowed and denied** actions per role.

---

## 10. Public website and SEO

Static pages (business intro, categories/catalogue with perforated-sheet specs such as pitch, hole diameter and open area as static content, applications, contact); mobile-first, semantic HTML, optimized assets; titles, meta descriptions, canonicals, Open Graph, sitemap, robots; accurate structured data only; accessible headings/links/alt text; strong Core Web Vitals; **no live stock, no inventory API/DB dependency**.

Content, imagery, company details and logo are **not yet supplied**. Use clearly marked placeholders; never invent them.

### Brand

| Token | Hex | Use |
| --- | --- | --- |
| Shibaam Red | `#E11E24` | Highlights, alerts, destructive actions — with restraint |
| Shibaam Blue | `#004AAD` | Primary actions, links, nav emphasis |
| Ink | `#111111` | Text, wordmark |
| Navy | `#0B1F3A` | Dark sections, footer, premium surfaces |
| White | `#FFFFFF` | Canvas |
| Surface | `#F6F8FB` | Light backgrounds, subtle panels |

Feel: modern, professional, clean. Blue anchors; red signals.

---

## 11. Non-functional requirements

- **Performance:** fast public pages; lean dashboard queries that scale with data; no redundant queries or premature abstractions.
- **Reliability:** atomic stock transactions, no negative stock, reproducible history via stored entered values + rule/version, no silent failures, consistent UI/DB validation.
- **Accessibility/compatibility:** responsive on desktop/tablet/mobile, keyboard operable, visible focus, contrast, accessible labels, clear dates/quantities/UOMs.
- **Maintainability:** strict TypeScript, separated UI/domain/data layers, documented DB functions + RLS + conversion rules, focused dependencies.
- **Operations:** documented and tested backup/recovery before launch, confirmed Supabase backup tier, separate dev/preview/prod config, protected secrets, preview deploys, controlled releases.

---

## 12. Delivery plan and status

Update the status column as work progresses.

| # | Phase | Status |
| --- | --- | --- |
| 1 | Finalize requirements baseline (SRS v1.0) | ✅ Done |
| 2 | Data model, RLS policies, DB transaction functions | ✅ Applied to Supabase, 76 pgTAP tests, types generated |
| 3 | Scaffold React/Vite/TS app, Supabase project, environments, Vercel pipeline | ✅ Done (Vite + React 19 + Tailwind v4, Supabase linked, .env.local configured, vercel.json ready) |
| 4 | Auth, profiles, role enforcement | ✅ Done (Super User bootstrapped & logged in, role enforcement verified, Edge Function written) |
| 5 | UOMs, validated standard conversions, SWG reference (after value verification) | ✅ Done (Migration 4 applied, SWG 58-gauge seed ready, conversion rules seed ready, Settings UI live) |
| 6 | Stock ledger, add/remove, measurements, roll/lot tracking | ✅ Done (/app/movements live with immutable ledger, add/remove stock modals, opening stock, corrections, reversals, compound feet+inches helper & mandatory bill status segmented control) |
| 7 | Product/category admin, inventory list/detail, Super User controls | 🟡 In progress (/app/products, /app/settings categories, /app/users live; inventory list/detail upgrade next) |
| 8 | Dashboard, thresholds, reports, CSV export | ⬜ Not started |
| 9 | Security, concurrency, calculation, accessibility, mobile, recovery testing | ⬜ Not started |
| 10 | Static public website, catalogue content, SEO (**built last, after the inventory app is working**) | ⬜ Not started |
| 11 | Production deploy, verification, ops documentation | ⬜ Not started |

Later: Admin Conversion Creator; smart features (after the core engine is stable).

> Build order: inventory management is the main focus, so the public website (Phase 10) is built **last**, after phases 2–9. Until then, `/` redirects to `/login` and no public pages are built. Phase 10 has no dependency on the inventory backend, so it stays independent when it is built.

---

## 13. Acceptance criteria (release gate)

- [ ] Public pages render with no database/inventory API calls and stay up during backend downtime.
- [ ] Public pages expose no internal stock, movement, user or configuration data.
- [ ] Staff authentication and protected routes are reliable.
- [ ] Super User / Normal User permissions are enforced in the database layer.
- [ ] Normal Users can view/search/filter and add/remove stock; cannot change products, UOMs, conversions, users, settings, archive products or correct stock.
- [ ] Super User can manage products, categories, UOMs, thresholds, users and corrections.
- [ ] Products can be configured with permitted UOMs, required measurements and tracking methods.
- [ ] Only valid conversions are offered; variable roll weight/length is never invented.
- [ ] SWG is a reference lookup/calculation, not a linear conversion.
- [ ] Every successful stock change has a complete, interpretable ledger entry.
- [ ] Bill status is required on every add/remove, stored on the ledger, and never affects stock balances.
- [ ] Perforated-sheet products capture pitch, hole diameter and pattern; open area is derived at full precision and shown only where a confirmed formula exists.
- [ ] Negative stock is rejected at the authoritative database boundary.
- [ ] Concurrent operations cannot overwrite each other or oversubscribe stock.
- [ ] Corrections and opening stock are controlled and auditable.
- [ ] Historical movements cannot be silently edited or deleted.
- [ ] Search, filters, stock status and the dashboard work.
- [ ] Mobile stock workflows are usable without avoidable horizontal scrolling.
- [ ] Validation, loading, empty, success and error states are clear.
- [ ] RLS policies and DB functions have positive and negative permission tests.
- [ ] Backup/recovery is documented **and tested**.
- [ ] Production deployment is stable; secrets protected.
- [ ] Public pages have metadata, semantic structure and responsive performance.

---

## 14. Open items (resolve before the affected feature ships)

| Item | Blocks | Owner |
| --- | --- | --- |
| Exact physical schema, names, indexes, numeric precision | Phase 2 | Technical design |
| Final UOM catalogue and per-product applicability | Phase 5 | Super User / business |
| Verify conversion factors and SWG chart (source, exact factor) | Phase 5 | ✅ Resolved (transcribed from user-approved table) |
| Detailed formulas where diameter/length/area/weight interact | Phase 5–6 | Technical design |
| Per-product roll vs lot tracking and UX | Phase 6 | Product + design |
| Threshold semantics; any product with multiple tracked dimensions | Phase 6–8 | Technical design |
| Client confirmation of open-area formulas (60° staggered, 90° straight) and formulas for other hole shapes/patterns | Phase 5–6 | Client + business |
| Whether a bill number/reference should be captured and validated for With bill | Phase 6 | Business |
| Report export formats beyond CSV | Phase 8 | Business |
| Backup tier, retention, recovery targets | Phase 11 | Ops |
| Public copy, imagery, company info, logo | Phase 10 | Business |

---

## 15. Decision log

| Date | Decision | Reason |
| --- | --- | --- |
| 2026-10-12 | SRS v1.0 adopted as scope baseline | Agreed requirements |
| 2026-10-12 | Private app under `/app/*`; public keeps `/products` | Resolves route collision in SRS Appendix A |
| 2026-10-12 | One Vite project; public pre-rendered, private SPA | Public independence from backend + simple deploy |
| 2026-10-12 | Users created via Edge Function; public signup off | Keeps service-role key off the client |
| 2026-10-12 | Role stored in `profiles`, not JWT metadata | `user_metadata` is user-editable |
| 2026-10-12 | Reference conversion values stay inactive until verified | SRS marks them unverified |
| 2026-10-12 | No rounding in calculations; round only the final result, UI display only | Preserves exactness and reproducible history; rounding is presentation |
| 2026-10-15 | Pitch added as a required perforated-sheet spec; open area derived in DB, never hand-entered | Client-critical; pitch + hole diameter determine open area |
| 2026-10-15 | Perforated-sheet identity fields locked after first movement | Keeps ledger history interpretable |
| 2026-10-15 | Bill status (With/Without bill) required on every add/remove, tag only, no default, immutable | Client need; must not split stock or add accounting scope |
| 2026-10-15 | Reports/filters by bill status are Super User only | Limits sensitive visibility |
| 2026-10-15 | Public website and front page are built last; `/` redirects to `/login` until then | Inventory management is the main focus |
| 2026-10-17 | Single Supabase project for now; production = same project after `docs/reset-test-data.sql`, or a new project built with `db push` | User decision; schema lives in migrations so it can be recreated anywhere |
| 2026-10-17 | Stock stored per product in a base UOM; conversions only via active rules or measured quantities; one reversal per movement | Prevents invented conversions; keeps ledger reconcilable |
| 2026-10-17 | Normal Users read only their own movements | Conservative default; easy to loosen |
| 2026-10-17 | Edge Function creates Normal Users only; promotion via `admin_update_profile` | Limits blast radius of the secret key |
| 2026-10-17 | Low-stock threshold is in the product's base UOM; 0 disables the alert | Resolves SRS open item for v1 |

Add new rows as decisions are made.

---

## 16. Glossary

| Term | Meaning |
| --- | --- |
| UOM | Unit of measure for entering, storing, calculating or displaying a quantity |
| SWG | Standard Wire Gauge — reference scale mapping gauge to wire diameter |
| Pitch | Centre-to-centre distance between adjacent holes in a perforated sheet |
| Open area | Percentage of a perforated sheet that is empty space vs solid material; derived from hole diameter, pitch and pattern |
| Bill status | Tag on each stock add/remove: With bill or Without bill |
| Mesh count | Openings per linear inch under the applicable convention (≠ opening size, ≠ micron) |
| Stock movement | Recorded addition, removal, opening balance, correction or reversal |
| Stock ledger | Immutable history of movements used to audit and reconcile inventory |
| RLS | PostgreSQL Row-Level Security |
| RPC | Supabase-exposed Postgres function called from the client |
| Variable measurement | Per roll/lot/entry measurement (e.g., length, weight) that must be captured, not guessed |
| Admin Conversion Creator | Planned later-phase tool for Super User-defined conversion rules |
