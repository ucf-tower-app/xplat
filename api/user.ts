/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  UserCredential,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { Transaction, doc, getDoc, runTransaction } from 'firebase/firestore';
import { auth, db } from '../Firebase';
import { User, UserStatus } from '../types/types';

/** isKnightsEmail
 * Check if an email is a knights email
 * @param email: string, the email to check
 * @returns Whether or not the email is a knights email
 */
export function isKnightsEmail(email: string): boolean {
  return email.endsWith('@knights.ucf.edu') || email.endsWith('@ucf.edu');
}

/** validUsername
 * Check whether a username is 5-15 lowercase a-z characters
 * @param username
 */
export function validUsername(username: string): boolean {
  return username.match('^[a-z]{5,15}$') !== null;
}

/** validDisplayname
 * Check whether a username is 5-30 lower or upper a-z characters plus spaces, with no leading or trailing spaces
 * @param username
 */
export function validDisplayname(displayname: string): boolean {
  return displayname.match('^[a-zA-Z][a-zA-Z ]{3,28}[a-zA-Z]$') !== null;
}

/** createUser
 * Create an auth user and a firebase document for that user.
 * @param email: The new user's email
 * @param password: The new user's plaintext password
 * @param username: The new user's username
 * @param displayName: The new user's display name
 * @returns: The new Tower User
 * @throws if email already exists
 * @throws if password is invalid
 */
export async function createUser(
  email: string,
  password: string,
  username: string,
  displayName: string
) {
  if (!validUsername(username)) return Promise.reject('Invalid Username!');
  if (!validDisplayname(displayName))
    return Promise.reject('Invalid Display Name!');
  if (await getUserByUsername(username))
    return Promise.reject('Username taken');
  return createUserWithEmailAndPassword(auth, email, password).then(
    (cred: UserCredential) => {
      return runTransaction(db, async (transaction: Transaction) => {
        const newDocRef = doc(db, 'users', cred.user.uid);
        const cacheDocRef = doc(db, 'caches', 'users');

        const map = (await transaction.get(cacheDocRef)).data()!.usernameToUser;
        map[username] = newDocRef;

        transaction.update(cacheDocRef, { usernameToUser: map });
        transaction.set(newDocRef, {
          username: username,
          email: email,
          displayName: displayName,
          bio: "I'm a new climber!",
          status: UserStatus.Unverified,
        });
        return new User(newDocRef);
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
      const map = snap.get('usernameToUser');
      if (map[username]) return new User(map[username]);
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
