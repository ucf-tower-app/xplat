/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { getDownloadURL, ref } from 'firebase/storage';
import { storage } from './Firebase';

export * from './api/cursors';
export * from './api/forum';
export * from './api/post';
export * from './api/route';
export * from './api/user';

export async function getUrl(path: string) {
  return getDownloadURL(ref(storage, path));
}
