# Shibaam — Software Requirements Specification

**Version:** 1.0 (incorporating v1.1 additions)  
**Status:** Consolidated requirements baseline  
**Date:** 17 October 2026 (baseline 12 October 2026)  
**Product:** Public business website + private inventory management application

---

## Document Control

| Field | Value |
| --- | --- |
| Document | Shibaam — Software Requirements Specification |
| Version | 1.0 |
| Status | Final baseline for initial product scope |
| Product | Public business website + private inventory management application |
| Primary domain | Wire mesh and related industrial products |
| Initial users | 1 Super User and 4 Normal Users |
| Technology baseline | React, Vite, TypeScript, Tailwind CSS v4, shadcn/ui, Supabase/PostgreSQL, Vercel |
| Date | 12 October 2026 |

Purpose of this version: establish the agreed functional scope, security rules, stock workflow, unit-of-measure architecture, technical direction, and acceptance criteria. Product records can be created by the Super User after deployment; the SRS does not depend on a supplied product catalogue.

Implementation note: this is a final requirements baseline, not a final database migration specification. Exact columns, numeric precision, indexes, and detailed conversion validations will be finalized during technical design without changing the requirements in this document.

## 1. Purpose and Product Vision

Shibaam will provide a lightweight, modern and reliable inventory platform for a business dealing primarily in wire mesh and related industrial products.

Product vision: make day-to-day stock management simple while protecting inventory accuracy, supporting product-specific units and measurements, and maintaining a complete, auditable history of stock changes.

- Correctness and data integrity take priority over convenience shortcuts.
- Fast, clear workflows for desktop and mobile users.
- A public website that remains available independently of the inventory backend.
- A configurable product and unit model rather than hard-coded assumptions about every product.
- A deliberately lean implementation that can grow without introducing unnecessary ERP complexity.

## 2. Scope

### 2.1 In scope — initial release

- Static public business website with home, about, product catalogue, applications/use cases and contact content.
- Private authenticated inventory application.
- Authentication and role-based access for one Super User and four Normal Users.
- Product and category management; configurable product specifications and status.
- Unit-of-measure (UOM) definitions and product-specific permitted units.
- Standard unit conversions and a dedicated Standard Wire Gauge (SWG) reference/calculation module.
- Stock additions, removals, Super User-only corrections, stock ledger and audit trail.
- Variable measurement capture and configurable roll/lot tracking per product.
- Inventory search, filters, stock status, dashboard, basic reports and low-stock identification.
- Responsive, accessible UI; input validation; useful loading, empty, success and error states.
- Deployment, security testing, backup and recovery planning.

### 2.2 Explicitly out of scope for the initial release

- Accounting, GST automation, payroll, HR, full CRM, invoicing and payment processing.
- Purchase orders, sales orders, supplier/customer management and procurement workflows.
- Multi-company ERP, warehouse robotics and advanced warehouse orchestration.
- Advanced barcode/QR infrastructure unless separately approved.
- AI chatbot or AI-driven stock calculations.
- The Admin Conversion Creator is a planned later-phase module, not a blocker for core v1.0.

### 2.3 Future-compatible, not promised in v1.0

The architecture should not prevent future purchasing, sales, suppliers, customers, barcode/QR, additional warehouses, richer analytics or a custom conversion creator. These modules must not be built prematurely as part of the initial scope.

## 3. System Architecture

### 3.1 Two experiences, one project/domain

- Public website: static, customer-facing pages and static product content. It must not query the inventory database or call inventory APIs.
- Private inventory app: authenticated, database-backed workflows for staff.

The public website must continue to render if Supabase, the database or inventory APIs are unavailable. Public catalogue content is maintained separately as static site content and does not expose live stock.

### 3.2 Suggested routes

| Experience | Routes (illustrative) |
| --- | --- |
| Public | / | /about | /products | /applications | /contact |
| Authentication | /login |
| Private | /dashboard | /inventory | /movements | /products | /reports | /users | /settings |

