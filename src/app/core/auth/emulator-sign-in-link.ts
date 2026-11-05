import { InjectionToken } from '@angular/core';

import {
  appUsesEmulators,
  AUTH_EMULATOR_PORT,
  EMULATOR_HOST,
  EMULATOR_PROJECT_ID,
} from '@core/firebase/firebase-client';
import { normalizeEmail } from '@domain/email';

/**
 * The Auth emulator sends no email: it keeps every sign-in link and lists them on this endpoint.
 * Development only; production builds never call it.
 */
const OOB_CODES_URL = `http://${EMULATOR_HOST}:${AUTH_EMULATOR_PORT}/emulator/v1/projects/${EMULATOR_PROJECT_ID}/oobCodes`;

const EMAIL_SIGN_IN = 'EMAIL_SIGNIN';

export type FetchJson = (url: string) => Promise<unknown>;

/** Opens the newest emulator sign-in link for an email; resolves `false` when there is none. */
export interface EmulatorSignIn {
  openLatest(email: string): Promise<boolean>;
}

interface OobCode {
  email: string;
  oobLink: string;
  requestType: string;
}

const isOobCode = (value: unknown): value is OobCode =>
  typeof value === 'object' &&
  value !== null &&
  'email' in value &&
  'oobLink' in value &&
  'requestType' in value &&
  typeof value.email === 'string' &&
  typeof value.oobLink === 'string';

const oobCodesOf = (answer: unknown): OobCode[] =>
  typeof answer === 'object' &&
  answer !== null &&
  'oobCodes' in answer &&
  Array.isArray(answer.oobCodes)
    ? answer.oobCodes.filter(isOobCode)
    : [];

/** The newest sign-in link the emulator holds for `email`, or `null`. */
export async function latestEmulatorSignInLink(
  email: string,
  fetchJson: FetchJson
): Promise<null | string> {
  const target = normalizeEmail(email);
  const links = oobCodesOf(await fetchJson(OOB_CODES_URL))
    .filter((code) => code.requestType === EMAIL_SIGN_IN && normalizeEmail(code.email) === target)
    .map((code) => code.oobLink);
  return links.at(-1) ?? null;
}

export function createEmulatorSignIn(
  fetchJson: FetchJson,
  open: (url: string) => void
): EmulatorSignIn {
  return {
    openLatest: async (email): Promise<boolean> => {
      const link = await latestEmulatorSignInLink(email, fetchJson);
      if (link) open(link);
      return link !== null;
    },
  };
}

const fetchJson: FetchJson = async (url) => (await fetch(url)).json();

/** `null` outside the emulators, so the sign-in screen only offers the shortcut in development. */
export const EMULATOR_SIGN_IN = new InjectionToken<EmulatorSignIn | null>('EMULATOR_SIGN_IN', {
  factory: (): EmulatorSignIn | null =>
    appUsesEmulators() ? createEmulatorSignIn(fetchJson, (url) => location.assign(url)) : null,
  providedIn: 'root',
});
