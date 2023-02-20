import {
  DocumentData,
  DocumentReference,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { LazyObject } from './types/common';

export * from './queries/feed';
export * from './queries/forum';
export * from './queries/leaderboard';
export * from './queries/post';
export * from './queries/user';
export * from './queries/report';

export function constructPageData<T extends LazyObject>(
  Tcreator: new (data: DocumentReference) => T,
  docs: QueryDocumentSnapshot<DocumentData>[]
) {
  return docs.map((doc) => {
    const p = new Tcreator(doc.ref);
    p.initWithDocumentData(doc.data());
    return p;
  });
}