Exact route names may change during implementation. Public and private route boundaries and their security requirements may not.

### 3.3 Technology baseline

| Layer | Decision |
| --- | --- |
| UI | React + Vite + TypeScript |
| Styling/components | Tailwind CSS v4 + shadcn/ui + Radix primitives |
| Icons | Lucide React |
| Forms/validation | React Hook Form + Zod |
| Backend/data | Supabase PostgreSQL, Supabase Auth, Row-Level Security (RLS), database functions |
| Hosting/deployment | Vercel |
| Charts | Recharts only where a chart provides clear value |
| Optional later | TanStack Query, Zustand, realtime subscriptions or animation library only if justified |

No separate Express service, MongoDB, Firebase, Redux, microservices or AI-first architecture is required for the initial version. Critical inventory changes must be handled in PostgreSQL transactions/database functions, not trusted to client-side calculations.

## 4. Roles and Authorization

### 4.1 Super User

- Create, edit, activate/deactivate and archive products; manage categories and product specifications.
- Manage UOM definitions, product UOM settings and approved conversion rules.
- Set product stock thresholds and tracking method.
- Set or establish opening stock using a controlled, auditable workflow.
- Perform stock corrections; a reason is mandatory.
- View all movements, audit logs, reports and user activity.
- Create/manage Normal Users, activate/deactivate access and manage system settings.

### 4.2 Normal User

- Sign in and view/search/filter inventory.
- View product details, permitted units and relevant stock history.
- Add stock and remove stock using a valid UOM and the measurements required for that product.
- View operation confirmations and errors.

### 4.3 Normal User restrictions

- Cannot create/edit/archive product definitions or categories.
- Cannot modify UOM definitions, conversion rules, tracking configuration or stock thresholds.
- Cannot perform stock corrections.
- Cannot manage users or system settings.
- Cannot bypass stock validation or edit historical movements.

Authorization must be enforced by database policies and trusted database functions/RPCs, not only by hiding controls in the UI. A disabled account must not be able to perform protected operations.

## 5. Product and Category Management

The Super User will create product records after the application is available. A preloaded real catalogue is not required to finalize the SRS.

- Each product must have a stable ID and a unique business code where codes are used.
- Store name, category, description, active/archive status and timestamps.
- Support structured, configurable specifications rather than hard-coding only wire-mesh fields into the product table.
- Product attributes may include mesh count, SWG/gauge, wire diameter, material, dimensions and other relevant properties when applicable.
- Product configuration must define permitted UOMs, applicable conversion rules, measurement requirements and stock tracking method.
- Archived products remain visible in historical records but cannot be used for new stock operations unless explicitly reactivated.
- Public catalogue information is separate static content; changes in private inventory must not automatically expose internal data.

## 6. Unit of Measure and Conversion Requirements

### 6.1 Configurable UOMs

The system must support configurable units, including the currently identified examples: meter, roll, piece, bundle, square meter and other units approved by the Super User. Additional units such as weight or length units may be configured when required. This list is not a claim that every unit is valid for every product.

A product may allow multiple transaction UOMs. The application must only offer a UOM when the product configuration and required conversion/measurement data make the operation valid.

### 6.2 Separate conversion modules

- Standard Conversions: reference conversions between compatible dimensions, maintained as validated rules.
- SWG Reference: gauge-to-wire-diameter lookup and related calculations. SWG is a reference scale, not a linear UOM.
- Admin Conversion Creator (later phase): Super User-created custom conversion definitions, with source/target units, factor or rule, scope, activation/deactivation, validation and audit history.

### 6.3 Conversion safeguards

