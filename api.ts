import { auth, db } from './Firebase.js';
import { doc } from 'firebase/firestore';
import { User, Send } from './types/types';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
} from 'firebase/auth';

export async function testConnection() {
  const docRef = doc(db, 'users', 'dummy');

  const user = new User(docRef);
  console.log(user);
  const send: Send = (await user.getSends())[0];
  await send.getAttempts();
  console.log(send);
}

export async function makeAuthUser(email: string, password: string) {
  createUserWithEmailAndPassword(auth, email, password)
    .then(() => {
      console.log('Made a guy!');
      console.log(auth.currentUser);
    })
    .catch((error) => {
      console.log('Failed');
      console.log(error);
    });
}

export async function signIn(email: string, password: string) {
  signInWithEmailAndPassword(auth, email, password);
}

export function getAuthUser() {
  return auth.currentUser;
}

export async function sendAuthEmail() {
  if (auth.currentUser != null) {
    if (auth.currentUser.emailVerified)
      console.log('Already verified, not sending email.');
    else
      sendEmailVerification(auth.currentUser)
        .then(() => {
          console.log('Email sent!');
        })
        .catch((error) => {
          console.log('Failed to send the email');
          console.log(error);
        });
  } else console.log('Not signed in!');
}

export async function getUserById(id: string) {
  return new User(doc(db, 'users', id));
}
