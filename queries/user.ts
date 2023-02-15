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
import { User } from '../types';

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

export function getIQParams_UserFollowers(userDocRefId: string) {
  return {
    queryKey: ['followers', userDocRefId],
    queryFn: async ({ pageParam = undefined }) => {
      return getDocs(
        query(
          collection(db, 'users'),
          ...[
            where(
              'following',
              'array-contains',
              doc(db, 'users', userDocRefId)
            ),
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

export function getIQParams_UserFollowing(followingList: User[]) {
  return {
    queryKey: ['following', followingList],
    queryFn: async ({ pageParam = undefined }) => {
      if (pageParam) {
        const p_idx = followingList.indexOf(pageParam);
        return followingList.slice(p_idx + 1, p_idx + STRIDE + 1);
      } else return followingList.slice(0, STRIDE);
    },
    getNextPageParam: (lastPage: User[]) => {
      if (lastPage.length < STRIDE) return undefined;
      else return lastPage[lastPage.length - 1];
    },
  };
}

export function getIQParams_UserSends(userDocRefId: string) {
  return {
    queryKey: ['sends', userDocRefId],
    queryFn: async ({ pageParam = undefined }) => {
      return getDocs(
        query(
          collection(db, 'sends'),
          ...[
            where('user', '==', doc(db, 'users', userDocRefId)),
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