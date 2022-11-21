import { DocumentReference, DocumentData } from 'firebase/firestore';

export enum UserStatus {
  Unverified = 0,
  Verified = 1,
  Approved = 2,
  Employee = 3,
  Manager = 4,
  Developer = 5,
}

export class LazyObject {
  protected docRef: DocumentReference<DocumentData>;
  protected hasData: boolean;

  constructor(docRef: DocumentReference<DocumentData>) {
    this.docRef = docRef;
    this.hasData = false;
  }
}
