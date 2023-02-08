/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
    collection,
    orderBy,
  } from 'firebase/firestore';
  import { db } from '../Firebase';
  import {
    QueryCursor,
    ModHistory,
  } from '../types';

  /** getModHistoryCursor
   * Get a cursor for moderation history from most recent
   * @returns A list of Tower Routes
   */
  export function getModHistoryCursor() {
    return new QueryCursor<ModHistory>(
      ModHistory,
      5,
      collection(db, 'modHistory'),
      orderBy('timestamp', 'desc')
    );
  }