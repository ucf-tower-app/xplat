// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

import { firebaseConfig } from './.firebase_config';

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth();
export const storage = getStorage();

export const DEFAULT_AVATAR_PATH = 'avatars/climber.png';
export const BOULDER_ROUTETYPE = 'Boulder';
export const TOPROPE_ROUTETYPE = 'Top-Rope';
export const TRAVERSE_ROUTETYPE = 'Traverse';
export const LEADCLIMB_ROUTETYPE = 'Lead-Climb';
