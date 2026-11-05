import { createEmulatorSignIn, latestEmulatorSignInLink } from './emulator-sign-in-link';

const OOB_CODES_URL = 'http://127.0.0.1:9099/emulator/v1/projects/demo-dela/oobCodes';

const code = (email: string, oobLink: string, requestType = 'EMAIL_SIGNIN'): object => ({
  email,
  oobCode: 'code',
  oobLink,
  requestType,
});

describe('latestEmulatorSignInLink', () => {
  it('should ask the Auth emulator for its pending codes', async () => {
    const fetchJson = vi.fn(async () => ({ oobCodes: [] }));

    await latestEmulatorSignInLink('ana@example.com', fetchJson);

    expect(fetchJson).toHaveBeenCalledWith(OOB_CODES_URL);
  });

  it('should return the newest sign-in link for that email, ignoring other emails and types', async () => {
    const fetchJson = vi.fn(async () => ({
      oobCodes: [
        code('ana@example.com', 'link-old'),
        code('jess@example.com', 'link-jess'),
        code('ana@example.com', 'link-new'),
        code('ana@example.com', 'link-verify', 'VERIFY_EMAIL'),
      ],
    }));

    expect(await latestEmulatorSignInLink('Ana@Example.com ', fetchJson)).toBe('link-new');
  });

  it('should return null when the emulator has no link for that email', async () => {
    const fetchJson = vi.fn(async () => ({ oobCodes: [code('jess@example.com', 'link-jess')] }));

    expect(await latestEmulatorSignInLink('ana@example.com', fetchJson)).toBeNull();
  });

  it('should return null when the answer is not the expected shape', async () => {
    const fetchJson = vi.fn(async () => ({ unexpected: true }));

    expect(await latestEmulatorSignInLink('ana@example.com', fetchJson)).toBeNull();
  });
});

describe('createEmulatorSignIn', () => {
  it('should open the newest link and report it found one', async () => {
    const open = vi.fn();
    const signIn = createEmulatorSignIn(
      async () => ({
        oobCodes: [code('ana@example.com', 'link-new')],
      }),
      open
    );

    expect(await signIn.openLatest('ana@example.com')).toBe(true);
    expect(open).toHaveBeenCalledWith('link-new');
  });

  it('should open nothing when there is no link', async () => {
    const open = vi.fn();
    const signIn = createEmulatorSignIn(async () => ({ oobCodes: [] }), open);

    expect(await signIn.openLatest('ana@example.com')).toBe(false);
    expect(open).not.toHaveBeenCalled();
  });
});
