/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { LazyObject } from './common';
import { DocumentReference, DocumentData } from 'firebase/firestore';
import { User, Tag, Forum } from './types';

export class Route extends LazyObject {
  private name: string | undefined;
  private rating: string | undefined;
  private setter: User | undefined;
  private forum: Forum | undefined;
  private likes: User[] | undefined;
  private tags: Tag[] | undefined;

  private async getData() {
    if (this.hasData) return;

    const data = await this.getDocumentData();
    if (data !== undefined) {
      this.name = data.name;
      this.rating = data.rating;
      this.setter = new User(data.setter);
      this.forum = new Forum(data.forum);
      this.likes = data.likes.map(
        (ref: DocumentReference<DocumentData>) => new User(ref)
      );
      this.tags = data.tags.map(
        (ref: DocumentReference<DocumentData>) => new Tag(ref)
      );

      this.hasData = true;
    }
  }

  public async getName() {
    if (!this.hasData) await this.getData();
    return this.name!;
  }

  public async getRating() {
    if (!this.hasData) await this.getData();
    return this.rating!;
  }

  public async getSetter() {
    if (!this.hasData) await this.getData();
    return this.setter!;
  }

  public async getForum() {
    if (!this.hasData) await this.getData();
    return this.forum!;
  }

  public async getLikes() {
    if (!this.hasData) await this.getData();
    return this.likes!;
  }

  public async getTags() {
    if (!this.hasData) await this.getData();
    return this.tags!;
  }
}
