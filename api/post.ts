/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Forum, Post, User } from '../types/types';
import { db } from '../Firebase';
import {
  arrayUnion,
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  Transaction,
} from 'firebase/firestore';

export function getPostById(postId: string) {
  return new Post(doc(db, 'posts', postId));
}

// TODO: Static content
export async function createPost(
  author: User,
  textContent: string,
  forum: Forum
) {
  return runTransaction(db, async (transaction: Transaction) => {
    const newPostDocRef = doc(collection(db, 'posts'));
    transaction.update(forum.docRef!, { posts: arrayUnion(newPostDocRef) });
    transaction.update(author.docRef!, { posts: arrayUnion(newPostDocRef) });
    transaction.set(newPostDocRef, {
      author: author.docRef!,
      timestamp: serverTimestamp(),
      textContent: textContent,
    });
    return new Post(newPostDocRef);
  });
}
