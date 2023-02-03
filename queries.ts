import {
  DocumentData,
  DocumentReference,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { LazyObject } from './types/common';

export * from './queries/user';

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