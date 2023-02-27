import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../Firebase';
import { RouteType, Send, User } from '../types';

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

export enum GetBestSendError {
  NoSuchSend = 'Failed to find a send for this user and type.',
}

export async function getBestSendByType(user: User, type: RouteType) {
  const q = await getDocs(
    query(
      collection(db, 'sends'),
      where('user', '==', user.docRef!),
      where('type', '==', type),
      orderBy('rawgrade', 'desc'),
      limit(1)
    )
  );
  if (q.size === 0) throw GetBestSendError.NoSuchSend;

  const res = new Send(q.docs[0].ref);
  res.initWithDocumentData(q.docs[0].data());
  return res;
}
