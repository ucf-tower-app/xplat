/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { LazyObject } from './common';
import { DocumentReference, DocumentData } from 'firebase/firestore';
import { Comment, User } from './types';

export class Post extends LazyObject {
  protected author: User | undefined;
  protected timestamp: Date | undefined;
  protected textContent: string | undefined;
  protected likes: User[] | undefined;
  protected comments: Comment[] | undefined;

  protected initWithDocumentData(data: DocumentData) {
    this.author = new User(data.author);
    this.timestamp = data.timestamp;
    this.textContent = data.textContent;
    this.likes = data.likes.map(
      (ref: DocumentReference<DocumentData>) => new User(ref)
    );
    this.comments = data.comments.map(
      (ref: DocumentReference<DocumentData>) => new Comment(ref)
    );

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

  public async getLikes() {
    if (!this.hasData) await this.getData();
    return this.likes!;
  }

  public async getComments() {
    if (!this.hasData) await this.getData();
    return this.comments!;
  }
}

export class PostMock extends Post {
  constructor(
    author: User,
    timestamp: Date,
    textContent: string,
    likes: User[],
    comments: Comment[]
  ) {
    super();
    this.author = author;
    this.timestamp = timestamp;
    this.textContent = textContent;
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
