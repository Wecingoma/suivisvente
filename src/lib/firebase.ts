import { initializeApp, getApps, getApp } from "firebase/app"
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  connectAuthEmulator,
  getAuth,
  setPersistence,
} from "firebase/auth"
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore"

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

const auth = getAuth(app)
const db = getFirestore(app)
const googleProvider = new GoogleAuthProvider()
const emulatorState = globalThis as typeof globalThis & {
  __marcherVenteFirebaseEmulatorsConnected__?: boolean
}

googleProvider.setCustomParameters({
  prompt: "select_account",
})

void setPersistence(auth, browserLocalPersistence)

const useEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true"

if (useEmulators && !emulatorState.__marcherVenteFirebaseEmulatorsConnected__) {
  const [firestoreHost, firestorePortValue] = (
    import.meta.env.VITE_FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080"
  ).split(":")

  connectAuthEmulator(
    auth,
    import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL ?? "http://127.0.0.1:9099",
    { disableWarnings: true }
  )

  connectFirestoreEmulator(db, firestoreHost, Number(firestorePortValue))
  emulatorState.__marcherVenteFirebaseEmulatorsConnected__ = true
}

export { app, auth, db, googleProvider }
