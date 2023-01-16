/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { DocumentData, DocumentReference } from 'firebase/firestore';
import { createPost } from '../api';
import { LazyObject } from './common';
import { Post, Route, User } from './types';

export class Forum extends LazyObject {
  // Filled with defaults if not present when getting data
  protected posts?: Post[];
  protected _isArchived?: boolean;

  // Might remain undefined even if has data
  protected route?: Route;

  protected initWithDocumentData(data: DocumentData) {
    this.posts = (data.posts ?? []).map(
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

  public async hasRoute() {
    if (!this.hasData) await this.getData();
    return this.route !== undefined;
  }

  public async getRoute() {
    if (!this.hasData) await this.getData();
    return this.route;
  }

  public async isArchived() {
    if (!this.hasData) await this.getData();
    return this._isArchived;
  }

  public async createPost(
    author: User,
    textContent: string,
    imageContent: Blob[] | undefined = undefined
  ) {
    return createPost(author, textContent, this, imageContent);
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
