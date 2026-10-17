# Service Provider System Dashboard & Simplified Dual-Gateway Portal

Redesign the landing portal into a clear, streamlined dual-gateway separating **Main System Dashboard Login** (for the platform owner/service provider) from **Organization Login** (for client organizations and their staff), and introduce a dedicated **Main System Control Dashboard** where the owner provisions client organizations, manages module capabilities, sets seat quotas, assigns organization admins, and monitors platform-wide usage.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural and UX decisions incorporate your confirmed preferences from the clarification step:

- **Confirmed Decision — Dual-Gateway Landing Portal**: The landing page is simplified into two focused entry points side-by-side: **Organization Portal Login** (select an active client organization and sign in as an employee, manager, or organization admin) and **Main System Dashboard Login** (restricted to the platform owner/developer).
- **Confirmed Decision — Master Passkey / Secret PIN Authentication**: Access to the Owner/Developer Main System Dashboard is protected by a dedicated **System Master Passkey / Secret PIN** verified against the backend service provider controller (with the ability for the owner to rotate/update the passkey from inside the System Dashboard).
- **Confirmed Decision — Full Service-Provider Control Capabilities**:
  1. **Provision & Suspend Client Organizations & Branches**: Create new client organizations with custom sector profiles, currencies, and initial branches, or suspend/reactivate tenant access across the platform.
  2. **Per-Organization Feature Flags & Module Access**: Enable or disable specific application capabilities per organization (e.g., *Periodic KPI Engine*, *Backlog Recovery Module*, *Customer Feedback Portal*, *360 Evaluations*, *LAN Sync & Snapshots*, *Bulk Import/Export*).
  3. **Assign Organization Admins & Employee Seat Quotas**: Set maximum employee seat and branch quotas per organization and provision or reassign the primary Organization Admin (`Super Admin` / `Admin (HQ)`) credentials for each client tenant.
  4. **Cross-Organization Usage, Storage & KPI Activity Telemetry**: Monitor live tenant health, active employee seat utilization, branch counts, total KPI records, automated calculation runs, and storage footprint across all organizations.

---

## 1. Overview & Core Concept

- **What It Does**: Transforms the application into a true multi-tenant B2B service provider platform. Client organizations log into their isolated workspace with only their enabled modules and assigned seats, while you—the platform owner and developer—log into a dedicated **Main System Control Dashboard** to onboard organizations, toggle their feature capabilities, manage quotas, and oversee platform telemetry.
- **Target Audience / Persona**:
  - **Platform Owner / Service Provider (You)**: Uses the Main System Dashboard to operate the app as a managed SaaS service for multiple client organizations.
  - **Organization Users (HQ Admins, Branch Managers, Officers, Staff)**: Use the Organization Login to enter their specific company workspace and execute daily Balanced Scorecard and KPI workflows.
- **Key Value**: Eliminates clutter on the landing portal and establishes a clean boundary between *platform-level service governance* (creating and controlling organizations and their capabilities) and *tenant-level daily operations*.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Simplified Dual-Gateway Landing Portal**:
     - Upon visiting the root portal, the user sees a clean, single-viewport split interface with zero marketing clutter:
       - **Card A — Organization Workspace Login**: Allows selecting a registered client organization (only active, non-suspended organizations are available for standard login) and signing in via Username/Password, Quick PIN, or Google Workspace.
       - **Card B — Main System Dashboard Login (Service Provider / Owner)**: A dedicated dark-slate executive gateway where the platform owner enters the **System Master Passkey / Secret PIN** to launch the Main System Control Dashboard.
  2. **Main System Control Dashboard (Owner / Developer Console)**:
     - **Tenant Provisioning & Lifecycle**: Create new organizations in seconds, configure their sector and headquarters, or toggle an organization between `Active`, `Suspended`, or `Maintenance` status.
     - **Capability & Module Matrix**: Interactive switches for each organization to grant or restrict access to core app modules (*Balanced Scorecard & KPIs*, *Periodic Plans*, *Backlog Recovery*, *Employee 360 Appraisals*, *Customer Feedback*, *Reports & Exports*, and *LAN/Cloud Snapshots*). Disabled modules are automatically hidden from the organization's sidebar and routes.
     - **Seat Quotas & Organization Admin Provisioning**: Configure max employee seats and max branches per organization, view live seat consumption bars, and directly create or reset the organization's primary Admin account.
     - **Cross-Organization Usage & Activity Monitor**: High-density tabular comparison of all client organizations showing active users, branches, KPI count, backlog clearance rate, and estimated data footprint, with a one-click **"Enter Workspace as Owner"** action to inspect any organization directly.