- Do not assume 1 bundle equals a fixed quantity of weight, length or pieces unless an authorized rule explicitly defines it.
- Do not convert between incompatible dimensions without sufficient product/measurement data and an approved formula.
- A roll's weight or length may vary. A generic conversion must never invent its actual weight or length.
- Where variable measurements are required, capture the actual measurement for the individual roll, lot or stock entry, according to the product's tracking configuration.
- Mesh means mesh count (openings per linear inch under the applicable convention); it is not synonymous with micron size or mesh opening.
- Conversion results must retain the rule and rule version used so historical movements remain interpretable.
- The UI may preview a conversion, but the trusted database operation must validate and calculate the authoritative stock effect.

### 6.4 Supplied reference values — pending verification

The previously supplied reference sheet was reported to include: meter to feet = 3.281; square meter to square feet = 10.764; inch to millimeter = 25.4; millimeter to micron = 1,000; and SWG-to-diameter lookup using a reference table. These values are recorded as supplied inputs, not independently verified standards. They must be checked and approved before production use. The SWG chart must be transcribed and validated against a reliable reference before it is loaded.

### 6.5 Base quantity and multi-dimensional stock

The data model must not force every product into a single scalar base quantity if that would lose essential stock information. It must support a canonical quantity where appropriate, while preserving relevant count and actual measurements (for example, roll count plus measured length or weight) where the product requires them. The final representation is a technical-design decision, but the system must not discard information needed to validate removals.

## 7. Stock Workflow

### 7.1 Add stock

- User selects a product and the application loads that product's permitted UOMs, tracking mode and required measurements.
- User enters quantity and UOM and supplies required measurements or lot/roll details.
- The system validates the input and determines whether a valid conversion or direct measured quantity is available.
- The UI previews the expected effect where it can be calculated reliably.
- On confirmation, the database applies the movement atomically and writes the ledger/audit record.

### 7.2 Remove stock

- User may choose the UOM appropriate to the transaction, including the UOM in which stock is sold or issued, but only if a valid conversion or actual measurement supports it.
- The system checks available stock in the relevant tracked dimensions/lot/roll scope.
- The operation is rejected if it would result in negative stock or consume stock that is not available.
- The system displays the proposed stock effect before confirmation when determinable and records the transaction after successful commit.

### 7.3 Variable roll and lot tracking

The Super User chooses the tracking method per product. The system must be designed to support individual roll records/identifiers or batch/lot/aggregate tracking where appropriate. If an operation requires roll-specific measurements, those measurements must be recorded against the relevant roll or stock entry. The exact interaction design will be set during UX/technical design.

### 7.4 Stock correction

Stock corrections are Super User-only and require a reason. They are distinct from ordinary add/remove operations and must be fully audited. A correction must not silently overwrite or erase historical movement records.

### 7.5 Opening stock

Initial stock entry must use a controlled workflow that records the starting quantity, UOM/measurements, actor, timestamp and any required reference/reason. Opening stock must not be inserted by an untracked client-side shortcut.

### 7.6 Atomicity and concurrency

- Stock validation and mutation must occur in one database transaction or equivalent atomic database function.
- Concurrent updates must not lose changes, double-consume stock or bypass the no-negative-stock rule.
- The database must re-check current stock at commit time rather than relying on an earlier UI value.
- Failed operations must not leave partial stock updates or orphaned movement records.

## 8. Stock Ledger and Audit Trail

Every successful inventory change must create an immutable movement record. Historical movements must not be silently edited or deleted; errors should be corrected with a reversal or a new adjustment record.

A movement should preserve, where applicable: movement ID, product, actor, transaction type, entered quantity and UOM, actual measurements supplied, authoritative converted quantity/dimensions, previous and resulting stock, reason, reference, timestamp, relevant roll/lot, and conversion rule/version.

The audit trail must also record material administrative actions, including product changes, UOM changes, conversion changes, threshold changes, user activation/deactivation and system configuration changes. The Super User can review the audit history.

Audit and movement data must be protected from Normal User modification. Failed attempts that matter for security may be logged where feasible, without exposing sensitive credentials.

## 9. Inventory UI, Search and Status

