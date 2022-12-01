import { Forum } from '../types/types';
import { db } from '../Firebase';
import { doc } from 'firebase/firestore';

export function getForumById(forumId: string) {
  return new Forum(doc(db, 'forums', forumId));
}
