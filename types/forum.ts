/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  DocumentData,
  DocumentReference,
  collection,
  orderBy,
  where,
} from 'firebase/firestore';
import { db } from '../Firebase';
import { LazyObject, Post, QueryCursor, Route } from './types';

export class Forum extends LazyObject {
  // Filled with defaults if not present when getting data
  public posts?: Post[];
  public _isArchived?: boolean;

  // Might remain undefined even if has data
  public route?: Route;

  public initWithDocumentData(data: DocumentData) {
    this.posts = (data.posts ?? []).map(
      (ref: DocumentReference<DocumentData>) => new Post(ref)
    );
    if (data.route) this.route = new Route(data.route);

    this._isArchived = data.isArchived ?? true;

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

  /** isArchived
   */
  public async isArchived() {
    if (!this.hasData) await this.getData();
    return this._isArchived;
  }
}

export class ForumMock extends Forum {
  constructor(posts: Post[]) {
    super();
    this.posts = posts;

    this.hasData = true;
  }

  public addPosts(posts: Post[]) {
    this.posts = this.posts?.concat(posts);
  }
}
