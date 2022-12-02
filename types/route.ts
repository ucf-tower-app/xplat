/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { LazyObject, RouteStatus } from './common';
import {
  DocumentReference,
  DocumentData,
  runTransaction,
  arrayUnion,
  arrayRemove,
  refEqual,
} from 'firebase/firestore';
import { User, Tag, Forum } from './types';
import { db } from '../Firebase';

export class Route extends LazyObject {
  // Expected and required when getting data
  protected name?: string;
  protected rating?: string;
  protected forum?: Forum;

  // Filled with defaults if not present when getting data
  protected likes?: User[];
  protected tags?: Tag[];
  protected status?: RouteStatus;

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
    this.status = (data.status ?? 0) as RouteStatus;

    if (data.setter) this.setter = new User(data.setter);

    this.hasData = true;
  }

  public async addLike(user: User) {
    await runTransaction(db, async (transaction) => {
      transaction.update(this.docRef!, { likes: arrayUnion(user.docRef!) });
    });
  }

  public async removeLike(user: User) {
    return runTransaction(db, async (transaction) => {
      transaction.update(this.docRef!, { likes: arrayRemove(user.docRef!) });
    });
  }

  public async likedBy(user: User) {
    return this.getLikes().then((likes) =>
      likes.some((like) => refEqual(like.docRef!, user.docRef!))
    );
  }

  public async getName() {
    if (!this.hasData) await this.getData();
    return this.name!;
  }

  public async getRating() {
    if (!this.hasData) await this.getData();
    return this.rating!;
  }

  public async hasSetter() {
    if (!this.hasData) await this.getData();
    return this.setter !== undefined;
  }

  public async getSetter() {
    if (!this.hasData) await this.getData();
    return this.setter;
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

  public async getStatus() {
    if (!this.hasData) await this.getData();
    return this.status!;
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