### 9.1 Inventory list

- Show relevant product identifiers, category, current stock/measurements, applicable UOM information and stock status.
- Support search by product name, code, category and relevant specifications.
- Support filters such as category, stock status and other fields justified by product configuration.
- Show only reliable equivalents; do not display calculated equivalents when the required rule or actual measurement is missing.

### 9.2 Stock statuses

- Healthy: above the configured low-stock threshold.
- Low stock: at or below the configured threshold, as defined by the implementation.
- Out of stock: no available stock in the product's relevant tracked quantity/dimensions.
- Overstocked may be added when a maximum threshold is configured; it is not mandatory for the initial release.

### 9.3 Dashboard

- Total active products.
- Low-stock and out-of-stock counts.
- Today's stock movements.
- Recent activity, with permissions applied.
- Keep the dashboard focused and lightweight; do not build analytics solely for decoration.

### 9.4 Responsive UX

- Mobile-friendly search and stock operations.
- Touch-friendly forms and clear quantity/UOM labels.
- Clear loading, empty, validation, success and error states.
- Confirmation for stock operations and meaningful summaries of expected effects.
- Accessible keyboard navigation, focus states, contrast and semantic controls.
- Minimal, purposeful animation; no heavy visual effects that impair speed.

## 10. Reporting and Alerts

### 10.1 Initial reporting

- Current inventory report.
- Stock movement report over a selected date range.
- Product-specific movement/history report.
- Low-stock/out-of-stock report.
- User activity report for inventory actions.

CSV export is a suitable baseline if export is included in the first release. Excel/PDF export can be added if confirmed during implementation planning; this SRS does not make every format mandatory.

### 10.2 Smart features after core reliability

- Low-stock alerts.
- Reorder suggestions based on configured thresholds and reliable movement data.
- Usage trends and estimated stock duration where history is sufficient.
- Concise inventory summaries.

Smart features are secondary to the core stock engine. No smart or AI feature may be the authoritative source for inventory quantities, conversions, permissions or transaction validation.

## 11. Authentication and Security

- Use Supabase Auth for staff authentication.
- Protect all private routes and data operations.
- Apply PostgreSQL RLS policies and trusted database functions to enforce least privilege.
- Do not expose service-role secrets in browser code.
- Validate inputs in the UI and again at the trusted database boundary; use database constraints where appropriate.
- Protect against unauthorized stock manipulation and user/role escalation.
- Use secure session handling and environment-specific secrets.
- Do not expose internal inventory, stock levels, movements, internal notes or user data on public pages.
- Log and display actionable errors without leaking secrets, tokens or internal stack traces.
- Test both allowed and denied actions for each role.

## 12. Public Website and SEO

- Static pages for business introduction, product categories/catalogue, applications and contact details.
- Responsive, mobile-first layout with optimized assets and semantic HTML.
- Page titles, meta descriptions, canonical URLs where appropriate, Open Graph metadata, sitemap and robots configuration.
- Structured data only where accurate and supported by the actual business content.
- Accessible headings, descriptive links and image alternative text.
- Optimize performance and Core Web Vitals.
- No live stock quantities or private inventory API/database dependencies.
- Use the supplied brand palette; the final logo and approved brand assets will be provided separately.

## 13. Brand and UI Direction

| Token | Hex | Use |
| --- | --- | --- |
| Shibaam Red | #E11E24 | Important highlights, alerts and destructive actions; use with restraint. |
| Shibaam Blue | #004AAD | Primary actions, links and navigation emphasis. |
| Ink | #111111 | Main text and wordmark. |
| Navy | #0B1F3A | Dark sections, footer and premium UI surfaces. |
| White | #FFFFFF | Main canvas and contrast. |
| Surface | #F6F8FB | Light backgrounds and subtle panels. |

The interface should feel modern, professional and clean. Blue should anchor primary actions; red should signal attention rather than dominate every screen. The logo is not yet supplied and must not be invented as a finalized brand asset.

