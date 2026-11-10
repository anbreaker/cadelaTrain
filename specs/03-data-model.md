# 03 — Data model (Firestore)

Firestore replaces the relational proposal of the original brief. Every user document lives **under** its household, so isolation is a path property enforced by `firestore.rules`. Catalogs are not in Firestore: they are bundled JSON (see the end of this file).

## Tree

```
allowedEmails/{email}                         who may use the app (id = lowercased email), console-only
users/{uid}                                   profile
households/{hid}                              name, locale, ownerId, memberIds[], members{}
  invitations/{email}                         pending invites (id = lowercased email)
  dogs/{dogId}                                puppy
    dailyGuidance/{YYYY-MM-DD}                guidance of a Madrid date, tasks embedded
    taskLogs/{logId}                          one per completion of a task
    socializationLogs/{logId}                 one per socialization exposure
    weightLogs/{logId}
    vetEvents/{eventId}                       appointments and notes, no dosing
    weeklyReviews/{weekNumber}                week since arrival (1, 2, …)
    media/{mediaId}                           optional photos (Cloudinary) and videos (YouTube) per day
```

Mapping from the original proposal: `household_members` → `households.memberIds` + `members` map; `guidance_tasks` → array `tasks` inside `dailyGuidance` (≤ 15 per day, always read together); `profiles` → `users`; `skills`, `plan_weeks`, `socialization_items` → bundled catalogs.

## Enums

| Name | Values |
|------|--------|
| `Locale` | `es` (Castilian Spanish, `es-ES`), `pt` (European Portuguese, `pt-PT`), `en` (US English, `en-US`) |
| `Role` | `owner`, `member` |
| `Environment` | `rural`, `urban` |
| `Slot` | `morning`, `midday`, `afternoon`, `night` |
| `TaskKind` | `training`, `socialization`, `care`, `feeding`, `potty` |
| `Reaction` | `calm`, `curious`, `fear` |
| `GuidanceSource` | `ai`, `template` |
| `GuidanceStatus` | `ready`, `fallback` (template used after an AI failure; `fallbackReason` set) |
| `FallbackReason` | `apiError`, `timeout`, `refusal`, `invalidOutput`, `noApiKey` |
| `SkillKey` | `name`, `search`, `sit`, `come`, `leash`, `softBite`, `down`, `leaveIt`, `stay`, `potty` |
| `SocializationCategory` | `people`, `noises`, `animals`, `places`, `handling` |

## Documents

Timestamps are Firestore `Timestamp` set with `serverTimestamp()` (rules check `== request.time`). Dates without time (`birthDate`, guidance id) are `YYYY-MM-DD` strings in Madrid time.

### `users/{uid}`
| Field | Type | Notes |
|-------|------|-------|
| displayName | string 1–60 | |
| email | string | from auth, lowercased |
| locale | `Locale` | UI language of this user |
| createdAt | timestamp | |

### `households/{hid}`
| Field | Type | Notes |
|-------|------|-------|
| name | string 1–60 | |
| locale | `Locale` | language of generated guidance |
| ownerId | uid | creator |
| memberIds | uid[] | ≤ 10; used by rules and `array-contains` queries |
| members | map uid → `{ role, displayName }` | display without extra reads |
| timezone | string | `Europe/Madrid` in MVP |
| createdAt | timestamp | |

### `households/{hid}/invitations/{email}`
| Field | Type | Notes |
|-------|------|-------|
| email | string | = doc id, lowercased |
| householdName | string 1–60 | shown to the invitee before joining (they cannot read the household yet) |
| invitedBy | uid | owner |
| createdAt | timestamp | |

Deleted when accepted (by the joining user) or revoked (by the owner).

### `dogs/{dogId}`
| Field | Type | Notes |
|-------|------|-------|
| name | string 1–40 | |
| breed | string 0–60 | free text in MVP |
| birthDate | `YYYY-MM-DD` | not in the future (checked in domain) |
| arrivalDate | `YYYY-MM-DD` | ≥ birthDate |
| sleepsOutdoors | bool | |
| environment | `Environment` | |
| notes | string ≤ 1000 | |
| planWeek | int 1–8 | starts at 1; advanced by `planWeekFor` when Today opens (see `04-guidance-engine.md`); rules allow only the same week or the next one |
| createdAt, updatedAt | timestamp | |

### `dailyGuidance/{YYYY-MM-DD}` (server-written only)
| Field | Type | Notes |
|-------|------|-------|
| date | `YYYY-MM-DD` | = doc id |
| locale | `Locale` | household locale at generation time; texts are stored resolved in it |
| summary | string ≤ 600 | |
| planWeek | int | week used for this day |
| ageWeeks | int | |
| source | `GuidanceSource` | |
| status | `GuidanceStatus` | |
| fallbackReason | `FallbackReason`? | |
| model | string? | `CLAUDE_MODEL` value when `source = ai` |
| healthFlag | `vet` \| `urgent` \| null | from recent notes; UI shows only the fixed banner |
| tasks | `GuidanceTask[]` | see below |
| createdAt | timestamp | |

`GuidanceTask`: `id` (stable string, e.g. `t1`), `slot`, `kind`, `skillKey?` (required when `kind = training`), `socializationItemKey?` (required when `kind = socialization`), `title` (≤ 80), `instructions` (≤ 400), `durationMin` (int 0–30; ≤ 5 for `training` while age ≤ 16 weeks), `closingSkillKey?` (training only, a skill she already knows), `order` (int).

