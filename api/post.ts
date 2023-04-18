/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  arrayUnion,
  collection,
  doc,
  increment,
  runTransaction,
  serverTimestamp,
  Transaction,
} from 'firebase/firestore';
import { ref, uploadBytesResumable, UploadTask } from 'firebase/storage';
import { db, MAX_USER_CONTENT_BYTES, storage } from '../Firebase';
import { Forum, Post, User } from '../types';

/** getPostById
 * Returns a Tower Post corresponding to the document ID provided
 * @param id: The Post's firebase ID
 * @remarks The returned Post is not guaranteed to have data in firebase.
 * This will result in subsequent getData() calls to throw.
 * @returns A Tower Post
 */
export function getPostById(postId: string) {
  return new Post(doc(db, 'posts', postId));
}

interface CreatePostArgs {
  author: User;
  textContent: string;
  forum?: Forum;
  imageContent?: Blob[];
  videoContent?: { video: Blob; thumbnail: Blob };
  routeInfo?: { name: string; grade: string };
  isSend: boolean;
}

export enum CreatePostError {
  TooLarge = 'This post exceeds your 75 Mb image/video storage limits. Unfortunately, we are an unfunded project and storage is expensive! Please delete some of your previous posts or use shorter videos or smaller images.',
}

/** createPost
 * Creates a post
 * @param author
 * @param textContent: The text content of the post
 * @param forum: Optional, the forum to which the post is made
 * @param imageContent: Optional, a list of Blobs that are images
 * @param routeName: Optional, the route's name if posting to a route
 * @param routeGrade: Optional, the route's grade display string, if posting to a route
 * @param isSend: If this is a stub post representing a send, defaults to false.
 * @returns The newly created Tower Post
 */
export async function createPost({
  author,
  textContent,
  forum = undefined,
  imageContent = undefined,
  videoContent = undefined,
  routeInfo = undefined,
  isSend = false,
}: CreatePostArgs) {
  await author.getData(true);
  var newPostSizeInBytes = 0;
  if (videoContent)
    newPostSizeInBytes += videoContent.thumbnail.size + videoContent.video.size;
  if (imageContent)
    newPostSizeInBytes += imageContent.reduce(
      (sum, item) => sum + item.size,
      0
    );
  if (
    (await author.getTotalPostSizeInBytes()) + newPostSizeInBytes >
    MAX_USER_CONTENT_BYTES
  ) {
    throw CreatePostError.TooLarge;
  }

  const newPostDocRef = doc(collection(db, 'posts'));
  const uploads: UploadTask[] = [];
  if (videoContent) {
    uploads.push(
      uploadBytesResumable(
        ref(storage, 'posts/videos/' + newPostDocRef.id + '_video'),
        videoContent.video
      )
    );
    uploads.push(
      uploadBytesResumable(
        ref(storage, 'posts/videos/' + newPostDocRef.id + '_thumbnail'),
        videoContent.thumbnail
      )
    );
  }
  if (imageContent) {
    imageContent.forEach((img, idx) =>
      uploads.push(
        uploadBytesResumable(
          ref(storage, 'posts/' + newPostDocRef.id + '_' + idx),
          img
        )
      )
    );
  }

  await Promise.all(uploads);

  return runTransaction(db, async (transaction: Transaction) => {
    if (forum)
      transaction.update(forum.docRef!, { posts: arrayUnion(newPostDocRef) });
    transaction.update(author.docRef!, {
      posts: arrayUnion(newPostDocRef),
      totalPostSizeInBytes: increment(newPostSizeInBytes),
    });
    transaction.set(newPostDocRef, {
      author: author.docRef!,
      timestamp: serverTimestamp(),
      textContent: textContent,
      ...(forum && { forum: forum.docRef }),
      ...(routeInfo && { routeInfo: routeInfo }),
      ...(isSend && { isSend: isSend }),
      ...(imageContent && {
        imageContent: imageContent!.map(
          (_, idx) => 'posts/' + newPostDocRef.id + '_' + idx
        ),
      }),
      ...(videoContent && { videoContent: 'posts/videos/' + newPostDocRef.id }),
    });
    return new Post(newPostDocRef);
  });
}