## 14. Conceptual Data Model

The following is a conceptual guide, not a locked physical schema. Final tables, keys, indexes and numeric precision will be decided during technical design.

- User profiles/roles and access state.
- Products, categories and configurable product attributes/specifications.
- UOM definitions and product-permitted UOMs.
- Standard conversion rules with versioning and activation state.
- SWG gauge-to-diameter reference data.
- Product-specific conversion and measurement requirements.
- Inventory balances or materialized stock state, designed consistently with the ledger.
- Stock movements/ledger, with entered values, actual measurements, calculated effects and actor metadata.
- Optional roll/lot records for products that require traceability.
- Audit events and system settings.

Use PostgreSQL numeric/decimal types with precision selected for actual business ranges. Do not rely on JavaScript floating-point arithmetic for authoritative stock math. Stock balances and movement history must remain reconcilable.

## 15. Non-Functional Requirements

### 15.1 Performance

- Public pages should load quickly and remain independent of backend availability.
- Dashboard queries should fetch only needed data and remain responsive as records grow.
- Avoid unnecessary client-side processing, redundant queries and premature abstractions.

### 15.2 Reliability and integrity

- Atomic stock transactions, safe concurrent updates and strict no-negative-stock enforcement.
- Reproducible historical interpretation using stored entered values and conversion rule/version.
- No silent failure or partial writes.
- Consistent validation between UI and database.

### 15.3 Accessibility and compatibility

- Responsive behavior across common desktop, tablet and mobile widths.
- Keyboard operability, visible focus, sufficient contrast and accessible labels.
- Clear date, quantity and UOM presentation.

### 15.4 Maintainability

- TypeScript strictness and modular separation of UI, domain logic and data access.
- Document database functions, RLS policies and conversion rules.
- Use focused dependencies and avoid architecture that exceeds the initial scope.

## 16. Backup, Recovery and Operations

- Establish a documented database backup and recovery procedure before production launch.
- Confirm the Supabase plan's backup/retention capabilities and any additional backup requirement before go-live.
- Test restoration or recovery steps rather than assuming backups are usable.
- Use separate development/preview and production configuration where practical.
- Protect production secrets and restrict administrative access.
- Use deployment previews and a controlled production release process.

## 17. Development and Delivery Plan

1. Finalize this requirements baseline and identify implementation decisions that need technical design.
2. Define the conceptual and physical data model, RLS policies and database transaction functions.
3. Set up the React/Vite/TypeScript application, Supabase project, environments and deployment pipeline.
4. Implement authentication, user profiles and role enforcement.
5. Implement configurable UOMs, validated standard conversions and SWG reference data; verify supplied reference values before loading them.
6. Implement stock ledger, add/remove workflows, product-specific measurements and configurable roll/lot tracking.
7. Build product/category administration, inventory list/detail screens and Super User controls.
8. Build dashboard, thresholds, reports and any agreed CSV export.
9. Run security, concurrency, calculation, accessibility, mobile and recovery testing.
10. Build and polish the static public website, catalogue content and SEO using approved business information and brand assets.
11. Deploy, verify production behavior and document operational procedures.

The Admin Conversion Creator and smart features follow the stable core inventory engine unless reprioritized by an explicit scope decision.

## 18. Acceptance Criteria

