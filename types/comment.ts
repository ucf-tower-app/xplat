/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  DocumentData,
  DocumentReference,
  Transaction,
  collection,
  doc,
  getDocs,
  query,
  arrayRemove,
  arrayUnion,
  deleteDoc,
  refEqual,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../Firebase';
import { LazyObject, Post, User, containsRef } from './types';

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

  /** edit
   * Edit this comment
   * @param textContent: the new content
   */
  public async edit(textContent: string) {
    this.textContent = textContent;
    return updateDoc(this.docRef!, { textContent: textContent });
  }

  /** delete
   * Delete this comment
   */
  public async delete() {
    // refreshingly simple :)
    if (this.docRef) return deleteDoc(this.docRef);
  }

  /** reportedBy
   * Checks if the given user has reported this comment
   */
  public async reportedBy(user: User) {
    if (!this.hasData) await this.getData();
    return containsRef(this.reports!, user);
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
  }
}
