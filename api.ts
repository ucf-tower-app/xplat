/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { storage } from './Firebase';
import { getDownloadURL, ref } from 'firebase/storage';

export * from './api/user';
export * from './api/route';
export * from './api/forum';
export * from './api/post';

export async function getUrl(path: string) {
  return getDownloadURL(ref(storage, path));
}