- [ ] Public pages render without database or inventory API calls and remain available during backend/database downtime.
- [ ] Public pages expose no internal stock, movement, user or configuration data.
- [ ] Staff authentication and protected routes work reliably.
- [ ] Super User and Normal User permissions are enforced in the database layer.
- [ ] Normal Users can view/search/filter inventory and perform allowed stock additions/removals.
- [ ] Normal Users cannot change product/UOM/conversion configuration, manage users/settings, archive products or perform stock corrections.
- [ ] Super User can manage products, categories, UOM configuration, thresholds, users and corrections.
- [ ] Products can be configured with permitted UOMs, required measurements and tracking methods.
- [ ] Only valid conversions are offered; the system does not invent variable roll weight/length.
- [ ] SWG is handled as a reference lookup/calculation scale, not as a linear unit conversion.
- [ ] Every successful stock change produces a complete ledger entry with sufficient information to interpret the calculation.
- [ ] Negative stock is rejected at the authoritative database transaction boundary.
- [ ] Concurrent stock operations cannot silently overwrite one another or oversubscribe available stock.
- [ ] Corrections and opening stock are controlled and auditable.
- [ ] Historical movements cannot be silently edited/deleted.
- [ ] Inventory search, filters, stock status and core dashboard work.
- [ ] Required mobile stock workflows are usable without avoidable horizontal scrolling.
- [ ] Validation, loading, empty, success and error states are clear.
- [ ] RLS policies and database functions have positive and negative permission tests.
- [ ] Backup/recovery procedure is documented and tested.
- [ ] Production deployment is stable and environment secrets are protected.
- [ ] Public pages have appropriate metadata, semantic structure and responsive performance.

## 19. Decisions and Items Deferred to Technical Design

- Exact physical schema, table/column names, indexes and numeric precision.
- The final complete UOM catalogue and which units apply to each product.
- Verification and approval of the standard conversion factors. The user-provided SWG chart is the approved source and must be transcribed faithfully.
- Detailed conversion formulas where dimensions, material, diameter, length, area or weight are involved.
- Per-product choice of individual-roll tracking versus lot/aggregate tracking and its exact UX.
- Exact stock threshold semantics and whether any product uses more than one tracked stock dimension.
- Final report export formats beyond the initial agreed report set.
- The precise backup tier, retention policy and recovery targets.
- Final public website copy, product imagery, company information and logo assets.

These items do not prevent SRS v1.0 from serving as the initial scope baseline. They must be resolved before the affected functionality is implemented or released to production.

## 20. Glossary

| Term | Meaning |
| --- | --- |
| UOM | Unit of measure used to enter, store, calculate or display a quantity. |
| SWG | Standard Wire Gauge reference scale used to map gauge values to wire diameter. |
| Mesh count | Number of openings per linear inch under the applicable convention; distinct from opening size and micron. |
| Stock movement | A recorded addition, removal, opening balance, correction or reversal affecting inventory. |
| Stock ledger | Historical record of stock movements used to audit and reconcile inventory. |
| RLS | PostgreSQL Row-Level Security policies that restrict data access. |
| Variable measurement | A measurement such as roll length or weight that differs by physical roll, lot or entry and must be captured rather than guessed. |
| Admin Conversion Creator | A planned later-phase feature for authorized custom conversion rules. |

## Appendix A — Initial Route Proposal

| Route | Access | Purpose |
| --- | --- | --- |
| / | Public | Business homepage |
| /about | Public | Company information |
| /products | Public | Static product catalogue |
| /applications | Public | Industries and use cases |
| /contact | Public | Contact details and inquiry path |
| /login | Public entry | Staff sign-in |
| /dashboard | Authenticated | Inventory overview |
| /inventory | Authenticated | Inventory list/search/filter |
| /movements | Authenticated | Movement ledger/history |
| /products | Super User for management; staff for permitted details | Product listing/details and management actions governed by role |
| /reports | Authenticated, with role-sensitive content | Inventory and movement reports |
| /users | Super User | User management |
| /settings | Super User | System configuration |

The same URL path may resolve differently based on application routing architecture; public catalogue data and private product administration must remain separate in data access and authorization.

## Appendix B — Reference Conversion Data Handling

Treat the following values as pending verification, not certified standards: 1 meter = 3.281 feet; 1 square meter = 10.764 square feet; 1 inch = 25.4 millimeters; 1 millimeter = 1,000 microns. Before activation, document the approved source, factor, direction, precision/rounding policy and version. The user-provided SWG chart is the authoritative business reference for this project. Transcribe each gauge, inch and millimeter value faithfully from the supplied image; do not substitute an external chart. If any entry is genuinely unreadable, flag that entry for user review instead of guessing.

