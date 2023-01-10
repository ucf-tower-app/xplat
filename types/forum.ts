/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { LazyObject, removeRef } from './common';
import {
  DocumentReference,
  DocumentData,
  runTransaction,
  arrayRemove,
} from 'firebase/firestore';
import { Post, Route, User } from './types';
import { createPost } from '../api';
import { db } from '../Firebase';

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
    imageContent: Blob | undefined = undefined
  ) {
    return createPost(author, textContent, this, imageContent);
  }

  public async deletePost(post: Post) {
    await post.deleteStaticContent();
    await runTransaction(db, async (transaction) => {
      transaction.update(this.docRef!, { posts: arrayRemove(post.docRef!) });
      transaction.delete(post.docRef!);
    });
    if (this.posts) removeRef(this.posts, post);
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
