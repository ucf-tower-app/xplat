/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  UserCredential,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import {
  DocumentReference,
  Transaction,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { auth, db } from '../Firebase';
import { SubstringMatcher, User, UserStatus } from '../types';

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
 * Check whether a displayname is 5-30 lower or upper a-z characters plus spaces and hyphens, with no leading or trailing spaces
 * @param displayname
 */
export function validDisplayname(displayname: string): boolean {
  return displayname.match('^[a-zA-Z][a-zA-Z -]{3,28}[a-zA-Z]$') !== null;
}

/** validBio
 * Check whether a bio is lequal 200 characters
 * @param bio
 */
export function validBio(bio: string): boolean {
  return bio.length <= 200;
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

        transaction.update(cacheDocRef, {
          allUsers: arrayUnion({
            username: username,
            displayName: displayName,
            ref: newDocRef,
          }),
        });
        transaction.set(newDocRef, {
          username: username,
          email: email,
          displayName: displayName,
          bio: "I'm a new climber!",
          status: UserStatus.Unverified,
          createdOn: serverTimestamp(),
        });
        return new User(newDocRef);
      });
    }
  );
}

/** getCurrentUser
 * Get the current auth user, and return the corresponding Tower User
 * @returns The corresponding Tower User object
 * @throws If the user is not signed in
 */
export async function getCurrentUser() {
  if (auth.currentUser === null)
    return Promise.reject('Failed to authenticate');
  return new User(doc(db, 'users', auth.currentUser.uid));
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
  const q = await getDocs(
    query(collection(db, 'users'), where('username', '==', username), limit(1))
  );
  if (q.size === 0) return undefined;
  const res = new User(q.docs[0].ref);
  res.initWithDocumentData(q.docs[0].data());
  return res;
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
export const startWaitForVerificationPoll = (
  notifyVerified: (user: User) => any
) => {
  if (auth.currentUser === null) return null;
  if (auth.currentUser.email === null) return null;

  if (!auth.currentUser!.emailVerified) {
    timer(2500).then(() => {
      auth
        .currentUser!.reload()
        .then(() => startWaitForVerificationPoll(notifyVerified));
    });
  } else {
    runTransaction(db, async (transaction) => {
      const res = new User(doc(db, 'users', auth.currentUser!.uid));
      await res.updateWithTransaction(transaction);
      res.verifyEmailWithinTransaction(auth.currentUser!.email!, transaction);
      return res;
    }).then(notifyVerified);
  }
};

interface UserSearchResult {
  username: string;
  displayName: string;
  user: User;
}
export async function getUserSubstringMatcher() {
  const spread = new Map<string, UserSearchResult[]>();
  (await getDoc(doc(db, 'caches', 'users')))
    .data()!
    .allUsers.forEach(
      (obj: {
        username: string;
        displayName: string;
        ref: DocumentReference;
      }) => {
        const res: UserSearchResult = {
          username: obj.username,
          displayName: obj.displayName,
          user: new User(obj.ref),
        };
        if (!spread.has(obj.username)) spread.set(obj.username, []);
        if (!spread.has(obj.displayName)) spread.set(obj.displayName, []);
        spread.get(obj.username)?.push(res);
        spread.get(obj.displayName)?.push(res);
      }
    );

  return new SubstringMatcher(spread);
}

// To uncomment if the cache changes and it needs to be reset. there's a lot of users and it's a pain to do manually.
// export async function __INTERNAL__resetUserCache() {
//   const usersCursor = new QueryCursor(User, 5, collection(db, 'users'));
//   const newMap = (await usersCursor.________getAll_CLOWNTOWN_LOTS_OF_READS())
//     .map((user) => {
//       if (user)
//         return {
//           username: user.username!,
//           displayName: user.displayName ?? user.username!,
//           ref: user.docRef!,
//         };
//     })
//     .filter((obj: any | undefined) => obj !== undefined);
//   return setDoc(doc(db, 'caches', 'users'), { allUsers: newMap });
// }
