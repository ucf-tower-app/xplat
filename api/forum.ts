import { Forum } from '../types/types';
import { db } from '../Firebase';
import { doc } from 'firebase/firestore';

/** getForumById
 * Returns a Firebase Forum corresponding to the document ID provided
 * @param id: The Forum's firebase ID
 * @remarks The returned Forum is not guaranteed to have data in firebase.
 * This will result in subsequent getData() calls to throw.
 * @returns A Firebase Forum
 */
export function getForumById(forumId: string) {
  return new Forum(doc(db, 'forums', forumId));
}
