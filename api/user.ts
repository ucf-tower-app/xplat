/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  UserCredential,
} from 'firebase/auth';
import { doc, getDoc, runTransaction, Transaction } from 'firebase/firestore';
import { auth, db } from '../Firebase';
import { User, UserStatus } from '../types/types';

export function isKnightsEmail(email: string): boolean {
  return email.endsWith('@knights.ucf.edu') || email.endsWith('@ucf.edu');
}

export async function createUser(
  email: string,
  password: string,
  username: string,
  displayName: string
) {
  return createUserWithEmailAndPassword(auth, email, password).then(
    (cred: UserCredential) => {
      return runTransaction(db, async (transaction: Transaction) => {
        const newDocRef = doc(db, 'users', cred.user.uid);
        const cacheDocRef = doc(db, 'caches', 'users');

        const map = (await transaction.get(cacheDocRef)).data()!
          .usernameToUserID;
        map[username] = cred.user.uid;

        transaction.update(cacheDocRef, { usernameToUserID: map });
        transaction.set(newDocRef, {
          username: username,
          email: email,
          displayName: displayName,
          bio: "I'm a new climber!",
          status: UserStatus.Unverified,
        });
      });
    }
  );
}

export async function getCurrentUser() {
  if (auth.currentUser === null)
    return Promise.reject('Failed to authenticate');
  const res = new User(doc(db, 'users', auth.currentUser!.uid));
  if (
    auth.currentUser.emailVerified &&
    (await res.getStatus()) === UserStatus.Unverified &&
    isKnightsEmail(await res.getEmail())
  ) {
    return runTransaction(db, async (transaction) => {
      transaction.update(res.docRef!, {
        status: UserStatus.Verified,
      });
    }).then(() => new User(doc(db, 'users', auth.currentUser!.uid)));
  } else return res;
}

export function getUserById(id: string) {
  return new User(doc(db, 'users', id));
}

export async function getUserByUsername(username: string) {
  return getDoc(doc(db, 'caches', 'users'))
    .then((snap) => {
      const map = snap.get('usernameToUserID');
      if (map[username]) return getUserById(map[username]);
      else return undefined;
    })
    .catch(() => undefined);
}

export async function signIn(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function sendAuthEmail() {
  if (auth.currentUser != null) {
    if (auth.currentUser.emailVerified)
      return Promise.reject('Already verified!');
    else return sendEmailVerification(auth.currentUser);
  } else return Promise.reject('Not signed in!');
}

// Because the authstate doesnt change when an email verification happens, we have to poll for it :/
const timer = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
// eslint-disable-next-line @typescript-eslint/ban-types
export const startWaitForVerificationPoll = (notifyVerified: Function) => {
  if (auth.currentUser === null) return null;
  if (!auth.currentUser!.emailVerified) {
    timer(2500).then(() => {
      auth.currentUser!.reload();
      startWaitForVerificationPoll(notifyVerified);
    });
  } else {
    notifyVerified();
  }
};
