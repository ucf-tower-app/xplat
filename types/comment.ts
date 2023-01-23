/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  DocumentData,
  arrayRemove,
  runTransaction,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../Firebase';
import { LazyObject, Post, User } from './types';

export class Comment extends LazyObject {
  public author?: User;
  public timestamp?: Date;
  public textContent?: string;
  public post?: Post;

  public initWithDocumentData(data: DocumentData) {
    this.author = new User(data.author);
    this.timestamp = new Date(
      data.timestamp.seconds * 1000 + data.timestamp.nanoseconds / 1000000
    );
    this.textContent = data.textContent;
    this.post = new Post(data.post);

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

  /** delete
   * Delete this comment
   */
  public async delete() {
    return runTransaction(db, async (transaction) => {
      await this.updateWithTransaction(transaction);
      transaction.update(this.post!.docRef!, {
        comments: arrayRemove(this.docRef!),
      });
      transaction.update(this.author!.docRef!, {
        comments: arrayRemove(this.docRef!),
      });
      transaction.delete(this.docRef!);
    });
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
}

export class CommentMock extends Comment {
  constructor(author: User, timestamp: Date, textContent: string) {
    super();
    this.author = author;
    this.timestamp = timestamp;
    this.textContent = textContent;

    this.hasData = true;
  }
}
