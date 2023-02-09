import {
    collection,
    getDocs,
    limit,
    orderBy,
    query,
    startAfter,
  } from 'firebase/firestore';
  import { db } from '../Firebase';

  const STRIDE = 3;

  export function getIQParams_Reports(forumDocRefId: string) {
    return {
      queryKey: ['reports', forumDocRefId],
      queryFn: async ({ pageParam = undefined }) => {
        return getDocs(
          query(
            collection(db, 'reports'),
            ...[
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
