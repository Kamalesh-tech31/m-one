# Maatram One (M-one) — Student Lifecycle Platform

Frontend-only event-sourced prototype for **Maatram One** (**M-one**), built with React, Vite, TypeScript, Tailwind CSS, Zustand (`persist`), React Router, Recharts, TanStack Table, `react-hook-form` + Zod, Framer Motion, `lucide-react`, `date-fns`, and Vitest. All records use 100% synthetic demo data.

## How to Run

```bash
npm install
npm run dev      # Starts Vite dev server on http://localhost:3000
npm test         # Runs 9 Vitest unit tests (< 1s)
npm run build    # Production bundle
```

## Architecture Note (Transactional Guarantees)

All application state is derived from an append-only event log persisted in `localStorage` via Zustand (`state = events.reduce(applyEvent, initialState)`). In this frontend-only prototype, the **"same transaction"** guarantee between appending an event, updating derived state, and advancing the mock email worker bookmark/outbox is **simulated synchronously in browser memory** and requires a real ACID database transaction (with an outbox table) in production.

## Demo Credentials & 3-Minute Walkthrough

- **Admin OTP Gate**: Demo OTP is `123456` (shown as a hint on the Admin login gate). Every Admin decision logs the actor as `"Admin (OTP verified)"`.
- **Guided Demo**: Click **"Start 3-minute demo"** in the top bar (with step caption and **Skip** button) to auto-walk through:
  1. **Applicant**: 7-question form, 5 document categories (`10th Marksheet`, `12th Marksheet`, `Income Certificate`, `Address Proof`, `One House Photo`), alumni verifier progress (`Meera`, `Priya`), Address Verification Mode (`Online panel` / `Physical verification`), rejection reason display, and 48-hour join code on selection.
  2. **Anchor Workspace**: Redeem join code into the 15-scholar cohort, pin/unpin announcements (`Seen by X of 15`), approve/decline student meeting leave requests, answer 1-per-25 sampled data requests, and pay the configurable yearly renewal fee (default Rs 1,000) with receipt.
  3. **Student (`Arun K`, B.Tech IT, 4th semester)**: Verified volunteering counts synced from Volunteer Portal, locked `NGO teaching, coming soon` card, read-only auto-captured GPS location & timestamp for physical verification, 4 difficulty flag categories, and meeting leave requests with required proof.
  4. **Admin**: OTP-gated dashboard with Recharts YoY comparison (~12,000 applicants & 500–700 selected across 2024/2025/2026), Address Verification Mode assignment, 4 Sampled Request types, configurable Anchor fee, and Best Anchor leaderboard (Admin-verified work + student CGPA growth).
  5. **Event Log & Alumni**: TanStack Table stream with Replay from start/time/bookmark, duplicate/out-of-order simulation, deduplicated Email Outbox, and company name alias merging (`TCS`, `Tata Consultancy Services Pvt Ltd`, `CTS`).
