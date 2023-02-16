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

export function getIQParams_Reports() {
  return {
    queryKey: ['reports', 'AAAAAAAAAAAAAAAAHHHHHHHHHHHH'], // 2nd param doesn't matter here bc no parent collection for reports
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
