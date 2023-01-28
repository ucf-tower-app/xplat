/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { DocumentData, collection, orderBy, where } from 'firebase/firestore';
import { db } from '../Firebase';
import { LazyObject, Post, QueryCursor, Route } from './types';

export class Forum extends LazyObject {
  // Might remain undefined even if has data
  public route?: Route;

  public initWithDocumentData(data: DocumentData) {
    if (data.route) this.route = new Route(data.route);

    this.hasData = true;
  }

  /** getPostsCursor
   * get a QueryCursor for a Forum's posts starting from most recent
   */
  public getPostsCursor() {
    return new QueryCursor(
      Post,
      3,
      collection(db, 'posts'),
      where('forum', '==', this.docRef!),
      orderBy('timestamp', 'desc')
    );
  }

  // ======================== Trivial Getters Below ========================

  /** hasRoute
   */
  public async hasRoute() {
    if (!this.hasData) await this.getData();
    return this.route !== undefined;
  }

  /** getRoute
   */
  public async getRoute() {
    if (!this.hasData) await this.getData();
    return this.route;
  }
}

export class ForumMock extends Forum {
  constructor() {
    super();

    this.hasData = true;
  }
}
