import { DocumentReference, DocumentData, getDoc } from 'firebase/firestore';

export enum UserStatus {
  Unverified = 0,
  Verified = 1,
  Approved = 2,
  Employee = 3,
  Manager = 4,
  Developer = 5,
}

export class LazyObject {
  protected docRef: DocumentReference<DocumentData> | undefined;
  protected hasData: boolean;

  protected async getDocumentData(): Promise<DocumentData> {
    if (this.docRef === undefined)
      return Promise.reject('Document reference is undefined');

    const docSnap = await getDoc(this.docRef);
    if (docSnap.exists()) return Promise.resolve(docSnap.data());

    return Promise.reject('Doc snap does not exist');
  }

  constructor(docRef: DocumentReference<DocumentData> | undefined = undefined) {
    this.docRef = docRef;
    this.hasData = false;
  }
}
