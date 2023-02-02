// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getReactNativePersistence } from "firebase/auth/react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"

import { firebaseConfig } from './.firebase_config';

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Set up auth persistence on react-native
if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') {
  initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  })
}

export const db = getFirestore(app);
export const auth = getAuth();
export const storage = getStorage();

export const DEFAULT_AVATAR_PATH = 'avatars/climber.png';
