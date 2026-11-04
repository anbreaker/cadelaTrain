# 01 — MVP stories

Each story lists acceptance criteria (AC). UI copy is never written here: it is referenced by Transloco key (`slots.morning`, `health.consultVet`…) and lives in `public/assets/i18n/{es,pt}.json`. Supported locales: `es` (Castilian Spanish, default) and `pt` (European Portuguese).

| ID | Story | Depends on | Needed before arrival |
|----|-------|------------|-----------------------|
| H1 | Household and puppy | — | Yes |
| H2 | Today's guidance | H1, H6 (template path) | Yes |
| H3 | Log a task | H2 | Yes |
| H6 | Automatic guidance | H1 | Yes (template); AI can follow |
| H7 | Photos and videos | H1 | Yes |
| H4 | Progress | H3 | First weeks |
| H5 | Weekly review | H3 | First weeks |

---

## H1. Household and puppy

> As a family member, I sign up, create a household, invite another person by email and register the puppy.

- **AC1.1 Sign-up.** Given a visitor, when they enter their email, they receive a sign-in link (Firebase email link); Google sign-in is also offered. On first sign-in a `users/{uid}` profile is created with display name and the browser locale if supported (`es` or `pt`), else `es`.
- **AC1.2 Create household.** Given a signed-in user without a household, when they enter a household name and pick the household locale (`es` or `pt`), a household is created with them as `owner` and they are sent to the puppy registration screen.
- **AC1.3 Invite.** Given an owner, when they enter an email, an invitation is stored for that email and a sign-in link is sent to it. Inviting the same email twice does not duplicate it. Invalid emails show a validation error and nothing is stored.
- **AC1.4 Accept.** Given a person signed in with the invited (verified) email, when they open the app, they see the pending invitation with the household name and can join; after joining they are a `member` and see the household's puppy. A user with a different email cannot join (enforced by rules).
- **AC1.5 Register puppy.** Given a household, when the owner saves name, breed, birth date, arrival date, sleeps outdoors (yes/no) and environment (rural/urban), the dog is stored. Required: name, birth date, arrival date. Arrival date cannot be earlier than birth date; birth date cannot be in the future.
- **AC1.6 Isolation.** A user who is not a member gets permission denied reading or writing any document of that household (rules test).
- **AC1.7 Language.** Each user can switch the UI language between `es` and `pt`; the choice is stored in `users/{uid}.locale`. Generated guidance uses the household locale.

## H2. Today's guidance

> When I open the app I see today's tasks ordered by time slot.

- **AC2.1** Given guidance exists for the dog and today's Madrid date, the home screen shows tasks grouped by slot in this order: `morning`, `midday`, `afternoon`, `night` (labels `slots.*`); within a slot, by `order`.
- **AC2.2** Each task shows title, short instructions, duration (minutes, or a dash when none) and kind with icon and label (`taskKinds.*`).
- **AC2.3** Done tasks show who did them and when (display name and local time).
- **AC2.4** Given no guidance exists yet for today (cron delayed or failed), the app requests on-demand generation and shows a loading state; it never shows an empty day.
- **AC2.5** Given the dog has not arrived yet (today < arrival date), the screen shows a countdown and the preparation checklist instead of tasks.
- **AC2.6** The summary of the day is shown on top. If a health flag is active (see H3), a banner shows `health.consultVet` or `health.vetEmergency` and nothing else about health.

## H3. Log a task

> I mark a task as done and note the result.

- **AC3.1** Given a task, when I mark it done, a log is stored with `doneBy` = my uid and `doneAt` = server time.
- **AC3.2** Training tasks ask for successes out of attempts (successes 0–attempts; attempts default 10, editable 1–20).
- **AC3.3** Socialization tasks ask for the reaction: `calm`, `curious` or `fear` (labels `reactions.*`).
- **AC3.4** Every task allows optional free notes (≤ 1000 chars).
- **AC3.5** A task can be logged more than once (two trainers, repeated sessions); the task shows the latest log and the count.
- **AC3.6** A log can be edited or deleted only by its author, within 24 hours of `doneAt`.
- **AC3.7 Health flag.** If notes contain health terms (vomiting, limping, wound, processionary caterpillar…, matched per locale), the app shows the `health.consultVet` banner after saving. Urgent terms (processionary caterpillar, poison, seizure, not breathing, heavy bleeding) show `health.vetEmergency`. No other health text is shown.
- **AC3.8** A default training log takes ≤ 3 taps with one hand.

