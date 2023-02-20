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
  reporter: User;
}

export function constructReportPageData(docs: QueryDocumentSnapshot<DocumentData>[]): ReportedContent[] {
  return docs.map((doc) => {
    const data = doc.data();
    
    const reporterPathArr = data.reporter._key.path.segments;
    const reporter = new User(data.reporter);
    const contentPathArr = data.content._key.path.segments;
    if (contentPathArr.includes('posts'))
    {
      const p = new Post(data.content);
      return {content: p, reporter: reporter} as ReportedContent; 
    }
    if (contentPathArr.includes('comments'))
    {
      const c = new Comment(data.content);
      return {content: c, reporter: reporter} as ReportedContent;
    }
    
    const u = new User(data.content);
    return {content: u, reporter: reporter} as ReportedContent;
    
  });
}