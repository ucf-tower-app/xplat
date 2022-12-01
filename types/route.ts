/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { LazyObject } from './common';
import { DocumentReference, DocumentData } from 'firebase/firestore';
import { User, Tag, Forum } from './types';

export class Route extends LazyObject {
  // Expected and required when getting data
  protected name?: string;
  protected rating?: string;
  protected forum?: Forum;

  // Filled with defaults if not present when getting data
  protected likes?: User[];
  protected tags?: Tag[];
  protected _isActive?: boolean;

  // Might remain undefined even if has data
  protected setter?: User;

  protected initWithDocumentData(data: DocumentData): void {
    this.name = data.name;
    this.rating = data.rating;
    this.forum = new Forum(data.forum);

    this.likes = (data.likes ?? []).map(
      (ref: DocumentReference<DocumentData>) => new User(ref)
    );
    this.tags = (data.tags ?? []).map(
      (ref: DocumentReference<DocumentData>) => new Tag(ref)
    );
    this._isActive = data.isActive ?? false;

    if (data.setter) this.setter = new User(data.setter);

    this.hasData = true;
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

  public async isActive() {
    if (!this.hasData) await this.getData();
    return this._isActive!;
  }
}

export class RouteMock extends Route {
  constructor(
    name: string,
    rating: string,
    setter: User,
    forum: Forum,
    likes: User[],
    tags: Tag[]
  ) {
    super();
    this.name = name;
    this.rating = rating;
    this.setter = setter;
    this.forum = forum;
    this.likes = likes;
    this.tags = tags;

    this.hasData = true;
  }

  public addLikes(likes: User[]) {
    this.likes = this.likes?.concat(likes);
  }

  public addTags(tags: Tag[]) {
    this.tags = this.tags?.concat(tags);
  }
}
