/** Public Firebase web config. Empty values mean "not configured": the app cannot sign in. */
export interface FirebaseEnvironment {
  apiKey: string;
  appId: string;
  authDomain: string;
  messagingSenderId: string;
  projectId: string;
  storageBucket: string;
}

export interface Environment {
  env: 'development' | 'production';
  firebase: FirebaseEnvironment;
  production: boolean;
}
