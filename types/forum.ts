/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { LazyObject } from './common';
import { DocumentReference, DocumentData } from 'firebase/firestore';
import { Post } from './types';

export class Forum extends LazyObject {
  protected posts: Post[] | undefined;

  protected initWithDocumentData(data: DocumentData) {
    this.posts = data.posts.map(
      (ref: DocumentReference<DocumentData>) => new Post(ref)
    );

    this.hasData = true;
  }

  public async getPosts() {
    if (!this.hasData) await this.getData();
    return this.posts!;
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
