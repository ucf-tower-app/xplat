/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { arrayRemove, DocumentData, runTransaction } from 'firebase/firestore';
import { db } from '../Firebase';
import { LazyObject } from './common';
import { Post, User } from './types';

export class Comment extends LazyObject {
  protected author?: User;
  protected timestamp?: Date;
  protected textContent?: string;
  protected post?: Post;

  protected initWithDocumentData(data: DocumentData) {
    this.author = new User(data.author);
    this.timestamp = data.timestamp;
    this.textContent = data.textContent;
    this.post = new Post(data.post);

    this.hasData = true;
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

  public async getPost() {
    if (!this.hasData) await this.getData();
    return this.post!;
  }

  public async delete() {
    return runTransaction(db, async (transaction) => {
      this.updateWithTransaction(transaction);
      transaction.update(this.post!.docRef!, {
        comments: arrayRemove(this.docRef!),
      });
      transaction.update(this.author!.docRef!, {
        comments: arrayRemove(this.docRef!),
      });
      transaction.delete(this.docRef!);
    });
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
