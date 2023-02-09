import { doc } from 'firebase/firestore';
import { db } from '../Firebase';
import { Send } from '../types';

/** getSendById
 * Returns a Firebase Send corresponding to the document ID provided
 * @param id: The Send's firebase ID
 * @remarks The returned Send is not guaranteed to have data in firebase.
 * This will result in subsequent getData() calls to throw.
 * @returns A Firebase Send
 */
export function getSendById(forumId: string) {
  return new Send(doc(db, 'sends', forumId));
}