- **Visual Identity & Theme**:
  - **Aesthetic Direction**: Utilitarian enterprise SaaS control plane paired with warm, approachable tenant workspaces.
  - **Color Palette & Mood**:
    - *Dominant Canvas (60%)*: Crisp warm alabaster (`#FAF8F5` / `slate-50`) for the portal canvas and deep obsidian slate (`#0F172A`) for the Owner System Control header and gateway card.
    - *Structural Surfaces (30%)*: Pure white (`#FFFFFF`) single-elevation workspace tables and panels with `1px solid` hairline borders (`border-slate-200`).
    - *Accent Budget (10%)*: High-intent burnt orange (`#EA580C`) for organization actions and electric indigo/emerald (`#4F46E5` / `#16A34A`) for Service Provider system state indicators.
  - **Typography & Hierarchy**:
    - Display & Navigation: `Plus Jakarta Sans` (600/700 weight, tight tracking).
    - Body & Controls: `Plus Jakarta Sans` / `DM Sans` (400/500 weight) for high scannability.
    - Telemetry, Quotas & Metrics: Monospace tabular numerals (`font-mono tabular-nums`) so all seat counts, storage metrics, and KPI percentages align vertically.
  - **Component Styling & Layout**:
    - Strict adherence to the **3-Zone Top Bar Contract** (Brand Wordmark — Concise Single-Line Navigation — Primary Action).
    - **Zero-Pill Metadata Discipline**: Tenant metadata (sector, code, seat ratio, last activity) is rendered as clean inline text with middle-dot (`·`) separators rather than cluttered badge sandwiches.
    - **Single-Elevation Depth**: Flat containers with hairline borders and generous whitespace rather than nested cards within cards.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Dedicated Owner Session & Master Passkey Verification**
  - *Chosen Approach*: Authenticate the System Owner via a dedicated backend-verified Master Passkey / Secret PIN (defaulting to a clear owner passkey such as `SYS-OWNER-2026` and PIN `999999`, customizable in the System Dashboard) stored in a dedicated provider session state.
  - *Why*: Completely decouples the SaaS Service Provider identity from individual client organization employee lists, ensuring you can always access the Main System Control Dashboard even if an organization's database is empty or suspended.
  - *Alternatives Considered*: Reusing a tenant employee account—rejected because tenant admins belong to a specific organization, whereas the platform owner governs all organizations from above.

- **Decision 2: Real-Time Enforcement of Per-Organization Capabilities & Quotas**
  - *Chosen Approach*: Store a `servicePlan` and `capabilities` configuration directly on each `Organization` record (persisted across the Express backend, IndexedDB, and Firestore) and enforce it dynamically in the Sidebar navigation, routes, and employee/branch creation handlers.
  - *Why*: Toggling a module or changing a seat quota in the Main System Dashboard immediately updates what that organization's users can see and do in real time via WebSocket broadcast.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Component Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                      SIMPLIFIED DUAL-GATEWAY PORTAL                          │
│  ┌────────────────────────────────────┐  ┌────────────────────────────────┐  │
│  │     ORGANIZATION PORTAL LOGIN      │  │  MAIN SYSTEM DASHBOARD LOGIN   │  │
│  │  • Select Active Organization      │  │  • Owner / Developer Gateway   │  │
│  │  • Username/Password, PIN, Google  │  │  • Master Passkey / Secret PIN │  │
│  └─────────────────┬──────────────────┘  └────────────────┬───────────────┘  │
└────────────────────┼──────────────────────────────────────┼──────────────────┘
                     │                                      │
                     ▼                                      ▼