### `taskLogs/{logId}`
| Field | Type | Notes |
|-------|------|-------|
| guidanceDate | `YYYY-MM-DD` | |
| taskId | string | id inside the guidance |
| kind | `TaskKind` | copied for queries |
| skillKey | `SkillKey`? | copied for progress queries |
| successCount | int 0–20? | training only, ≤ attempts |
| attempts | int 1–20? | training only |
| reaction | `Reaction`? | socialization only |
| notes | string ≤ 1000 | |
| doneBy | uid | `== request.auth.uid` |
| doneAt | timestamp | `== request.time` |

### `socializationLogs/{logId}`
`itemKey`, `reaction`, `notes`, `doneBy`, `doneAt`, `taskLogId?` (when it came from a guidance task). A socialization task completion writes both logs in one batch, and the socialization log reuses the task log id, so editing or deleting one updates the other in the same batch.

### `weightLogs/{logId}`
`kg` (number 0.5–100), `measuredOn` (`YYYY-MM-DD`), `doneBy`, `doneAt`.

### `vetEvents/{eventId}`
`kind` (`checkup` | `vaccine` | `deworming` | `microchip` | `other`), `date`, `notes` ≤ 1000, `doneBy`, `doneAt`. Free text only; the app never suggests products or doses.

### `weeklyReviews/{weekNumber}`
`weekNumber`, `notes` ≤ 2000, `weightKg?`, `updatedBy`, `updatedAt`. "Does well", "struggles" and "new socialization" are computed from logs, not stored.

### `media/{mediaId}`
| Field | Type | Notes |
|-------|------|-------|
| kind | `photo` \| `video` | |
| date | `YYYY-MM-DD` | Madrid date the item belongs to |
| caption | string ≤ 280 | optional |
| skillKey | `SkillKey`? | optional |
| publicId | string? | `photo` only: Cloudinary public id under `dela/<householdId>/` |
| width, height | int? | `photo` only, for layout without shift |
| youtubeId | string? | `video` only, `^[A-Za-z0-9_-]{11}$` |
| addedBy | uid | `== request.auth.uid` |
| addedAt | timestamp | `== request.time` |

## Indexes

| Collection (group) | Fields | Used by |
|--------------------|--------|---------|
| `taskLogs` | `skillKey` asc, `doneAt` desc | progress per skill, engine success rate |
| `taskLogs` | `guidanceDate` asc, `doneAt` asc | today's done marks |
| `socializationLogs` | `itemKey` asc, `doneAt` desc | checklist last reaction |
| `invitations` (collection group) | `email` asc | pending invitations of the signed-in user |
| `media` | `date` desc, `addedAt` desc | timeline and weekly review |

## Security rules summary

Full rules in `firestore.rules`; tested with the emulator.

**Access allowlist.** The app is private to one household. "Signed in" in every rule below means: authenticated, email verified, and an `allowedEmails/{lowercased email}` document exists. Allowlist documents are created in the Firebase console (the emails are never in the repository); a client may only `get` its own entry, to learn whether it has access. Removing an entry revokes access on the next request.

| Path | Read | Write |
|------|------|-------|
| `allowedEmails/{email}` | own entry only (`get`) | none (console only) |
| `users/{uid}` | self | self, shape-validated |
| `households/{hid}` | members | create: creator is sole owner/member; update: owner renames, changes the locale or removes members (never the owner; cannot add uids or add, relabel or rewrite member entries) or invited user adding exactly themself |
| `invitations/{email}` | owner; invitee (collection group by email) | create/delete: owner; delete: invitee |
| `dogs/**` | members | create/delete: owner; update: members, shape-validated; `planWeek` only unchanged or `+ 1` (≤ 8), never skipped or lowered |
| `dailyGuidance` | members | none (server only) |
| `*Logs`, `vetEvents` | members | create: members with `doneBy == uid`, `doneAt == request.time`; update/delete: author, within 24 h of `doneAt` |
| `weeklyReviews` | members | members, `updatedBy == uid` |
| `media` | members | create: members, `addedBy == uid`, `addedAt == request.time`, exactly the fields of its `kind`; update: author, caption only; delete: author |
| anything else | denied | denied |

## Bundled catalogs (`seed/`)

Static JSON imported by the app (`domain/catalog.ts`) and by `api/`. Each file declares `i18nPrefix` and `i18nFields`; the UI text of field `f` of item `k` is the Transloco key `<i18nPrefix>.<k>.<f>` (plan weeks use `week<N>` as key). The English text in the seed is the canonical description used by the engine and by developers, never shown in the UI.

| File | Content | Item fields |
|------|---------|-------------|
| `skills.json` | 10 skills | `key`, `description`, `howTo` (trainer guide: `setup`, `steps[]`, `levelUp`, `troubleshoot`, `mistakes`); i18n `name`, `cue`, `description`, `howTo.{setup, step1..stepN, levelUp, troubleshoot, mistakes}` |
| `plan-weeks.json` | 8 weeks | `week`, `ageWeeks`, `objective`, `how`, `readyWhen`, `keySkills`, `focusSkills` |
| `daily-schedule.json` | Daily template for 2–4 months | `id`, `time`, `until?`, `slot`, `kind`, `skillKey?`, `isTask`, `durationMin`, `title`; rows with `isTask: false` are rest blocks shown in the timeline, never tasks |
| `socialization-checklist.json` | 35 items in 5 categories | `key`, `category`, `order`, `label`; i18n `label`, `howTo` |
| `care-alerts.json` | Seasonal and field risks | `key`, `months`, `arrivalWeek?`, `appliesTo { sleepsOutdoors?, environment? }`, `severity` (`info` \| `vet` \| `urgent`), `message` |
| `principles.json` | Training principles | `key`, `text` |
| `preparation-checklist.json` | 11 things to have ready before the arrival (AC2.5) | `key`, `order`, `label`, `optional?`, `hint?`; i18n `label`, `hint` |

A unit test asserts that every catalog key exists in `en.json`, `es.json` and `pt.json`, and that the three files have the same key set.
