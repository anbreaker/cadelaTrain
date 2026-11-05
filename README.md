# 🐾 Dela

<p align="center">
  <b>Angular 22 · Signals · Firebase · Vercel · Claude API</b><br/>
  <i>Mobile-first PWA to raise a puppy with positive training and a shared family log</i>
</p>

---

<p align="center">
  <img src="https://img.shields.io/badge/Angular-22-red?logo=angular" />
  <img src="https://img.shields.io/badge/TypeScript-6.0-blue?logo=typescript" />
  <img src="https://img.shields.io/badge/Vite-8-purple?logo=vite" />
  <img src="https://img.shields.io/badge/Firebase-Auth%20%7C%20Firestore-orange?logo=firebase" />
  <img src="https://img.shields.io/badge/PWA-installable-green" />
  <img src="https://img.shields.io/badge/i18n-EN%20%7C%20ES%20%7C%20PT-orange" />
</p>

<p align="center">
  <a href="https://github.com/Gentleman-Programming/gentle-ai">
    <img width="220" src="https://raw.githubusercontent.com/Gentleman-Programming/gentle-ai/main/docs/assets/brand/built-with-gentle-ai.png" alt="Built with Gentle-AI" />
  </a>
</p>

---

Dela (code name of **cadelaTrain**) helps a family educate their puppy: AI-generated daily guidance with short positive sessions, a training log shared by everyone who trains, socialization tracking and weekly progress. The first real case is Dela, a Labrador puppy arriving in December 2026 at a farm in Extremadura (Spain). Trilingual: Castilian Spanish (default), European Portuguese and US English. Dark mode by default.

## 🇬🇧 English

### 🧭 Overview

> Status: MVP in progress. H1 (sign-up, household, invitations, puppy) is being built; daily guidance, logging, progress and media follow.

- **Daily guidance**: every morning at 06:00 (Madrid time) the app plans the day by time slot from the 8-week plan and the last days' logs. Rules live in code (never move on below 8/10, lower the difficulty when a skill goes badly, one new socialization a day, end every session on something the puppy knows); Claude only writes the day; a template is the fallback.
- **Shared log**: every completed task records who did it and when; training logs successes out of 10, socialization logs the reaction.
- **Progress**: success rate per skill, socialization checklist before 16 weeks, weekly review with weight and notes.
- **Photos and videos** (optional, per day): photos on Cloudinary, videos as unlisted YouTube links.
- **Safety first**: positive reinforcement only; the app never gives veterinary doses or treatments, it only says "talk to your vet" or "veterinary emergency".
- **Private by design**: all data belongs to a household; Firestore security rules keep households apart.

### 🤖 How this project is built

