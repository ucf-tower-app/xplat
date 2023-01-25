/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  DocumentData,
  DocumentReference,
  Transaction,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  increment,
  orderBy,
  refEqual,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { deleteObject, getMetadata } from 'firebase/storage';
import { db } from '../Firebase';
import {
  Comment,
  Forum,
  LazyObject,
  LazyStaticImage,
  LazyStaticVideo,
  QueryCursor,
  User,
} from './types';

export class Post extends LazyObject {
  // Expected and required when getting data
  public author?: User;
  public timestamp?: Date;
  public textContent?: string;

  // Filled with defaults if not present when getting data
  public likes?: User[];
  public comments?: Comment[];
  public _isSaved?: boolean;
  public imageContent?: LazyStaticImage[];

  // Might remain undefined even if has data
  public forum?: Forum;
  public videoContent?: LazyStaticVideo;

  public initWithDocumentData(data: DocumentData) {
    this.author = new User(data.author);
    this.timestamp = new Date(
      data.timestamp.seconds * 1000 + data.timestamp.nanoseconds / 1000000
    );
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

  /** getCommentsCursor
   * get a QueryCursor for a Post's comments starting from most recent
   */
  public getCommentsCursor() {
    return new QueryCursor(
      Comment,
      5,
      collection(db, 'comments'),
      where('post', '==', this.docRef!),
      orderBy('timestamp', 'desc')
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

  public async getStaticContentStorageRefs() {
    if (!this.hasData) await this.getData();
    const res = this.imageContent!.map((img) => img.getStorageRef());
    if (this.videoContent) {
      res.push(this.videoContent.getThumbnailStorageRef());
      res.push(this.videoContent.getVideoStorageRef());
    }
    return res;
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

  public async getStaticContentSizeInBytes() {
    if (!this.hasData) await this.getData();
    const tasks = this.imageContent!.map((img) =>
      getMetadata(img.getStorageRef())
    );
    if (this.videoContent) {
      tasks.push(getMetadata(this.videoContent.getThumbnailStorageRef()));
      tasks.push(getMetadata(this.videoContent.getVideoStorageRef()));
    }
    const metas = await Promise.all(tasks);
    return metas.reduce((sum, meta) => sum + meta.size, 0);
  }

  public async editTextContent(textContent: string) {
    return updateDoc(this.docRef!, { textContent: textContent });
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
    const size = await this.getStaticContentSizeInBytes();
    await this.deleteStaticContent();
    return runTransaction(db, async (transaction: Transaction) => {
      // Reads
      await this.updateWithTransaction(transaction);
      await Promise.all(
        this.comments!.map(async (cmt) =>
          cmt.updateWithTransaction(transaction)
        )
      );

      // Writes
      if (this.forum)
        transaction.update(this.forum!.docRef!, {
          posts: arrayRemove(this.docRef!),
        });
      transaction.update(this.author!.docRef!, {
        posts: arrayRemove(this.docRef),
        totalPostSizeInBytes: increment(-size),
      });
      this.comments!.forEach((cmt) => {
        cmt.getAuthor().then((author) =>
          transaction.update(author.docRef!, {
            comments: arrayRemove(cmt.docRef!),
          })
        );
        transaction.delete(cmt.docRef!);
      });
      transaction.delete(this.docRef!);
    });
  }
}

export class PostMock extends Post {
  constructor(
    author: User,
    timestamp: Date,
    textContent: string,
    likes: User[] = [],
    comments: Comment[] = [],
    imageContent: LazyStaticImage[] = [],
    videoContent?: LazyStaticVideo
  ) {
    super();
    this.author = author;
    this.timestamp = timestamp;
    this.textContent = textContent;
    this.likes = likes;
    this.comments = comments;
    this.imageContent = imageContent;
    this.videoContent = videoContent;

    this.hasData = true;
  }

  public addLikes(likes: User[]) {
    this.likes = this.likes?.concat(likes);
  }

  public addComments(comments: Comment[]) {
    this.comments = this.comments?.concat(comments);
  }
}
