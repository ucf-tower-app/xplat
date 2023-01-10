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
  forum: Forum | undefined = undefined,
  imageContent: Blob[] | undefined = undefined
) {
  const newPostDocRef = doc(collection(db, 'posts'));
  if (imageContent) {
    await Promise.all(
      imageContent!.map((img, idx) =>
        uploadBytes(ref(storage, 'posts/' + newPostDocRef.id + '_' + idx), img)
      )
    );
  }

  return runTransaction(db, async (transaction: Transaction) => {
    if (forum)
      transaction.update(forum.docRef!, { posts: arrayUnion(newPostDocRef) });
    transaction.update(author.docRef!, { posts: arrayUnion(newPostDocRef) });
    transaction.set(newPostDocRef, {
      author: author.docRef!,
      timestamp: serverTimestamp(),
      textContent: textContent,
      ...(forum && { forum: forum.docRef }),
      ...(imageContent && {
        imageContent: imageContent!.map(
          (_, idx) => 'posts/' + newPostDocRef.id + '_' + idx
        ),
      }),
    });
    return new Post(newPostDocRef);
  });
}
