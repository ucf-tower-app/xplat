import { collection, orderBy, where } from 'firebase/firestore';
import { db } from '../Firebase';
import { Post, PostCursorMerger, QueryCursor, User } from '../types';

export function getQueryCursor(followingList: User[]) {
  const slices = followingList.reduce((res: User[][], item, i) => {
    const ci = Math.floor(i / 10);
    if (!res[ci]) res[ci] = [];
    res[ci].push(item);
    return res;
  }, []);

  const queries = slices.map((users) => {
    return new QueryCursor(
      Post,
      3,
      collection(db, 'posts'),
      where(
        'author',
        'in',
        users.map((user) => user.docRef!)
      ),
      orderBy('timestamp', 'desc')
    );
  });

  return new PostCursorMerger(queries);
}
