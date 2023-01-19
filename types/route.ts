/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  DocumentData,
  DocumentReference,
  arrayRemove,
  arrayUnion,
  refEqual,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../Firebase';
import { LazyObject, RouteStatus } from './common';
import { Forum, LazyStaticImage, Tag, User } from './types';

export class Route extends LazyObject {
  // Expected and required when getting data
  protected name?: string;
  protected rating?: string;
  protected forum?: Forum;
  protected type?: string;

  // Filled with defaults if not present when getting data
  protected likes?: User[];
  protected tags?: Tag[];
  protected status?: RouteStatus;
  protected description?: string;

  // Might remain undefined even if has data
  protected setter?: User;
  protected thumbnail?: LazyStaticImage;
  protected rope?: number;

  public initWithDocumentData(data: DocumentData): void {
    this.name = data.name;
    this.rating = data.rating;
    this.forum = new Forum(data.forum);
    this.type = data.type;

    this.likes = (data.likes ?? []).map(
      (ref: DocumentReference<DocumentData>) => new User(ref)
    );
    this.tags = (data.tags ?? []).map(
      (ref: DocumentReference<DocumentData>) => new Tag(ref)
    );
    this.status = (data.status ?? 0) as RouteStatus;
    this.description = data.description ?? '';

    if (data.setter) this.setter = new User(data.setter);
    if (data.thumbnail) this.thumbnail = new LazyStaticImage(data.thumbnail);
    if (data.rope) this.rope = data.rope;

    this.hasData = true;
  }

  public async addLike(user: User) {
    if (this.hasData && (await this.likedBy(user))) return;
    await runTransaction(db, async (transaction) => {
      transaction.update(this.docRef!, { likes: arrayUnion(user.docRef!) });
    });
    if (this.hasData) this.likes?.push(user);
  }

  public async removeLike(user: User) {
    if (this.hasData && !(await this.likedBy(user))) return;
    await runTransaction(db, async (transaction) => {
      transaction.update(this.docRef!, { likes: arrayRemove(user.docRef!) });
    });
    if (this.hasData)
      this.likes = this.likes?.filter(
        (like) => !refEqual(like.docRef!, user.docRef!)
      );
  }

  public async likedBy(user: User) {
    return this.getLikes().then((likes) =>
      likes.some((like) => refEqual(like.docRef!, user.docRef!))
    );
  }

  public async getDescription() {
    if (!this.hasData) await this.getData();
    return this.description!;
  }

  public async hasRope() {
    if (!this.hasData) await this.getData();
    return this.rope !== undefined;
  }

  public async getRope() {
    if (!this.hasData) await this.getData();
    return this.rope!;
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

  public async getStatus() {
    if (!this.hasData) await this.getData();
    return this.status!;
  }

  public async getType() {
    if (!this.hasData) await this.getData();
    return this.type!;
  }

  public async hasThumbnail() {
    if (!this.hasData) await this.getData();
    return this.thumbnail !== undefined;
  }

  public async getThumbnailUrl() {
    if (!this.hasData) await this.getData();
    return this.thumbnail!.getImageUrl();
  }

  public async getThumbnailStorageRef() {
    if (!this.hasData) await this.getData();
    return this.thumbnail!.getStorageRef();
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
