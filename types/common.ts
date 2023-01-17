/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  DocumentData,
  DocumentReference,
  getDoc,
  refEqual,
} from 'firebase/firestore';
import { ref } from 'firebase/storage';
import { getUrl } from '../api';
import { storage } from '../Firebase';

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

export class LazyStaticImage {
  protected imagePath: string;
  protected imageUrl?: string;

  constructor(imagePath: string, imageUrl?: string) {
    this.imagePath = imagePath;
    this.imageUrl = imageUrl;
  }

  public async getImageUrl() {
    if (this.imageUrl === undefined) {
      this.imageUrl = await getUrl(this.imagePath);
    }
    return this.imageUrl;
  }

  public getStorageRef() {
    return ref(storage, this.imagePath);
  }
}
