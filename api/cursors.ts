import { collection, orderBy } from 'firebase/firestore';
import { db } from '../Firebase';
import { Post, QueryCursor } from '../types/types';

/** getAllPostsCursor
 * Get a cursor which returns all posts from newest to oldest
 * @returns QueryCursor<Post> as expected
 */
export function getAllPostsCursor() {
  return new QueryCursor<Post>(
    Post,
    3,
    collection(db, 'posts'),
    orderBy('timestamp', 'desc')
  );
}
