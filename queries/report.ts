import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { Post, Comment, User } from '../types';
import { db } from '../Firebase';

const STRIDE = 3;

export function getIQParams_Reports() {
  return {
    queryKey: ['reports'],
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

export type ReportedContent = {
  content: User | Comment | Post;
  reporters: User[];
}

export function constructReportPageData(docs: QueryDocumentSnapshot<DocumentData>[]) {
  return docs.map((doc) => {
    const data = doc.data();
    console.log(data);
    const pathArr = data.content._key.path.segments;
    if (pathArr.includes('posts'))
    {
      const p = new Post(pathArr[pathArr.length - 1]);
      return p; 
    }
    if (pathArr.includes('comments'))
    {
      const c = new Comment(pathArr[pathArr.length - 1]);
      return c;
    }
    
    const u = new User(pathArr[pathArr.length - 1]);
    return u;
    
  });
}