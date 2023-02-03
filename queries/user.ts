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
      return getDocs(
        query(
          collection(db, 'posts'),
          ...[
            where('author', '==', doc(db, 'users', userDocRefId)),
            orderBy('timestamp', 'desc'),
            ...(pageParam !== undefined ? [startAfter(pageParam)] : []),
            limit(STRIDE),
          ]
        )
      ).then((snap) => snap.docs);
    },
    getNextPageParam: (lastPage: any) => {
      if (lastPage.length < STRIDE) return undefined;
      else return lastPage[lastPage.length - 1];
    },
  };
}