## H4. Progress

> I see success rate per skill over time and the socialization checklist.

- **AC4.1** Skills: `name`, `sit`, `come`, `leash`, `softBite`, `down`, `leaveIt`, `stay`, `potty` (labels `catalog.skills.<key>.name`).
- **AC4.2** For each skill: current rate (successes / attempts over the evaluation window defined in `specs/04-guidance-engine.md`), a daily trend chart and the number of sessions. Skills without data show an empty state.
- **AC4.3** A skill at ≥ 80 % over the evaluation window is marked as mastered.
- **AC4.4** Socialization checklist grouped by category (`people`, `noises`, `animals`, `places`, `handling`); each item shows done/pending, last reaction and who did it. Items whose last reaction is `fear` are highlighted to repeat at lower intensity.
- **AC4.5** A counter shows days left until 16 weeks of age and pending items.

## H5. Weekly review

> A per-week view with what she does well, what is hard, new socialization, weight and notes.

- **AC5.1** Weeks are numbered from arrival (week 1 = arrival day + 6 days); the view shows plan week, age in weeks and the objective.
- **AC5.2** Auto-filled: skills ≥ 80 % (does well), skills < 50 % with ≥ 10 attempts (struggles), socialization items first done that week.
- **AC5.3** Editable by any member: weight (kg, one per week; also stored as a weight log) and free notes. Last editor and time are stored.
- **AC5.4** Navigation to previous weeks; future weeks are not navigable.

## H6. Automatic guidance

> Every morning at 06:00 Madrid time, guidance is generated for each puppy.

- **AC6.1** Vercel Cron calls `api/cron-daily-guidance` at 04:00 and 05:00 UTC. The handler acts only when the Madrid local hour is ≥ 06 and guidance for that Madrid date does not exist yet. This covers CET (UTC+1) and CEST (UTC+2) without code changes on DST days.
- **AC6.2** Generation is idempotent: document id is the Madrid date (`YYYY-MM-DD`); re-runs never duplicate.
- **AC6.3** Only dogs with `arrivalDate ≤ today` and age ≤ 16 weeks (MVP plan range) get guidance.
- **AC6.4** If the Claude call fails, times out, refuses or the output fails validation, guidance is built from the plan template with `source: "template"`. The day always has guidance.
- **AC6.5** The cron endpoint rejects requests without `Authorization: Bearer ${CRON_SECRET}`.
- **AC6.6** An authenticated on-demand endpoint (`POST /api/daily-guidance`) generates today's guidance for one dog of the caller's household, with the same idempotency (used by AC2.4).
- **AC6.7** Each guidance stores `locale`, `model`, `source` (`ai` | `template`), `status` and `planWeek` for traceability.

## H7. Photos and videos

> As a household member, I can optionally add photos and YouTube videos to a day, to see progress over time.


- **AC7.1 Optional.** A day has zero or more media items; nothing else (logging, guidance) requires them.
- **AC7.2 Photo.** A member picks a photo from the camera or gallery (images only, ≤ 10 MB). It is uploaded straight to Cloudinary with a signature from `POST /api/sign-upload`, which only members of the household get; the app stores the Cloudinary public id, width and height.
- **AC7.3 Video.** A member pastes a YouTube link (`youtube.com/watch?v=`, `youtu.be/`, `youtube.com/shorts/`); the app extracts and stores only the 11-character video id. Any other text shows a validation error and nothing is stored. The form explains (Transloco key) that the video must be **unlisted**: YouTube does not play private videos embedded in other sites.
- **AC7.4 Fields.** Each item has a Madrid date (default today), an optional caption (≤ 280 chars), an optional skill (`SkillKey`), `addedBy` (uid) and `addedAt` (server time).
- **AC7.5 Viewing.** Media appear per day in the weekly review (H5) and as a timeline in progress (H4). Photos are delivered by Cloudinary in responsive sizes (`f_auto,q_auto`, srcset). Videos load as a facade: the thumbnail first, and the `youtube-nocookie.com` player only after a tap.
- **AC7.6 Delete.** The author deletes their own item; for a photo, `POST /api/delete-media` also removes the Cloudinary asset.
- **AC7.7 Privacy.** Only household members read media documents (rules). Photos live in a per-household Cloudinary folder with random public ids; delivery URLs are unguessable but public if shared (authenticated delivery is a roadmap item).
