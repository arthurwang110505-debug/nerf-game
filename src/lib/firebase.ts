/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
} from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  collection, 
  getDocFromServer 
} from "firebase/firestore";

// The hardcoded config provided by the user in the prompt
const fallbackFirebaseConfig = {
  apiKey: "AIzaSyCmlt9T3-C4sNYNutPIlcHRRo-Vzy8xkWI",
  authDomain: "nerf-game-3680c.firebaseapp.com",
  databaseURL: "https://nerf-game-3680c-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "nerf-game-3680c",
  storageBucket: "nerf-game-3680c.firebasestorage.app",
  messagingSenderId: "305130593236",
  appId: "1:305130593236:web:59db48f44ac3cc9e255441",
  measurementId: "G-2H6XW2HYZR"
};

// Detect dynamic global variables or fallback
export const appId = (window as any).__app_id || "nerf-tactical-game";
const activeConfig = (window as any).__firebase_config || fallbackFirebaseConfig;
const initialAuthToken = (window as any).__initial_auth_token;

// Initialize Firebase
const app = initializeApp(activeConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Authentication state initialization promise
let authReadyPromise: Promise<any> | null = null;

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
    },
    operationType,
    path,
  };
  console.error("Firestore Error Detailed: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Function to handle custom token or anonymous authentication
export async function initializeAuth(): Promise<any> {
  if (authReadyPromise) return authReadyPromise;

  authReadyPromise = new Promise(async (resolve, reject) => {
    // Wait for the auth object to verify current state first
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        unsubscribe();
        resolve(user);
      }
    });

    try {
      if (auth.currentUser) {
        unsubscribe();
        resolve(auth.currentUser);
        return;
      }

      if (initialAuthToken) {
        console.log("Authenticating with system initial custom token...");
        const userCredential = await signInWithCustomToken(auth, initialAuthToken);
        unsubscribe();
        resolve(userCredential.user);
      } else {
        console.log("Authenticating anonymously...");
        const userCredential = await signInAnonymously(auth);
        unsubscribe();
        resolve(userCredential.user);
      }
    } catch (err) {
      console.error("Authentication trigger failed:", err);
      // Fallback if token failed try anonymous
      try {
        const userCredential = await signInAnonymously(auth);
        unsubscribe();
        resolve(userCredential.user);
      } catch (innerErr) {
        unsubscribe();
        reject(innerErr);
      }
    }
  });

  return authReadyPromise;
}

// Validate database connection as requested in the instructions
export async function testDbConnection() {
  try {
    await initializeAuth();
    // Test check on public config or just a heartbeat
    await getDocFromServer(doc(db, "artifacts", appId, "public", "connection_test"));
    console.log("Firestore connection test completed.");
  } catch (error: any) {
    if (error instanceof Error && error.message.includes("offline")) {
      console.error("Please check your Firebase configuration or internet connection.", error);
    } else {
      console.warn("Firestore heartbeat note (this is expected if document doesn't exist yet):", error.message);
    }
  }
}
testDbConnection();
