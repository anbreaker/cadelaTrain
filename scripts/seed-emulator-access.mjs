/**
 * Local development only: writes the access allowlist (`allowedEmails/{email}`) into the Firestore
 * emulator, so a local sign-in with those emails works like production. Emails come from
 * `ALLOWED_EMAILS` (comma separated) in `.env` or the shell; they are never in the repository.
 * The emulator accepts `Bearer owner` as an admin token, which bypasses the security rules.
 */
const PROJECT_ID = 'demo-dela';
const host = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
const emails = (process.env.ALLOWED_EMAILS ?? '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

if (emails.length === 0) {
  console.warn(
    'seed-emulator-access: ALLOWED_EMAILS is empty; every local sign-in will be told it has no access.'
  );
  process.exit(0);
}

const base = `http://${host}/v1/projects/${PROJECT_ID}/databases/(default)/documents/allowedEmails`;
for (const email of emails) {
  const response = await fetch(`${base}/${encodeURIComponent(email)}`, {
    body: JSON.stringify({ fields: {} }),
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    method: 'PATCH',
  });
  if (!response.ok) {
    console.error(`seed-emulator-access: ${email} failed with ${response.status}`);
    process.exit(1);
  }
}
console.log(`seed-emulator-access: ${emails.length} email(s) allowed in the emulator.`);
