/** Public build-time variables (prefix `NG_APP_`, read from `.env.local` or the host). */
interface ImportMetaEnv {
  /** Cloudinary cloud name for photos; empty hides the photo option (videos still work). */
  readonly NG_APP_CLOUDINARY_CLOUD_NAME?: string;
  readonly NG_APP_FIREBASE_API_KEY?: string;
  readonly NG_APP_FIREBASE_APP_ID?: string;
  readonly NG_APP_FIREBASE_AUTH_DOMAIN?: string;
  readonly NG_APP_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly NG_APP_FIREBASE_PROJECT_ID?: string;
  readonly NG_APP_FIREBASE_STORAGE_BUCKET?: string;
  /** `'true'` connects Auth and Firestore to the local emulators (`firebase.json`). */
  readonly NG_APP_USE_EMULATORS?: string;
}