┌───────────────────────────────────────┐  ┌───────────────────────────────────┐
│     TENANT ORGANIZATION WORKSPACE     │  │   MAIN SYSTEM CONTROL DASHBOARD   │
│  • Enforces Org Status (Active/Susp.) │  │  • Create / Suspend Organizations │
│  • Filters Nav & Routes by Enabled    │  │  • Toggle Module Capabilities     │
│    Organization Capabilities          │  │  • Set Seat & Branch Quotas       │
│  • Enforces Seat & Branch Quotas      │  │  • Provision Organization Admins  │
│  • Balanced Scorecard, KPIs, Backlogs │  │  • Cross-Org Usage & KPI Metrics  │
└────────────────────┬──────────────────┘  └────────────────┬──────────────────┘
                     │                                      │
                     └──────────────────┬───────────────────┘
                                        ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│            UNIFIED BACKEND ENGINE (Express API + WebSocket + DB)             │
│  • /api/system-provider/auth      (Verify & rotate Master Passkey / PIN)     │
│  • /api/system-provider/overview  (Cross-org usage, storage & KPI telemetry) │
│  • /api/system-provider/org-config(Update capabilities, quotas, status)      │
│  • Real-time WebSocket broadcast of tenant status & capability updates       │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Data Model & State Enhancements

- **Organization Service-Provider Extensions**:
  - `serviceStatus`: `'Active' | 'Suspended' | 'Trial'` (suspended organizations block standard tenant login with a clear service notice).
  - `planTier`: `'Starter' | 'Enterprise' | 'Custom Service Plan'`.
  - `quotas`: `{ maxEmployees: number; maxBranches: number; maxStorageMb: number }`.
  - `capabilities`:
    - `kpiScorecard`: boolean (Core Balanced Scorecard & KPI tracking)
    - `periodicPlans`: boolean (Monthly/Quarterly Periodic Plans)
    - `backlogEngine`: boolean (Automated Backlog & Shortfall Recovery)
    - `employeeEvaluations`: boolean (360° Appraisals & Approvals)
    - `customerFeedback`: boolean (Public & Internal Customer Feedback)
    - `reportsAndExports`: boolean (Analytics Reports & CSV/JSON Exports)
    - `lanAndSnapshots`: boolean (Multi-Device LAN Sync & Point-in-Time Snapshots)

### Interactive Component & State Mapping

- **Simplified Portal Gateway**:
  - Switching between organizations updates the Organization Login context immediately; if an organization is marked `Suspended` by the system owner, the login card displays a service suspension notice and prevents standard user sign-in.
  - Entering the System Owner Passkey or Secret PIN authenticates against `/api/system-provider/auth`, sets the active `isSystemOwnerAuthenticated` session, and routes directly to `/system-dashboard`.
- **Main System Control Dashboard (`/system-dashboard`)**:
  - **Organization Provisioning Modal / Drawer**: Creates the organization, seeds its initial HQ branch and default fiscal configuration, sets initial quotas/capabilities, and optionally provisions its initial HQ Admin user in one atomic operation.
  - **Live Capability Toggles**: Clicking any capability switch immediately persists to the server and broadcasts the updated organization profile so connected tenant sessions dynamically show or hide the corresponding sidebar items and routes.
  - **Quota & Admin Management**: Updating seat or branch quotas immediately enforces limits when tenant admins attempt to add new employees or branches; clicking **"Assign / Reset Org Admin"** creates or updates the tenant's primary admin credentials.
  - **Workspace Impersonation ("Launch Org Workspace")**: Allows the platform owner to jump directly into any client organization's operational dashboard with full Super Admin context and a top bar button to return to the Main System Control Dashboard at any time.
