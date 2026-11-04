# 05 — Roadmap

Today is 2026-11-04 and Dela arrives in December 2026: about four weeks for phase 1. Order inside phase 1 follows the arrival date, not the story number.

## Phase 1 — MVP for Dela (before arrival)

| Order | Work | Done when |
|-------|------|-----------|
| 0 | Scaffold: Angular 22 + Vite + Transloco + Vitest + ESLint/Prettier copied from framedBySanti; Firebase project (`europe-southwest1`); Vercel project; PWA installable | `npm test`, `npm run build` pass; app installs on Android/iOS; deployed preview |
| 1 | H1 Household and puppy + rules tests | Both trainers in one household; Dela registered |
| 2 | Bundled catalogs typed in `domain/catalog.ts` + i18n completeness test | Every catalog key has `es` and `pt` text |
| 3 | H6 template path + on-demand endpoint | Every day has guidance without AI |
| 4 | H2 Today + H3 Log | Daily use from arrival day |
| 4b | H7 Photos (Cloudinary) and YouTube videos | Optional media per day, shown in progress and weekly review |
| 5 | H6 AI path + cron | Guidance at 06:00 Madrid with fallback |
| 6 | H4 Progress, H5 Weekly | During weeks 1–3 after arrival |

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

## Phase 4 — Languages

- English: `en.json` with every key; engine output in English for households with locale `en`.
- Banned-term and health-term lists for English.

Castilian Spanish (`es`) and European Portuguese (`pt`) ship in the MVP.

## Phase 5 — Beyond 4 months

- Plans for 4–6 months and adolescence (6–18 months).
- Possible freemium: free template plan; paid AI personalization and multi-dog households.
