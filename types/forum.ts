/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { LazyObject } from './common';
import { DocumentReference, DocumentData } from 'firebase/firestore';
import { Post } from './types';

export class Forum extends LazyObject {
  private posts: Post[] | undefined;

  private async getData() {
    if (this.hasData) return;

    const data = await this.getDocumentData();
    if (data !== undefined) {
      this.posts = data.posts.map(
        (ref: DocumentReference<DocumentData>) => new Post(ref)
      );

      this.hasData = true;
    }
  }

  public async getPosts() {
    if (!this.hasData) await this.getData();
    return this.posts!;
  }
}
