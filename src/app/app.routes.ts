import { Routes } from '@angular/router';

import { landingGuard, sessionRoute } from '@core/session/session-routes';

/**
 * Each screen declares the session statuses it is for; the guard and the session redirect send
 * everyone else to the screen of their status (`specs/02-architecture.md`, Auth and session).
 */
export const routes: Routes = [
  { canActivate: [landingGuard], children: [], path: '', pathMatch: 'full' },
  {
    ...sessionRoute(['signedOut']),
    loadComponent: () =>
      import('@features/auth/login/login.page').then((m) => m.LoginPageComponent),
    path: 'login',
    title: 'Dela',
  },
  {
    ...sessionRoute(['needsHousehold']),
    loadComponent: () =>
      import('@features/household/invitations/invitations.page').then(
        (m) => m.InvitationsPageComponent
      ),
    path: 'invitations',
    title: 'Dela',
  },
  {
    ...sessionRoute(['needsHousehold']),
    loadComponent: () =>
      import('@features/household/create-household/create-household.page').then(
        (m) => m.CreateHouseholdPageComponent
      ),
    path: 'household/new',
    title: 'Dela',
  },
  {
    ...sessionRoute(['needsDog']),
    loadComponent: () =>
      import('@features/dog/register-dog/register-dog.page').then(
        (m) => m.RegisterDogPageComponent
      ),
    path: 'dog/new',
    title: 'Dela',
  },
  {
    children: [
      {
        ...sessionRoute(['ready']),
        loadComponent: () => import('@features/today/today.page').then((m) => m.TodayPageComponent),
        path: 'today',
        title: 'Dela',
      },
      {
        ...sessionRoute(['ready']),
        loadComponent: () =>
          import('@features/progress/progress.page').then((m) => m.ProgressPageComponent),
        path: 'progress',
        title: 'Dela',
      },
      {
        ...sessionRoute(['ready']),
        loadComponent: () => import('@features/plan/plan.page').then((m) => m.PlanPageComponent),
        path: 'plan',
        title: 'Dela',
      },
      {
        ...sessionRoute(['ready']),
        loadComponent: () => import('@features/rules/rules.page').then((m) => m.RulesPageComponent),
        path: 'rules',
        title: 'Dela',
      },
      {
        ...sessionRoute(['needsDog', 'ready']),
        loadComponent: () =>
          import('@features/household/household/household.page').then(
            (m) => m.HouseholdPageComponent
          ),
        path: 'household',
        title: 'Dela',
      },
    ],
    loadComponent: () => import('@features/shell/shell.layout').then((m) => m.ShellLayoutComponent),
    path: '',
  },
  { canActivate: [landingGuard], children: [], path: '**' },
];
