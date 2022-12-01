/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { LazyObject } from './common';
import { DocumentReference, DocumentData } from 'firebase/firestore';
import { Post, Route } from './types';

export class Forum extends LazyObject {
  // Expected and required when getting data
  protected posts?: Post[];
  protected route?: Route;

  // Filled with defaults if not present when getting data
  protected _isArchived?: boolean;

  protected initWithDocumentData(data: DocumentData) {
    this.posts = data.posts.map(
      (ref: DocumentReference<DocumentData>) => new Post(ref)
    );
    if (data.route) this.route = new Route(data.route);

    this._isArchived = data.isArchived ?? true;

    this.hasData = true;
  }

  public async getPosts() {
    if (!this.hasData) await this.getData();
    return this.posts!;
  }

  public async getRoute() {
    if (!this.hasData) await this.getData();
    return this.route;
  }

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
