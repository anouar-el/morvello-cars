# Security Specification: Morvello Cars Firestore Authorization & RBAC

## Executive Summary
This document defines the mathematical security specification, access boundaries, and adversarial threat model for Google Cloud Firestore in the Morvello Cars Rental Management Platform (Problem #5).

All access control is strictly enforced at the database level by Cloud Firestore Security Rules. No client-side state, React permissions, localStorage flags, or document ID string formats can grant access without cryptographic verification of `request.auth` and role-based policies.

---

## 1. Core Data Invariants

1. **Authentication Invariant (Zero-Trust Base)**:
   - No unauthenticated request (`request.auth == null`) shall read, write, update, or delete any operational document (`/agencies/*`, `/users/*`).
   - Catch-all default deny `match /{document=**} { allow read, write: if false; }` prevents any implicit exposure.

2. **Format-Is-Not-Auth Invariant**:
   - `isValidId(docId)` validates string format, regex `^[a-zA-Z0-9_\-]+$`, and length (`<= 128`).
   - Format validity is a necessary condition to prevent ID injection, but is never sufficient for authorization. `isSignedIn()` is mandatory on all protected paths.

3. **PII Isolation Invariant (`/users/{userId}`)**:
   - Non-admin users can ONLY read their own profile (`request.auth.uid == userId`).
   - Blanket reads (`allow read: if isSignedIn()`) are strictly forbidden on user profiles.

4. **Privilege Escalation Prevention Invariant**:
   - A regular user can never set `role = 'admin'` or `adminClaim = true` during profile creation.
   - A regular user can never modify their `role`, `adminClaim`, `agency`, or `permissions` during profile updates.
   - Non-admin updates to user profiles are strictly constrained to `affectedKeys().hasOnly(['name', 'phone', 'updatedAt'])`.

5. **Agency Boundary & Multi-Tenant Isolation Invariant (`/agencies/{agencyId}`)**:
   - Only authenticated team members belonging to the authorized agency (or verified administrators) can read agency fleet, contracts, clients, and deposits.
   - Users cannot access documents of an agency to which they are not assigned.

6. **Tiered Identity & Governance Invariant**:
   - **Tier 1 (Admin)**: Full administrative authority over agency settings (`companySettings`), contractual clauses (`termsVersion`), and system user rosters (`users`).
   - **Tier 2 (Manager/Agent)**: Operational modifications permitted ONLY on operational entities (`vehicles`, `contracts`, `clients`, `drivers`, `deposits`, `updatedAt`, `updatedBy`). Any attempt by non-admins to alter `companySettings`, `termsVersion`, or `users` is rejected.

7. **Immutability & Terminal Protection Invariant**:
   - Profile `uid` and `email` are immutable once established.
   - Agency documents cannot be deleted by non-admin users.

8. **Admin Identity Verification**:
   - Verified administrative identity requires cryptographic custom claims, an existing administrative role in `/users/$(request.auth.uid)`, or the bootstrapped verified administrator (`anouar7fac@gmail.com`) with `request.auth.token.email_verified == true`.
   - Spoofed email attacks with `email_verified == false` are immediately rejected.

---

## 2. The "Dirty Dozen" Adversarial Payloads

| ID | Attack Vector | Target Document | Payload / Operation | Expected Result | Reason |
|---|---|---|---|---|---|
| **D1** | Unauthenticated Read | `/agencies/morvello_main` | `GET` with `auth: null` | `PERMISSION_DENIED` | Anonymous client cannot read agency fleet or contracts. |
| **D2** | Unauthenticated Write | `/agencies/morvello_main` | `SET` with `auth: null`, `{ vehicles: [] }` | `PERMISSION_DENIED` | Anonymous write attempt rejected. |
| **D3** | Format-Only Bypass | `/agencies/morvello_main` | `SET` with valid regex ID but `auth: null` | `PERMISSION_DENIED` | Document ID format alone is not authentication. |
| **D4** | Self-Promotion at Creation | `/users/attacker_uid` | `CREATE` with `{ uid: 'attacker_uid', role: 'admin', adminClaim: true }` | `PERMISSION_DENIED` | Non-admin user attempting to register as 'admin'. |
| **D5** | Self-Promotion via Update | `/users/mgr_bob` | `UPDATE` with `{ role: 'admin' }` by `mgr_bob` | `PERMISSION_DENIED` | Manager cannot alter `role` field. |
| **D6** | Cross-User Profile Hijack | `/users/victim_uid` | `UPDATE` by `attacker_uid` | `PERMISSION_DENIED` | User cannot modify another user's profile document. |
| **D7** | Cross-User PII Harvesting | `/users/victim_uid` | `GET` by non-admin `attacker_uid` | `PERMISSION_DENIED` | Private profile and PII restricted to owner or admin. |
| **D8** | Email Spoofing Attack | `/agencies/morvello_main` | `UPDATE` by `email: anouar7fac@gmail.com` with `email_verified: false` | `PERMISSION_DENIED` | Admin identity via email strictly mandates `email_verified == true`. |
| **D9** | Cross-Agency Data Pollution | `/agencies/morvello_main` | `WRITE` by user belonging to `agency_external` | `PERMISSION_DENIED` | User cannot write to an unassigned agency. |
| **D10** | Manager Tampering Settings | `/agencies/morvello_main` | `UPDATE` with altered `companySettings` by `role: manager` | `PERMISSION_DENIED` | Only administrators can modify legal settings and terms. |
| **D11** | Unauthorized Agency Deletion| `/agencies/morvello_main` | `DELETE` by `role: manager` | `PERMISSION_DENIED` | Deletion restricted exclusively to administrators. |
| **D12** | ID Poisoning / Denial-of-Wallet | `/users/{poisoned_id}` | `SET` with 500-character junk ID or invalid characters | `PERMISSION_DENIED` | Document ID must satisfy `isValidId()` boundary rules. |

---

## 3. Test Runner Architecture
The complete test suite is implemented in `src/lib/firestoreRules.test.ts`. It executes unit evaluations simulating Firestore Security Rules against all 12 Dirty Dozen payloads as well as positive legitimate business workflows.
