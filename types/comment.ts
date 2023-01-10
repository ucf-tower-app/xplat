/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { DocumentData } from 'firebase/firestore';
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
