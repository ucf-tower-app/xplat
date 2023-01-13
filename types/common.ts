/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  DocumentReference,
  DocumentData,
  getDoc,
  refEqual,
  Transaction,
} from 'firebase/firestore';

export enum UserStatus {
  Unverified = 0,
  Verified = 1,
  Approved = 2,
  Employee = 3,
  Manager = 4,
  Developer = 5,
}

export enum RouteStatus {
  Draft = 0,
  Active = 1,
  Archived = 2,
}

export abstract class LazyObject {
  public docRef: DocumentReference<DocumentData> | undefined;
  protected hasData: boolean;

  protected abstract initWithDocumentData(data: DocumentData): void;

  public async getData(): Promise<void> {
    if (this.hasData) return Promise.resolve();
    if (this.docRef === undefined)
      return Promise.reject('Document reference is undefined');

    return getDoc(this.docRef).then((docSnap) => {
      if (!docSnap.exists()) return Promise.reject('Doc snap does not exist');
      else this.initWithDocumentData(docSnap.data());
    });
  }

  public async updateWithTransaction(transaction: Transaction) {
    this.initWithDocumentData((await transaction.get(this.docRef!)).data()!);
  }

  constructor(docRef: DocumentReference<DocumentData> | undefined = undefined) {
    this.docRef = docRef;
    this.hasData = false;
  }
}

export function containsRef(array: LazyObject[], targ: LazyObject) {
  return (
    targ.docRef &&
    array.some((obj) => obj.docRef && refEqual(obj.docRef, targ.docRef!))
  );
}

export function removeRef(array: LazyObject[], targ: LazyObject) {
  if (containsRef(array, targ)) {
    const idx = array.findIndex(
      (e) => e.docRef && refEqual(e.docRef, targ.docRef!)
    );
    array.splice(idx);
  }
}
