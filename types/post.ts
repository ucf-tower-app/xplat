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
  getDocs,
  query,
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
  containsRef,
} from './types';

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
    this.reports = (data.reports ?? []).map(
      (ref: DocumentReference<DocumentData>) => new User(ref)
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
        likes: [],
        reports: [],
        post: this.docRef!,
      });
    });
  }

  /** addReport
   * Add this user's report to this content
   * @param reporter: the user reporting this content
   */
  public async addReport(reporter: User) {
    if (this.hasData && (await this.reportedBy(reporter))) return;

    // update client side
    if (this.hasData) this.reports?.push(reporter);

    // TODO auto-moderation after 3 reports, hides this content by setting a bool. Frontend filters out?

    // update server side
    const newReportDocRef = doc(collection(db, 'reports'));

    return runTransaction(db, async (transaction: Transaction) => {
      transaction.set(newReportDocRef, {
        reporter: reporter.docRef!,
        reported: this.getAuthor(),
        timestamp: serverTimestamp(),
        content: this.docRef!,
      });
    });
  }

  /** removeReport
   * Remove this user's report of this content
   * @param reporter: the user reporting this content
   */
  public async removeReport(reporter: User) {
    if (this.hasData && (await !this.reportedBy(reporter))) return;

    // update client side
    if (this.hasData)
      this.reports = this.reports?.filter(
        (report) => !refEqual(report.docRef!, reporter.docRef!)
      );

    // TODO unhide if less than 3 reports now (undo auto-moderation)

    // update server side
    const q = await getDocs(
      query(
      collection(db, 'reports'),
      where('reporter', '==', reporter.docRef!),
      where('content', '==', this.docRef!)
      )
    );
    const reportDocRef = q.docs[0].ref;
    return runTransaction(db, async (transaction: Transaction) => {
      transaction.delete(reportDocRef);
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

  /** reportedBy
   * Checks if the given user has reported this comment
   */
    public async reportedBy(user: User) {
      if (!this.hasData) await this.getData();
      return containsRef(this.reports!, user);
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

  public async delete() {
    if (!this.docRef) return;
    await this.getData(true);
    const size = await this.getStaticContentSizeInBytes();
    const tasks = [];
    tasks.push(this.deleteStaticContent());

    // It's fine because they'd have to be read to be deleted anyway :)
    (
      await this.getCommentsCursor().________getAll_CLOWNTOWN_LOTS_OF_READS()
    ).forEach((cmt) => tasks.push(deleteDoc(cmt?.docRef!)));

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

    this.hasData = true;
  }

  public addLikes(likes: User[]) {
    this.likes = this.likes?.concat(likes);
  }
}
