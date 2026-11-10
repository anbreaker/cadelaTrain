# 01 — MVP stories

Each story lists acceptance criteria (AC). UI copy is never written here: it is referenced by Transloco key (`slots.morning`, `health.consultVet`…) and lives in `public/assets/i18n/{en,es,pt}.json`. Supported locales: `es` (Castilian Spanish, default), `pt` (European Portuguese) and `en` (US English).

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

- **AC1.1 Sign-up.** Given a visitor, they sign in with Google, the only sign-in method (the app is private to the family's Google accounts). On first sign-in a `users/{uid}` profile is created with display name and the browser locale if supported (`en`, `es` or `pt`), else `es`.
- **AC1.2 Create household.** Given a signed-in user without a household, when they enter a household name and pick the household locale (`en`, `es` or `pt`), a household is created with them as `owner` and they are sent to the puppy registration screen.
- **AC1.3 Invite.** Given an owner, when they enter an email, an invitation is stored for that email and the screen shows the app link with a **Share link** button: the device share sheet when there is one, else the link is copied to the clipboard; the link always stays visible. No email is sent: the invitee opens the link and signs in with Google using the invited email (which must also be in the allowlist). Inviting the same email twice does not duplicate it and offers the link again. Invalid emails show a validation error and nothing is stored.
- **AC1.4 Accept.** Given a person signed in with the invited (verified) email, when they open the app, they see the pending invitation with the household name and can join; after joining they are a `member` and see the household's puppy. A user with a different email cannot join (enforced by rules).
- **AC1.5 Register puppy.** Given a household, when the owner saves name, breed, birth date, arrival date, sleeps outdoors (yes/no) and environment (rural/urban), the dog is stored. Required: name, birth date, arrival date. Arrival date cannot be earlier than birth date; birth date cannot be in the future.
- **AC1.5b Change arrival.** Any member can change the arrival date from the household screen; the other details of the dog are saved unchanged and the same validation applies (valid date, not before the birth date).
- **AC1.6 Isolation.** A user who is not a member gets permission denied reading or writing any document of that household (rules test).
- **AC1.7 Language.** Each user can switch the UI language between `en`, `es` and `pt`; the choice is stored in `users/{uid}.locale`. Generated guidance uses the household locale.

## H2. Today's guidance

> When I open the app I see today's tasks ordered by time slot.

- **AC2.1** Given guidance exists for the dog and today's Madrid date, the home screen shows tasks grouped by slot in this order: `morning`, `midday`, `afternoon`, `night` (labels `slots.*`); within a slot, by `order`.
- **AC2.2** Each task shows title, short instructions, duration (minutes, or a dash when none) and kind with icon and label (`taskKinds.*`). A task linked to a skill (`skillKey`) or to a guide (`guideKey`: potty walks, socialization, handling, brushing, bedtime in the kennel) also has a collapsed **How to do it** guide, written as a trainer teaching trainers: before you start, numbered steps, when to make it harder, what to do if she does not get it, and common trainer mistakes. Meals, rests and care alerts have none. Positive reinforcement only.
- **AC2.3** Done tasks show who did them and when (display name and local time).
- **AC2.4** Given no guidance is stored for today (cron delayed or failed, or H6 not built yet), the app shows the template guidance built on the client from the bundled catalogs (`domain/template-guidance.ts`, in the active language); it never shows an empty day. On-demand generation (AC6.6) can replace it once H6 ships.
- **AC2.5** Given the dog has not arrived yet (today < arrival date), the screen shows a countdown and the preparation checklist (`seed/preparation-checklist.json`) instead of tasks, followed by a read-only preview of the plan's first day (the template guidance for the arrival date: week 1 summary and tasks by slot, without Done or Edit). On the arrival date it shows the day's tasks.
- **AC2.6** The summary of the day is shown on top. If the day's guidance carries a health flag, a banner shows `health.consultVet` or `health.vetEmergency` and nothing else about health.
- **AC2.7 Plan browser.** A read-only "Plan" screen (`/plan`) lists weeks 1–8 of `seed/plan-weeks.json`: age range, objective, how, ready when (`catalog.planWeeks.week<N>.*`) and the key skills with their cue words (`catalog.skills.<key>.{name,cue}`). Each week opens to a typical day: the template guidance for that week's first day (arrival date + 7 × (week − 1)), as task cards grouped by slot, without Done or Edit. The dog's current `planWeek` is highlighted and open.

## H3. Log a task

> I mark a task as done and note the result.

- **AC3.1** Given a task, when I mark it done, a log is stored with `doneBy` = my uid and `doneAt` = server time.
- **AC3.2** Training tasks ask for successes out of attempts (successes 0–attempts; attempts default 10, editable 1–20).
- **AC3.3** Socialization tasks ask for the reaction: `calm`, `curious` or `fear` (labels `reactions.*`).
- **AC3.4** Every task allows optional free notes (≤ 1000 chars).
- **AC3.5** A task can be logged more than once (two trainers, repeated sessions); the task shows the latest log and the count.
- **AC3.6** A log can be edited or deleted only by its author, within 24 hours of `doneAt`.
- **AC3.7 Health flag (deferred, see `05-roadmap.md`).** If notes contain health terms (vomiting, limping, wound, processionary caterpillar…, matched per locale), the app shows the `health.consultVet` banner after saving. Urgent terms (processionary caterpillar, poison, seizure, not breathing, heavy bleeding) show `health.vetEmergency`. No other health text is shown.
- **AC3.8** A default training log takes ≤ 3 taps with one hand.

- **AC3.9 Notes export.** From Household, any member downloads every task log and socialization log of the dog as one Markdown file (`dela-notes-YYYY-MM-DD.md`, Madrid date), grouped by day with who, what, result or reaction and the notes verbatim. It uses the member's own access, so the weekly training review needs no server credential. Notes can be typed or dictated with the phone keyboard's voice input.

## H4. Progress

> I see success rate per skill over time and the socialization checklist.

- **AC4.1** Skills: `name`, `search`, `sit`, `come`, `leash`, `softBite`, `down`, `leaveIt`, `stay`, `potty` (labels `catalog.skills.<key>.name`).
- **AC4.2** For each skill: current rate (successes / attempts over the evaluation window defined in `specs/04-guidance-engine.md`), a daily trend chart and the number of sessions. Skills without data show an empty state.
- **AC4.3** A skill at ≥ 80 % over the evaluation window is marked as mastered.
- **AC4.4** Socialization checklist grouped by category (`people`, `noises`, `animals`, `places`, `handling`); each item shows done/pending, last reaction and who did it. Items whose last reaction is `fear` are highlighted to repeat at lower intensity.
- **AC4.5** A counter shows days left until 16 weeks of age and pending items.

## H5. Weekly review

> A per-week view with what she does well, what is hard, new socialization, weight and notes.

- **AC5.1** Weeks are numbered from arrival (week 1 = arrival day + 6 days); the view shows plan week, age in weeks and the objective. Screen "Review" (`/weekly`, nav after Progress) opens on the current week. Before the arrival the current week is **week 0, before the arrival**: the preparation checklist (shared with Today), the arrival date, a link to the Plan screen and notes (no weight), saved as review week 0. The week in progress shows the stored plan week and today's age; a past week shows its age on its last day and a plan week replayed from the logs (`planWeekFor`, at most one advance per day, never above the stored week).
- **AC5.2** Auto-filled: skills ≥ 80 % (does well), skills < 50 % with ≥ 10 attempts (struggles), socialization items first done that week. Rates use the 7-day window ending on the week's last day (or today); "done" means met calm or curious, by Madrid date. `weeklySummary` in `src/app/domain/weekly-review.ts`.
- **AC5.3** Editable by any member: weight (kg, one per week; also stored as a weight log) and free notes. Last editor and time are stored. A weight log (`measuredOn` = the save date) is added in the same batch only when the weight differs from the stored one; an empty weight leaves `weightKg` out.
- **AC5.4** Navigation to previous weeks, down to week 0; future weeks are not navigable.

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
- **AC7.8 Where.** Today, once the puppy is home, has a "Photos and videos of the day" section (`TodayMediaComponent`) with an "Add" form (`app-media-form`: photo or video, date, caption, skill) and the day's items. The weekly review shows the week's items per day, newest day first, for weeks 1 and later (not week 0); progress shows every item from her birth to today as a timeline. Both are read-only except the author's delete.
- **AC7.9 Configuration.** The public `NG_APP_CLOUDINARY_CLOUD_NAME` names the Cloudinary cloud for upload and delivery. Without it the form offers only videos and explains that photos are not set up; videos keep working.
- **AC7.10 Public id check.** After the upload the app accepts the returned `public_id` only when it is exactly `dela/<householdId>/<id>` (the shape the rules accept); otherwise nothing is recorded and the form shows an error. Cloudinary accounts with dynamic folders need the upload preset option "use the asset folder as the public ID prefix".

## H8. Household rules

> Everyone who trains the puppy can look up the same words and rules at any time.

- **AC8.1 Shared words and principles.** A "Rules" screen (`/rules`) lists, read-only, the spoken cue word of every skill in the active language (`catalog.skills.<key>.cue`), the drop, praise, release and "no" words (`catalog.cues.*`; walking at your side is the leash cue «junto»), with no word used for two cues in any language, and the training principles (`seed/principles.json`).
- **AC8.2 Family rules (planned).** Members write and edit the household's own rules (who feeds her, where she sleeps, other agreements); stored per household and protected by the rules like other household data.
- **AC8.3 AI help (planned).** From `api/` only, Claude drafts family rules from a few answers; the household reviews and saves them. Uses the app's server key (`ANTHROPIC_API_KEY`), never a user's credentials in the client.
