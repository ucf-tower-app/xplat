/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
    collection,
    orderBy,
  } from 'firebase/firestore';
  import { db } from '../Firebase';
  import {
    QueryCursor,
    Report,
  } from '../types';

  /** getReportsCursor
   * Get a cursor for all active reports from most recent
   * @returns A list of active reports
   */
  export function getReportsCursor() {
    return new QueryCursor<Report>(
      Report,
      5,
      collection(db, 'reports'),
      orderBy('timestamp', 'desc')
    );
  }