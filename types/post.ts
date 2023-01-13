/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { LazyObject } from './common';
import {
  DocumentReference,
  DocumentData,
  arrayRemove,
  refEqual,
  doc,
  collection,
  serverTimestamp,
  Transaction,
} from 'firebase/firestore';
import { Comment, Forum, User, LazyStaticImage } from './types';
import { db } from '../Firebase';
import { arrayUnion, runTransaction } from 'firebase/firestore';
import { deleteObject } from 'firebase/storage';
import { LazyStaticVideo } from './media';

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
  protected videoContent?: LazyStaticVideo;

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
    if (data.videoContent)
      this.videoContent = new LazyStaticVideo(
        data.videoContent + '_thumbnail',
        data.videoContent + '_video'
      );
    this.hasData = true;
  }

  public async addComment(author: User, textContent: string) {
    const newCommentDocRef = doc(collection(db, 'comments'));

    return runTransaction(db, async (transaction: Transaction) => {
      // actually create the comment document
      transaction.set(newCommentDocRef, {
        author: author.docRef!,
        textContent: textContent,
        timestamp: serverTimestamp(),
        post: this.docRef!,
      });
      transaction.update(author.docRef!, {
        comments: arrayUnion(newCommentDocRef),
      });
      transaction.update(this.docRef!, {
        comments: arrayUnion(newCommentDocRef),
      });
    });
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

  public async hasVideoContent() {
    if (!this.hasData) await this.getData();
    return this.videoContent !== undefined;
  }

  public async getVideoThumbnailUrl() {
    if (!this.hasData) await this.getData();
    return this.videoContent!.getThumbnailUrl();
  }

  public async getVideoUrl() {
    if (!this.hasData) await this.getData();
    return this.videoContent!.getVideoUrl();
  }

  public async isSaved() {
    if (!this.hasData) await this.getData();
    return this._isSaved!;
  }

  public async deleteStaticContent() {
    if (!this.hasData) await this.getData();
    const deleteImages =
      this.imageContent &&
      Promise.all(
        this.imageContent.map((img) => deleteObject(img.getStorageRef()))
      );
    const deleteThumbnail =
      this.videoContent &&
      deleteObject(this.videoContent.getThumbnailStorageRef());
    const deleteVideo =
      this.videoContent && deleteObject(this.videoContent.getVideoStorageRef());
    await deleteImages;
    await deleteThumbnail;
    await deleteVideo;
  }

  public async delete() {
    if (!this.docRef) return;
    await this.deleteStaticContent();
    return runTransaction(db, async (transaction: Transaction) => {
      this.updateWithTransaction(transaction);

      if (this.forum)
        transaction.update(this.forum!.docRef!, {
          posts: arrayRemove(this.docRef!),
        });
      transaction.delete(this.docRef!);
      this.comments!.forEach((cmt) => transaction.delete(cmt.docRef!));
    });
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
