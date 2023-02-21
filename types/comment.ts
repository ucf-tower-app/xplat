/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  DocumentData,
  DocumentReference,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  orderBy,
  refEqual,
  runTransaction,
  updateDoc,
  where
} from 'firebase/firestore';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../Firebase';
import { LazyObject, Post, QueryCursor, Report, User, containsRef } from '../types';

export type FetchedComment = {
  author: User;
  timestamp: Date;
  textContent: string;
  post: Post;
  postDocRefId: string;
  likes: User[];
  shouldBeHidden: boolean;

  commentObject: Comment;
};

export class Comment extends LazyObject {
  public author?: User;
  public timestamp?: Date;
  public textContent?: string;
  public post?: Post;

  // Filled with defaults if not present when getting data
  public likes?: User[];
  public reports?: User[];

  public initWithDocumentData(data: DocumentData) {
    this.author = new User(data.author);
    this.timestamp = new Date(
      data.timestamp.seconds * 1000 + data.timestamp.nanoseconds / 1000000
    );
    this.textContent = data.textContent;
    this.post = new Post(data.post);

    this.likes = (data.likes ?? []).map(
      (ref: DocumentReference<DocumentData>) => new User(ref)
    );
    this.reports = (data.reports ?? []).map(
      (ref: DocumentReference<DocumentData>) => new User(ref)
    );

    this.hasData = true;
  }

  /** edit
   * Edit this comment
   * @param textContent: the new content
   */
  public async edit(textContent: string) {
    this.textContent = textContent;
    return updateDoc(this.docRef!, { textContent: textContent });
  }

  /** getReportsCursor
  * get a QueryCursor for a Comment's reports starting from most recent
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

  /** delete
   * Delete this comment
   */
  public async delete() { // todo test
    // no longer refreshingly simple :(
    if (!this.docRef) return;
    const tasks = [];

    (
    await this.getReportsCursor().________getAll_CLOWNTOWN_LOTS_OF_READS()
    ).forEach((rpt) => tasks.push(deleteDoc(rpt?.docRef!)));

    tasks.push(deleteDoc(this.docRef!));

    return Promise.all(tasks);
  }

  /** checkShouldBeHidden
  * Checks if this content should be hidden (if over 3 of reports)
  * @returns true if this content should be hidden, false if not
  */
  public async checkShouldBeHidden() {
    if (!this.hasData) await this.getData();
    return this.reports!.length >= 3;
  }

  /** likedBy
   * Checks if the given user has liked this comment
   */
  public async likedBy(user: User) {
    if (!this.hasData) await this.getData();
    return containsRef(this.likes!, user);
  }

  /** addLike
   * Add a like to this comment
   */
  public async addLike(user: User) {
    if (this.hasData && (await this.likedBy(user))) return;
    await runTransaction(db, async (transaction) => {
      await this.updateWithTransaction(transaction);
      transaction.update(this.docRef!, { likes: arrayUnion(user.docRef!) });
    });
    if (this.hasData) this.likes?.push(user);
  }

  /** removeLike
   * Remove a like from this comment
   */
  public async removeLike(user: User) {
    if (this.hasData && !(await this.likedBy(user))) return;
    await runTransaction(db, async (transaction) => {
      await this.updateWithTransaction(transaction);
      transaction.update(this.docRef!, { likes: arrayRemove(user.docRef!) });
    });
    if (this.hasData)
      this.likes = this.likes?.filter(
        (like) => !refEqual(like.docRef!, user.docRef!)
      );
  }

  // ======================== Fetchers and Builders ========================

  public async fetch() {
    return {
      author: await this.getAuthor(),
      timestamp: await this.getTimestamp(),
      textContent: await this.getTextContent(),
      post: await this.getPost(),
      postDocRefId: (await this.getPost()).docRef!.id,
      likes: await this.getLikes(),
      shouldBeHidden: await this.checkShouldBeHidden(),
      commentObject: this,
    } as FetchedComment;
  }

  public buildFetcher() {
    return async () => this.getData().then(() => this.fetch());
  }

  public static buildFetcherFromDocRefId(docRefId: string) {
    return new Comment(doc(db, 'comments', docRefId)).buildFetcher();
  }

  // ======================== Trivial Getters Below ========================

  /** getAuthor
   */
  public async getAuthor() {
    if (!this.hasData) await this.getData();
    return this.author!;
  }

  /** getTimestamp
   */
  public async getTimestamp() {
    if (!this.hasData) await this.getData();
    return this.timestamp!;
  }

  /** getTextContent
   */
  public async getTextContent() {
    if (!this.hasData) await this.getData();
    return this.textContent!;
  }

  /** getPost
   */
  public async getPost() {
    if (!this.hasData) await this.getData();
    return this.post!;
  }

  /** getLikes
   */
  public async getLikes() {
    if (!this.hasData) await this.getData();
    return this.likes!;
  }
}

export class CommentMock extends Comment {
  constructor(
    author: User,
    timestamp: Date,
    textContent: string,
    likes: User[],
    reports: User[]
  ) {
    super();
    this.author = author;
    this.timestamp = timestamp;
    this.textContent = textContent;
    this.likes = likes;
    this.reports = reports;

    this.hasData = true;
    this._idMock = uuidv4();
  }
}
