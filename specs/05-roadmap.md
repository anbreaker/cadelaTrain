# 05 — Roadmap

Dela arrives in December 2026. Order inside phase 1 follows the arrival date, not the story number. Status as of 2026-11-12: the app is in production at `dela.rootdevs.es`, private to one household.

## Phase 1 — MVP for Dela (before arrival)

| Order | Work | Done when | Status |
|-------|------|-----------|--------|
| 0 | Scaffold: Angular 22 + Vite + Transloco + Vitest + ESLint/Prettier copied from framedBySanti; Firebase project (`europe-southwest1`); Vercel project; PWA installable | `npm test`, `npm run build` pass; app installs on Android/iOS; deployed preview | Done |
| 1 | H1 Household and puppy + rules tests | Both trainers in one household; Dela registered | Done |
| 2 | Bundled catalogs typed in `domain/catalog.ts` + i18n completeness test | Every catalog key has `en`, `es` and `pt` text | Done |
| 3 | H6 template path | Every day has guidance without AI | Done on the client (AC2.4); the on-demand endpoint moved to the AI phase |
| 4 | H2 Today (client template) + H3 Log | Daily use from arrival day | Done |
| 4b | H7 Photos (Cloudinary) and YouTube videos | Optional media per day, shown in progress and weekly review | Done |
| 6 | H4 Progress, H5 Weekly | During weeks 1–3 after arrival | Done |

## Phase 1b — AI guidance (planned, not scheduled)

| Work | Done when |
|------|-----------|
| H6 AI path: `api/_generate-daily-guidance.ts`, on-demand `POST /api/daily-guidance`, Vercel Cron, `firebase-admin`, Claude (`specs/04-guidance-engine.md`, `prompts/daily-guidance.md`) | Guidance at 06:00 Madrid with the template as fallback; cost per day known |

For one household the client template covers the daily plan; this phase makes sense before going public or when the guidance should adapt to the logs.

Deferred from phase 1 to start using the app sooner:

- AC3.7 health flag from log notes (per-locale term lists and the `health.consultVet` / `health.vetEmergency` banner after saving).

## Phase 2 — Multi-household and public onboarding

- Onboarding for any household: breed and size (small/medium/large affects session load and socialization), urban environment, indoor sleeping.
- Breed catalog; size-aware plan variants; urban socialization set (traffic, lifts, public transport).
- Per-household `timezone` (`Europe/Lisbon` for Portugal), hourly cron on Vercel Pro.
- Engine fan-out per dog (queue) instead of one sequential cron run.
- Account deletion and data export (GDPR); privacy policy; terms.
- Cost guardrails per household (one AI call per dog per day, monitored).

## Phase 3 — More features

- Push notifications (web push) for session reminders and the daily guidance.
- Authenticated (signed) photo delivery; video upload without YouTube.
- Offline mode: Firestore persistent cache + queued writes; service worker strategy reviewed.

## Phase 4 — More languages

- Castilian Spanish (`es`), European Portuguese (`pt`) and US English (`en`) ship in the MVP; other languages only on demand.

## Phase 5 — Beyond 4 months

- Plans for 4–6 months and adolescence (6–18 months).
- Possible freemium: free template plan; paid AI personalization and multi-dog households.
