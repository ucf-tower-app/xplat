/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  DocumentData,
  DocumentReference,
  Transaction,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
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
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../Firebase';
import {
  Comment,
  Report,
  Forum,
  LazyObject,
  LazyStaticImage,
  LazyStaticVideo,
  QueryCursor,
  User,
  containsRef,
} from '../types';

export type FetchedPost = {
  author: User;
  timestamp: Date;
  textContent: string;
  likes: User[];
  imageContentUrls: string[];

  forum: Forum | undefined;
  videoContent:
    | {
        videoUrl: string;
        thumbnailUrl: string;
      }
    | undefined;

  postObject: Post;
  isSend: boolean;
  shouldBeHidden: boolean;
  routeInfo?: { name: string; grade: string };
};

export class Post extends LazyObject {
  // Expected and required when getting data
  public author?: User;
  public timestamp?: Date;
  public textContent?: string;

  // Filled with defaults if not present when getting data
  public likes?: User[];
  public reports?: User[];
  public _isSaved?: boolean;
  public imageContent?: LazyStaticImage[];
  public _isSend?: boolean;

  // Might remain undefined even if has data
  public forum?: Forum;
  public routeInfo?: { name: string; grade: string };
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
    this.reports = (data.reports ?? []).map(
      (ref: DocumentReference<DocumentData>) => new User(ref)
    );
    this._isSaved = data._isSaved ?? false;
    this.imageContent = (data.imageContent ?? []).map(
      (path: string) => new LazyStaticImage(path)
    );
    this._isSend = data.isSend ?? false;

    if (data.routeInfo) this.routeInfo = data.routeInfo;
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
        likes: [],
        reports: [],
        post: this.docRef!,
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

  /** getReportsCursor
   * get a QueryCursor for a Post's reports starting from most recent
   */
  public getReportsCursor() {
    return new QueryCursor(
      Report,
      5,
      collection(db, 'reports'),
      where('content', '==', this.docRef!),
      orderBy('timestamp', 'desc')
    );
  }

  // ======================== Fetchers and Builders ========================

  public async fetch() {
    return {
      author: await this.getAuthor(),
      timestamp: await this.getTimestamp(),
      textContent: await this.getTextContent(),
      likes: await this.getLikes(),
      imageContentUrls: await this.getImageContentUrls(),
      forum: (await this.hasForum()) ? await this.getForum() : undefined,
      videoContent: (await this.hasVideoContent())
        ? {
            videoUrl: await this.getVideoUrl(),
            thumbnailUrl: await this.getVideoThumbnailUrl(),
          }
        : undefined,
      postObject: this,
      isSend: await this.isSend(),
      shouldBeHidden: await this.checkShouldBeHidden(),
      routeInfo: this.routeInfo,
    } as FetchedPost;
  }

  public buildFetcher() {
    return async () => this.getData().then(() => this.fetch());
  }

  public static buildFetcherFromDocRefId(docRefId: string) {
    return new Post(doc(db, 'posts', docRefId)).buildFetcher();
  }

  /** checkShouldBeHidden
   * Checks if this content should be hidden (if over 3 of reports)
   * @returns true if this content should be hidden, false if not
   */
  public async checkShouldBeHidden() {
    if (!this.hasData) await this.getData();
    return this.reports!.length >= 3;
  }

  public async isSend() {
    if (!this.hasData) await this.getData();
    return this._isSend!;
  }

  public async hasRouteInfo() {
    if (!this.hasData) await this.getData();
    return this.routeInfo !== undefined;
  }

  public async getRouteInfo() {
    if (!this.hasData) await this.getData();
    return this.routeInfo!;
  }

  public async likedBy(user: User) {
    if (!this.hasData) await this.getData();
    return containsRef(this.likes!, user);
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

  public async delete() { // todo test
    if (!this.docRef) return;
    await this.getData(true);
    const size = await this.getStaticContentSizeInBytes();
    const tasks = [];
    tasks.push(this.deleteStaticContent());

    // Delete comments and reports on this post
    // It's fine because they'd have to be read to be deleted anyway :)
    (
      await this.getCommentsCursor().________getAll_CLOWNTOWN_LOTS_OF_READS()
    ).forEach((cmt) => tasks.push(deleteDoc(cmt?.docRef!)));
    (
      await this.getReportsCursor().________getAll_CLOWNTOWN_LOTS_OF_READS()
    ).forEach((rpt) => tasks.push(deleteDoc(rpt?.docRef!)));

    tasks.push(
      runTransaction(db, async (transaction: Transaction) => {
        // Reads
        await this.updateWithTransaction(transaction);

        // Writes
        transaction
          .update(this.author!.docRef!, {
            totalPostSizeInBytes: increment(-size),
          })
          .delete(this.docRef!);
      })
    );
    return Promise.all(tasks);
  }
}

export class PostMock extends Post {
  constructor(
    author: User,
    timestamp: Date,
    textContent: string,
    likes: User[] = [],
    reports: User[] = [],
    imageContent: LazyStaticImage[] = [],
    isSend: boolean,
    videoContent?: LazyStaticVideo
  ) {
    super();
    this.author = author;
    this.timestamp = timestamp;
    this.textContent = textContent;
    this.likes = likes;
    this.reports = reports;
    this.imageContent = imageContent;
    this.videoContent = videoContent;
    this._isSend = isSend;

    this.hasData = true;
    this._idMock = uuidv4();
  }

  public addLikes(likes: User[]) {
    this.likes = this.likes?.concat(likes);
  }
}
