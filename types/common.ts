import { DocumentReference, DocumentData, getDoc } from 'firebase/firestore';

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
  protected hasData: boolean;

  protected abstract initWithDocumentData(data: DocumentData): void;

  public async getData(): Promise<void> {
    if (this.hasData) return Promise.resolve();
    if (this.docRef === undefined)
      return Promise.reject('Document reference is undefined');

    const docSnap = await getDoc(this.docRef);
    if (!docSnap.exists()) return Promise.reject('Doc snap does not exist');

    return this.initWithDocumentData(docSnap.data());
  }

  constructor(docRef: DocumentReference<DocumentData> | undefined = undefined) {
    this.docRef = docRef;
    this.hasData = false;
  }
}
