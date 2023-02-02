import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
} from 'firebase/firestore';
import { db } from '../Firebase';

const STRIDE = 3;

export function getIQParams_UserPosts(userDocRefId: string) {
  return {
    queryKey: ['posts', userDocRefId],
    queryFn: async ({ pageParam = undefined }) => {
      if (pageParam) {
        const first = query(
          collection(db, 'posts'),
          where('author', '==', doc(db, 'users', userDocRefId)),
          orderBy('timestamp', 'desc'),
          startAfter(pageParam),
          limit(STRIDE)
        );
        return getDocs(first).then((snap) => snap.docs);
      } else {
        const first = query(
          collection(db, 'posts'),
          where('author', '==', doc(db, 'users', userDocRefId)),
          orderBy('timestamp', 'desc'),
          limit(STRIDE)
        );
        return getDocs(first).then((snap) => snap.docs);
      }
    },
    getNextPageParam: (lastPage: any) => {
      if (lastPage.length < STRIDE) return undefined;
      else return lastPage[lastPage.length - 1];
    },
  };
}