## 21. Approved additional requirements (consolidated in v1.1)

### 21.1 Bill status on stock movements
- Every stock addition and stock removal must require an explicit choice: **With bill** or **Without bill**.
- Both choices must always be visible; neither may be silently preselected. The database RPC must reject a missing or invalid value.
- Bill status is a movement-level tag only. It does not split stock pools, change stock quantities, or trigger accounting, GST, invoicing or payment behaviour.
- Bill status is stored immutably on each add/remove movement. Opening stock and stock corrections use `NULL` because the field is not applicable. A reversal inherits the original movement's bill status.
- An optional free-text bill reference may be recorded when **With bill** is selected. It is not an invoice-validation workflow.
- Normal Users may select bill status and see it on movements they are permitted to view. Reports and filters specifically by bill status are Super User-only.

### 21.2 Perforated-sheet product specifications
- Perforated-sheet products must represent these as separate structured fields: hole diameter, pitch, hole pattern, hole shape, thickness and material. Pitch must never be merged with mesh count, hole diameter or opening size.
- **Pitch** means the centre-to-centre distance between adjacent holes.
- Store pitch and hole diameter in canonical millimetres at full precision. Entry in another unit is allowed only through a verified conversion.
- Open area is a derived value, never manually entered. Calculate it in the database from the approved formula for the selected pattern. Do not round calculation intermediates or stored values; round only the final UI display.
- For round holes, validate `pitch > hole diameter` and, when a confirmed formula applies, validate `0 < open area < 100`.
- The following proposed round-hole formulas remain **inactive until the user confirms them**:
  - 60° staggered/equilateral triangular layout: `open_area_percent = (π / (2 × √3)) × (d / p)^2 × 100`.
  - 90° straight/square layout: `open_area_percent = (π / 4) × (d / p)^2 × 100`.
- No open-area figure may be shown for a hole shape/pattern without a user-approved formula. This includes slotted, square, hexagonal, 45° staggered and unequal X/Y pitch patterns unless separately confirmed.
- Pitch, hole diameter, pattern and thickness are product identity fields. After the product has any stock movement, these identity fields are locked; a different specification requires a new product. Changes before the first movement are Super User-only and audited.
- Perforated-sheet inventory rows, details, search and filters must include the relevant pitch and hole diameter; show open area only when a confirmed formula is available.

### 21.3 Precision and rounding
- PostgreSQL `numeric` is required for authoritative stock quantities, conversion factors, measurements and derived values; choose explicit precision/scale during technical design.
- Never use JavaScript floating-point calculations as the authoritative stock result. Quantity inputs sent to stock RPCs must preserve decimal text; the database calculates the committed result.
- Do not round or truncate conversion factors, intermediate values, stored quantities, ledger values or database-calculated open area.
- Round only the final display value in the UI. The rounded display value must never be stored, reused in calculations or sent back to the database.
- RPC results and exports preserve full precision unless a future explicit business decision changes the export policy.

### 21.4 Authentication and privileged user creation
- Public self-registration is disabled.
- The Super User creates/deactivates Normal Users through a trusted Supabase Edge Function that verifies the caller is an active Super User.
- The service-role/secret key must remain server-side only; never put it in browser code, `VITE_*` variables, logs or commits.
- Authorization role is read from the protected `profiles` record using the authenticated user ID, never from user-editable `user_metadata` or a client-supplied role.
- Every table in the `public` schema must have RLS enabled, with default-deny policies and narrowly scoped access.
- `SECURITY DEFINER` functions must set an empty search path, schema-qualify objects, check identity, role and active status, and revoke execution from `PUBLIC`/`anon` before granting only the intended role.

