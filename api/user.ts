/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { auth, db } from '../Firebase';
import { doc, getDoc, runTransaction, Transaction } from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  UserCredential,
} from 'firebase/auth';
import { User, UserStatus } from '../types/types';

/** isKnightsEmail
 * Check if an email is a knights email
 * @param email: string, the email to check
 * @returns Whether or not the email is a knights email
 */
export function isKnightsEmail(email: string): boolean {
  return email.endsWith('@knights.ucf.edu') || email.endsWith('@ucf.edu');
}

/** createUser
 * Create an auth user and a firebase document for that user.
 * @param email: The new user's email
 * @param password: The new user's plaintext password
 * @param username: The new user's username
 * @param displayName: The new user's display name
 * @throws if email already exists
 * @throws if password is invalid
 */
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

/** getCurrentUser
 * Get the current auth user, and return the corresponding Tower User
 * @returns The corresponding Tower User object
 * @remarks If the User is marked as Unverified but meet the qualifications,
 * this function will update their status accordingly.
 * @throws If the user is not signed in
 */
export async function getCurrentUser() {
  if (auth.currentUser === null)
    return Promise.reject('Failed to authenticate');
  const res = new User(doc(db, 'users', auth.currentUser.uid));
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

/** getUserById
 * Returns a Firebase User corresponding to the document ID provided
 * @param id: The User's firebase ID
 * @remarks The returned User is not guaranteed to have data in firebase.
 * This will result in subsequent getData() calls to throw.
 * @returns A Firebase User
 */
export function getUserById(id: string) {
  return new User(doc(db, 'users', id));
}

/** getUserByUsername
 * Get a user by their username
 * @param username: The username to find
 * @returns A User, or undefined if no such user exists
 */
export async function getUserByUsername(username: string) {
  return getDoc(doc(db, 'caches', 'users'))
    .then((snap) => {
      const map = snap.get('usernameToUserID');
      if (map[username]) return getUserById(map[username]);
      else return undefined;
    })
    .catch(() => undefined);
}

/** signIn
 *  Sign into firebase auth
 * @param email
 * @param password
 * @returns The auth UserCredential
 * @throws if the email and password do not match
 */
export async function signIn(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

/** sendAuthEmail
 * Sends the verification email for the current signed in user
 * @throws if no auth user is signed in
 * @throws if the user has already verified their email
 */
export async function sendAuthEmail() {
  if (auth.currentUser != null) {
    if (auth.currentUser.emailVerified)
      return Promise.reject('Already verified!');
    else return sendEmailVerification(auth.currentUser);
  } else return Promise.reject('Not signed in!');
}
