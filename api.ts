/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { auth, db } from './Firebase';
import { doc, setDoc } from 'firebase/firestore';
import { User } from './types/types';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { UserStatus } from './types/common';

export async function createUser(
  email: string,
  password: string,
  username: string
) {
  await createUserWithEmailAndPassword(auth, email, password);

  if (auth.currentUser === null)
    return Promise.reject('Failed to authenticate');

  await setDoc(doc(db, 'users', auth.currentUser!.uid), {
    username: username,
    email: email,
    bio: "I'm a new climber!",
    status: UserStatus.Unverified,
  });
}

export async function getCurrentUser() {
  if (auth.currentUser === null)
    return Promise.reject('Failed to authenticate');
  const res = new User(doc(db, 'users', auth.currentUser!.uid));
  if (
    auth.currentUser.emailVerified &&
    (await res.getStatus()) === UserStatus.Unverified
  ) {
    await setDoc(res.docRef!, { status: UserStatus.Verified }, { merge: true });
    return new User(doc(db, 'users', auth.currentUser!.uid));
  } else return res;
}

export function getUserById(id: string) {
  return new User(doc(db, 'users', id));
}

export async function signIn(email: string, password: string) {
  await signInWithEmailAndPassword(auth, email, password);
}

export async function sendAuthEmail() {
  if (auth.currentUser != null) {
    if (auth.currentUser.emailVerified)
      console.log('Already verified, not sending email.');
    else
      sendEmailVerification(auth.currentUser).catch((error) => {
        console.log('Failed to send the email: ' + error.toString());
      });
  } else console.log('Not signed in!');
}
