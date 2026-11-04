# 00 — Vision

A family opens the app in the morning and knows exactly what to do with their puppy today, in short sessions, with positive methods; whoever trains logs it in seconds, and the whole family sees progress.

## Problem

- Puppy training advice is scattered, generic and often contradictory (or aversive).
- Between 8 and 16 weeks the socialization window closes; families miss it because nobody tracks what is pending.
- When two or more people train, they use different words and nobody knows what the other did.

## Users

| User | Need |
|------|------|
| Household member (trainer) | Today's tasks by time slot; log in one tap with who and when |
| Household owner | Create the household, invite people, register the puppy |
| Later: public users (Spain, Portugal; UI in Castilian Spanish and European Portuguese) | Same flow for any breed, size, urban or rural, indoor or outdoor sleeping |

## First case: Dela

Labrador, arrives December 2026 at 8 weeks, rural Extremadura near the Alentejo border, sleeps outdoors, two trainers. The MVP must be usable **before she arrives**.

## Product principles

1. **Positive reinforcement only.** Rewards, short sessions, end on success, lower difficulty when it does not work.
2. **Never a vet substitute.** Health topics only produce the fixed phrases `health.consultVet` or `health.vetEmergency`.
3. **Short and doable.** Sessions of 3–5 minutes, 4–5 per day for 2–4 month puppies.
4. **One shared vocabulary.** Same cue words for everyone in the household: the dog's name, come, sit, down, stay, leave it, no, good (spoken words per locale in `catalog.skills.*.cue` and `catalog.cues.*`).
5. **Deterministic core, AI on top.** Plan progression and safety are enforced by code; the AI personalizes wording and selection. If the AI fails, the template plan still works.
6. **Private by design.** Household data never leaks to another household.

## Success for the MVP

- Every day from Dela's arrival, guidance exists by 07:00 Madrid time.
- Both trainers log at least 4 sessions a day without friction (≤ 3 taps per log).
- The socialization checklist is complete before 16 weeks of age.

## Non-goals (MVP)

- Veterinary advice, dosing, diagnosis.
- Social features, public profiles, marketplace.
- Native apps (PWA only), push notifications, offline-first sync (see roadmap).
- Plans beyond 16 weeks.
