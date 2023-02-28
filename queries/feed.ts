import {
  DocumentData,
  QueryDocumentSnapshot,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
} from 'firebase/firestore';
import { db } from '../Firebase';
import { constructPageData } from '../queries';
import { FetchedUser, Post, User } from '../types';

export function getSlices(followingList: User[]) {
  return followingList.reduce((res: User[][], item, i) => {
    const ci = Math.floor(i / 10);
    if (!res[ci]) res[ci] = [];
    res[ci].push(item);
    return res;
  }, []);
}

const STRIDE = 3;

export function getIQParams_AllPosts() {
  return {
    queryKey: ['all-posts'],
    queryFn: async ({ pageParam = undefined }) => {
      return getDocs(
        query(
          collection(db, 'posts'),
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

export type MultiCursorPageParam = {
  cursors: QueryDocumentSnapshot<DocumentData>[][];
  slices: User[][];
};
export type MultiCursorResult = {
  result: Post[];
  hasMoreData: boolean;
  param: MultiCursorPageParam;
};

export async function getInitialPageParam(
  fetchedUser: FetchedUser | undefined
) {
  if (fetchedUser === undefined) return {};
  const slices = getSlices(fetchedUser.followingList);
  const data = await Promise.all(
    slices.map((slice) =>
      getDocs(
        query(
          collection(db, 'posts'),
          orderBy('timestamp', 'desc'),
          where(
            'author',
            'in',
            slice.map((user) => user.docRef!)
          ),
          limit(STRIDE)
        )
      ).then((snap) => snap.docs)
    )
  );
  return { cursors: data, slices: slices } as MultiCursorPageParam;
}

export async function extractNext(pageParam: MultiCursorPageParam) {
  const res: QueryDocumentSnapshot[] = [];
  while (
    res.length < STRIDE &&
    pageParam.cursors.some((list) => list.length > 0)
  ) {
    let bestIdx = -1; // TODO: Functional programming
    pageParam.cursors.forEach((cursor, idx, array) => {
      if (cursor.length === 0) return;
      if (bestIdx === -1) bestIdx = idx;
      else {
        const prevTime = array[bestIdx][0].data()!.timestamp as Date;
        const cur = cursor[0].data()!.timestamp as Date;
        if (cur > prevTime) bestIdx = idx;
      }
    });

    const snap = pageParam.cursors[bestIdx][0];
    res.push(snap);
    pageParam.cursors[bestIdx] = pageParam.cursors[bestIdx].slice(1);
    if (pageParam.cursors[bestIdx].length === 0) {
      pageParam.cursors[bestIdx] = await getDocs(
        query(
          collection(db, 'posts'),
          orderBy('timestamp', 'desc'),
          where(
            'author',
            'in',
            pageParam.slices[bestIdx].map((user) => user.docRef!)
          ),
          startAfter(snap),
          limit(STRIDE)
        )
      ).then((qsnap) => qsnap.docs);
    }
  }

  return {
    result: constructPageData(Post, res),
    hasMoreData: res.length === STRIDE,
    param: pageParam,
  } as MultiCursorResult;
}
