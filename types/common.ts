/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  DocumentData,
  DocumentReference,
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

export class ArrayCursor<T> {
  public data: T[];
  private idx: number;
  private stride: number;

  constructor(data: T[], stride = 10) {
    this.data = data;
    this.idx = 0;
    this.stride = stride;
  }

  public hasNext() {
    return this.idx < this.data.length;
  }

  public getNext(stride: number | undefined) {
    if (!this.hasNext()) return [];
    const res = this.data.slice(this.idx, this.idx + (stride ?? this.stride));
    this.idx += stride ?? this.stride;
    return res;
  }

  public forEachNext<Q>(stride: number | undefined, callback: (arg: T) => Q) {
    return this.getNext(stride).map(callback);
  }
}

export abstract class LazyObject {
  public docRef: DocumentReference<DocumentData> | undefined;
  protected hasData: boolean;

  public abstract initWithDocumentData(data: DocumentData): void;

  public async getData(forceUpdate = false): Promise<void> {
    if (this.hasData && !forceUpdate) return;
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