Developed with AI coding agents using Organic-Driven Development with [gentle-ai](https://github.com/Gentleman-Programming/gentle-ai) and [Engram](https://github.com/Gentleman-Programming/engram) as persistent memory. Small changes stay light, substantial work gets a tracked task list (`odd/`, not versioned), and a human reviews and merges every pull request. Product reference lives in `specs/`.

### 🧱 Stack

- Angular 22 (standalone, `OnPush`, signals, zoneless), TypeScript 6 strict
- Vite 8 + `@analogjs/vite-plugin-angular`, native CSS (BEM, mobile-first), View Transitions
- Transloco 8 (`es`, `pt`, `en`)
- Firebase Auth (email link, Google) and Firestore (`europe-southwest1`), security rules tested on the emulator
- Vercel hosting, Vercel Functions in `api/`, Vercel Cron
- Claude API (server side only) for the daily guidance
- `@angular/service-worker` (installable PWA)
- Vitest 4 + JSDOM, ESLint 10, Prettier 3

### 📜 Scripts

```bash
npm install
npm run dev          # emulators + app, http://localhost:4200
npm run emulators    # Firebase Auth + Firestore emulators (demo project)
npm test             # unit tests
npm run test:rules   # security rules + data layer against the emulator (needs Java)
npm run lint
npm run build        # production build + service worker check
```

`npm run dev` needs no configuration: without Firebase config the development build uses the local emulators. Requirements: Node.js `>= 22.19.0`, npm `>= 10.9.3`, Java for the emulators.

### 🌿 Branching and commits

Gitflow: `main` (production), `develop` (integration), `feature/*`, `fix/*`, `chore/*`. Conventional Commits, description up to 50 characters, imperative mood.

---

## 🇪🇸 Español

### 🧭 Resumen

> Estado: MVP en construcción. Se está construyendo H1 (registro, hogar, invitaciones y cachorro); después llegan las pautas diarias, el registro, el progreso y las fotos y vídeos.

- **Pautas diarias**: cada mañana a las 6:00 (hora de Madrid) la app planifica el día por franjas a partir del plan de 8 semanas y de los registros de los últimos días. Las reglas están en el código (no se avanza por debajo de 8 de 10, se baja la dificultad si una habilidad va mal, una socialización nueva al día, cada sesión termina con algo que ya sabe); Claude solo redacta el día y, si falla, se usa una plantilla.
- **Registro compartido**: cada tarea hecha guarda quién la hizo y cuándo; en los entrenos, aciertos de cada 10; en la socialización, la reacción.
- **Progreso**: tasa de acierto por habilidad, checklist de socialización antes de las 16 semanas y registro semanal con peso y notas.
- **Fotos y vídeos** (opcionales, por día): fotos en Cloudinary y vídeos como enlaces ocultos de YouTube.
- **Seguridad ante todo**: solo educación en positivo; la app nunca da dosis ni tratamientos veterinarios, solo dice «consulta a tu veterinario» o «urgencia veterinaria».
- **Privada por diseño**: todos los datos pertenecen a un hogar y las reglas de Firestore los mantienen separados.

### 🤖 Cómo se construye este proyecto

Se desarrolla con agentes de IA siguiendo Organic-Driven Development con [gentle-ai](https://github.com/Gentleman-Programming/gentle-ai) y [Engram](https://github.com/Gentleman-Programming/engram) como memoria persistente. Los cambios pequeños se hacen directamente, el trabajo grande lleva una lista de tareas (`odd/`, no versionada) y una persona revisa y fusiona cada pull request. La referencia de producto está en `specs/`.

### 🧱 Stack

- Angular 22 (standalone, `OnPush`, signals, zoneless), TypeScript 6 estricto
- Vite 8 + `@analogjs/vite-plugin-angular`, CSS nativo (BEM, mobile-first), View Transitions
- Transloco 8 (`es`, `pt`, `en`)
- Firebase Auth (enlace por email, Google) y Firestore (`europe-southwest1`), reglas de seguridad probadas en el emulador
- Vercel (hosting, Functions en `api/`, Cron)
- API de Claude (solo en el servidor) para las pautas diarias
- `@angular/service-worker` (PWA instalable)
- Vitest 4 + JSDOM, ESLint 10, Prettier 3

### 📜 Scripts

```bash
npm install
npm run dev          # emulators + app, http://localhost:4200
npm run emulators    # emuladores de Firebase Auth + Firestore (proyecto demo)
npm test             # tests unitarios
npm run test:rules   # reglas de seguridad y capa de datos contra el emulador (necesita Java)
npm run lint
npm run build        # build de producción + comprobación del service worker
```

`npm run dev` no necesita configuración: sin configuración de Firebase, la versión de desarrollo usa los emuladores locales. Requisitos: Node.js `>= 22.19.0`, npm `>= 10.9.3` y Java para los emuladores.

### 🌿 Ramas y commits

Gitflow: `main` (producción), `develop` (integración), `feature/*`, `fix/*`, `chore/*`. Conventional Commits, descripción de 50 caracteres como máximo, en imperativo.

---

## 🇵🇹 Português

### 🧭 Resumo

> Estado: MVP em construção. Está a ser construído o H1 (registo, casa, convites e cachorro); seguem-se as orientações diárias, o registo de treinos, o progresso e as fotos e vídeos.

- **Orientações diárias**: todas as manhãs às 6:00 (hora de Madrid) a app planeia o dia por períodos a partir do plano de 8 semanas e dos registos dos últimos dias. As regras estão no código (não se avança abaixo de 8 em 10, baixa-se a dificuldade quando uma competência corre mal, uma socialização nova por dia, cada sessão termina com algo que o cachorro já sabe); o Claude só redige o dia e, se falhar, usa-se um modelo.
- **Registo partilhado**: cada tarefa feita guarda quem a fez e quando; nos treinos, acertos em cada 10; na socialização, a reação.
- **Progresso**: taxa de acerto por competência, lista de socialização antes das 16 semanas e revisão semanal com peso e notas.
- **Fotos e vídeos** (opcionais, por dia): fotos no Cloudinary e vídeos como ligações não listadas do YouTube.
- **Segurança primeiro**: só reforço positivo; a app nunca dá doses nem tratamentos veterinários, apenas diz «consulta o teu veterinário» ou «urgência veterinária».
- **Privada por conceção**: todos os dados pertencem a uma casa e as regras do Firestore mantêm-nas separadas.

### 🤖 Como este projeto é construído

Desenvolvido com agentes de IA segundo Organic-Driven Development com [gentle-ai](https://github.com/Gentleman-Programming/gentle-ai) e [Engram](https://github.com/Gentleman-Programming/engram) como memória persistente. As alterações pequenas fazem-se diretamente, o trabalho maior tem uma lista de tarefas (`odd/`, não versionada) e uma pessoa revê e integra cada _pull request_. A referência de produto está em `specs/`.

### 🧱 _Stack_

- Angular 22 (standalone, `OnPush`, signals, zoneless), TypeScript 6 estrito
- Vite 8 + `@analogjs/vite-plugin-angular`, CSS nativo (BEM, mobile-first), View Transitions
- Transloco 8 (`es`, `pt`, `en`)
- Firebase Auth (ligação por email, Google) e Firestore (`europe-southwest1`), regras de segurança testadas no emulador
- Vercel (alojamento, Functions em `api/`, Cron)
- API do Claude (só no servidor) para as orientações diárias
- `@angular/service-worker` (PWA instalável)
- Vitest 4 + JSDOM, ESLint 10, Prettier 3

### 📜 _Scripts_

```bash
npm install
npm run dev          # emulators + app, http://localhost:4200
npm run emulators    # emuladores do Firebase Auth + Firestore (projeto demo)
npm test             # testes unitários
npm run test:rules   # regras de segurança e camada de dados contra o emulador (precisa de Java)
npm run lint
npm run build        # build de produção + verificação do service worker
```

`npm run dev` não precisa de configuração: sem configuração do Firebase, a versão de desenvolvimento usa os emuladores locais. Requisitos: Node.js `>= 22.19.0`, npm `>= 10.9.3` e Java para os emuladores.

### 🌿 Ramos e _commits_

Gitflow: `main` (produção), `develop` (integração), `feature/*`, `fix/*`, `chore/*`. Conventional Commits, descrição com 50 caracteres no máximo, no imperativo.
