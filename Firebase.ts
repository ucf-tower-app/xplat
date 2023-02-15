// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

import { firebaseConfig } from './.firebase_config';

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth();
export const storage = getStorage();
export const functions = getFunctions(app, 'us-central1');
export const functions_sendMail = httpsCallable(functions, 'sendMail');

export const DEFAULT_AVATAR_PATH = 'avatars/climber.png';
export const DEFAULT_BIO = "I'm a new climber!";
export const DEFAULT_DISPLAY_NAME = 'Tower Climber';
export const MAX_USER_CONTENT_BYTES = 75000000; // 75 Meg