### 21.5 Implementation and repository rules
- One Vite project with separate public and private route trees. Public routes: `/`, `/about`, `/products`, `/applications`, `/contact`. Private routes: `/app/dashboard`, `/app/inventory`, `/app/movements`, `/app/products`, `/app/reports`, `/app/users`, `/app/settings`, plus `/login`.
- Until the inventory app is working, `/` redirects to `/login`; build the public website last. Public pages must be statically pre-rendered at build time and must never import the Supabase client or call inventory APIs.
- Supabase client is only in private-app code. Database migrations are the source of truth for schema, RLS and functions; do not mutate production schema manually through the dashboard.
- Generate TypeScript database types from Supabase tooling; do not hand-maintain generated table types.
- Use Tailwind CSS v4's Vite plugin and CSS-first configuration. Do not add `tailwind.config.js`, v3 directives or the legacy `tailwindcss-animate` plugin. Use `tw-animate-css` only if animation is justified and compatible.
- Add tests for RLS allow/deny cases, stock RPC validation, concurrency, ledger immutability, bill status, full-precision math, perforated-sheet formulas, stock/ledger reconciliation and public-page operation with Supabase unavailable.
- Test typecheck, lint and unit tests for each relevant change; run database tests whenever migrations, RLS or RPCs change. Report honestly when a test could not be run.

### 21.6 SWG chart — user-approved source of truth
The user has explicitly confirmed that the supplied photograph titled **“Standard Wire Gauge Conversion Table”** is the final approved SWG reference for Shibaam. The image is included in Appendix C of the Word version of this SRS. It is not a placeholder and does not require external chart approval. Implementation must transcribe the gauge number and its inch and millimetre diameter values from this image. Do not replace the table with an external standard or silently normalize its displayed values. If a specific character cannot be read reliably from the photograph, ask the user about that row rather than inventing a value. SWG remains a lookup scale, not a linear unit.

### 21.7 Product code generation and dimensional conversions
- **Automated product codes:** Products are assigned sequential codes formatted as `SE-0001` through `SE-9999` backed by database sequence `product_code_seq` on insertion. The product code is immutable once assigned.
- **Dynamic Paano dimensional conversions:** For continuous roll and wire-mesh products having a configured Height (Paano / fixed width), the system dynamically computes exact conversions between linear units (`ft`, `m`, `in`, `mm`) and area units (`sqft`, `sqm`) without rounding. Conversions are enforced authoritatively in PostgreSQL RPC `private.resolve_base_qty` and previewed client-side using `Decimal.js`.
- **Database handover & reset procedures:** Documented and tested cleanup scripts live in `docs/` (`reset-test-data.sql` for resetting transactions while keeping catalog items, and `factory-reset-clean-slate.sql` for complete factory reset including sequence reset).

## 22. Acceptance criteria additions
- [x] Add/remove forms require explicit With bill / Without bill selection, with no default.
- [x] Bill status is persisted on add/remove ledger records, does not alter stock balances, and is NULL for opening/correction; reversals inherit it.
- [x] Bill-status reports and filters are available only to the Super User.
- [x] Perforated-sheet pitch and hole diameter are separate searchable fields and display on inventory list/detail.
- [x] Open area is database-derived at full precision only for a confirmed formula; unsupported patterns show no figure.
- [x] Perforated-sheet identity fields cannot be changed after the first movement.
- [x] SWG reference data is transcribed from the user-approved image; no substitute chart is loaded.
- [x] No calculation-path rounding occurs; UI-only rounding never becomes stored input.
- [x] All public-schema tables have RLS and privileged functions enforce role and active status.
- [x] Public signup is disabled and privileged user creation is server-side only.

## Appendix C — Approved SWG reference image
The following user-supplied image is the authoritative SWG table for this project. Preserve it as the transcription source during implementation.

![User-approved Standard Wire Gauge Conversion Table](d2940528-fa57-470b-b8f4-15e0c7daf0e2.jpg)

