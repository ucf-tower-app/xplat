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

export abstract class LazyObject {
  public docRef: DocumentReference<DocumentData> | undefined;
  public hasData: boolean;
  public exists: boolean = true;

  public _idMock: string | undefined;

  public getId() {
    if (this.docRef !== undefined) {
      return this.docRef.id
    } else if (this._idMock !== undefined) {
      return this._idMock
    }

    throw "Cannot fetch ID from LazyObject with no docRef or idMock"; 
  }

  public abstract initWithDocumentData(data: DocumentData): void;

  public async getData(forceUpdate = false): Promise<void> {
    if (this.hasData && !forceUpdate) return;
    if (this.docRef === undefined)
      return Promise.reject('Document reference is undefined');

    return getDoc(this.docRef).then((docSnap) => {
      if (!docSnap.exists()) {
        this.exists = false;
        return Promise.reject('Document does not exist');
      } else {
        this.exists = true;
        this.initWithDocumentData(docSnap.data());
      }
    });
  }

  public async updateWithTransaction(transaction: Transaction) {
    const snap = await transaction.get(this.docRef!);
    if (!snap.exists) {
      this.exists = false;
      return Promise.reject('Document does not exist');
    }
    this.exists = true;
    this.initWithDocumentData(snap.data()!);
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
