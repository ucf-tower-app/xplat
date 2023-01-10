/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { LazyObject, LazyStaticImage } from './common';
import {
  DocumentReference,
  DocumentData,
  arrayRemove,
  refEqual,
  deleteDoc,
} from 'firebase/firestore';
import { Comment, Forum, User } from './types';
import { db } from '../Firebase';
import { arrayUnion, runTransaction } from 'firebase/firestore';
import { deleteObject } from 'firebase/storage';

export class Post extends LazyObject {
  // Expected and required when getting data
  protected author?: User;
  protected timestamp?: Date;
  protected textContent?: string;

  // Filled with defaults if not present when getting data
  protected likes?: User[];
  protected comments?: Comment[];
  protected _isSaved?: boolean;
  protected imageContent?: LazyStaticImage[];

  // Might remain undefined even if has data
  protected forum?: Forum;

  protected initWithDocumentData(data: DocumentData) {
    this.author = new User(data.author);
    this.timestamp = data.timestamp;
    this.textContent = data.textContent;

    this.likes = (data.likes ?? []).map(
      (ref: DocumentReference<DocumentData>) => new User(ref)
    );
    this.comments = (data.comments ?? []).map(
      (ref: DocumentReference<DocumentData>) => new Comment(ref)
    );
    this._isSaved = data._isSaved ?? false;
    this.imageContent = (data.imageContent ?? []).map(
      (path: string) => new LazyStaticImage(path)
    );

    if (data.forum) this.forum = new Forum(data.forum);

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

  public async getAuthor() {
    if (!this.hasData) await this.getData();
    return this.author!;
  }

  public async getTimestamp() {
    if (!this.hasData) await this.getData();
    return this.timestamp!;
  }

  public async getTextContent() {
    if (!this.hasData) await this.getData();
    return this.textContent!;
  }

  public async getLikes() {
    if (!this.hasData) await this.getData();
    return this.likes!;
  }

  public async getComments() {
    if (!this.hasData) await this.getData();
    return this.comments!;
  }

  public async getForum() {
    if (!this.hasData) await this.getData();
    return this.forum;
  }

  public async hasForum() {
    if (!this.hasData) await this.getData();
    return this.forum !== undefined;
  }

  public async getImageCount() {
    if (!this.hasData) await this.getData();
    return this.imageContent!.length;
  }

  public async getImageContentUrls() {
    if (!this.hasData) await this.getData();
    return Promise.all(this.imageContent!.map((img) => img.getImageUrl()));
  }

  public async isSaved() {
    if (!this.hasData) await this.getData();
    return this._isSaved!;
  }

  public async deleteStaticContent() {
    if (!this.hasData) await this.getData();
    return Promise.all(
      this.imageContent!.map((img) => deleteObject(img.getStorageRef()))
    );
  }

  public async delete() {
    if (!this.docRef) return;
    if (await this.hasForum()) return this.forum!.deletePost(this);
    else {
      await this.deleteStaticContent();
      return deleteDoc(this.docRef);
    }
  }
}

export class PostMock extends Post {
  constructor(
    author: User,
    timestamp: Date,
    textContent: string,
    likes: User[],
    comments: Comment[],
    imageContent?: LazyStaticImage[]
  ) {
    super();
    this.author = author;
    this.timestamp = timestamp;
    this.textContent = textContent;
    this.imageContent = imageContent;
    this.likes = likes;
    this.comments = comments;

    this.hasData = true;
  }

  public addLikes(likes: User[]) {
    this.likes = this.likes?.concat(likes);
  }

  public addComments(comments: Comment[]) {
    this.comments = this.comments?.concat(comments);
  }
}
