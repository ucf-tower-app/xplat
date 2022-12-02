/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Forum, Post, User } from '../types/types';
import { db, storage } from '../Firebase';
import {
  arrayUnion,
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  Transaction,
} from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';

export function getPostById(postId: string) {
  return new Post(doc(db, 'posts', postId));
}

export async function createPost(
  author: User,
  textContent: string,
  forum: Forum,
  imageContent: Blob | undefined = undefined
) {
  const newPostDocRef = doc(collection(db, 'posts'));
  if (imageContent) {
    const imageRef = ref(storage, 'posts' + newPostDocRef.id);
    await uploadBytes(imageRef, imageContent);
  }

  return runTransaction(db, async (transaction: Transaction) => {
    transaction.update(forum.docRef!, { posts: arrayUnion(newPostDocRef) });
    transaction.update(author.docRef!, { posts: arrayUnion(newPostDocRef) });
    transaction.set(newPostDocRef, {
      author: author.docRef!,
      timestamp: serverTimestamp(),
      textContent: textContent,
      ...(imageContent && { imageContent: 'posts' + newPostDocRef.id }),
    });
    return new Post(newPostDocRef);
  });
}
