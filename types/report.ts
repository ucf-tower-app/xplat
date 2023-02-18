/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { DocumentData } from 'firebase/firestore';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { Comment, LazyObject, Post, User } from '../types';

export class Report extends LazyObject {
  // Expected and required when getting data
  public reporter?: User;
  public reported?: User;
  public content?: Post | Comment | User;
  public timestamp?: Date;

  public initWithDocumentData(data: DocumentData): void {
    this.reporter = new User(data.reporter);
    this.reported = new User(data.reported);

    if (data.content.path.startsWith('posts/')) {
      console.log('content was a post');
      this.content = new Post(data.content);
    } else if (data.content.path.startsWith('comments/')) {
      console.log('content was a comment');
      this.content = new Comment(data.content);
    } else if (data.content.path.startsWith('users/')) {
      console.log('content was a user');
      this.content = new User(data.content);
    }

    this.timestamp = new Date(
      data.timestamp.seconds * 1000 + data.timestamp.nanoseconds / 1000000
    );

    this.hasData = true;
  }

  // ======================== Trivial Getters Below ========================

  /** getReporter
   */
  public async getReporter() {
    if (!this.hasData) await this.getData();
    return this.reporter!;
  }

  /** getReported
   */
  public async getReported() {
    if (!this.hasData) await this.getData();
    return this.reported!;
  }

  /** getContent
   */
  public async getContent() {
    if (!this.hasData) await this.getData();
    return this.content!;
  }

  /** getTimestamp
   */
  public async getTimestamp() {
    if (!this.hasData) await this.getData();
    return this.timestamp!;
  }
}

export class ReportMock extends Report {
  constructor(
    reporter: User,
    reported: User,
    content: Post | Comment | User,
    timestamp: Date
  ) {
    super();
    this.reporter = reporter;
    this.reported = reported;
    this.content = content;
    this.timestamp = timestamp;

    this.hasData = true;
    this._idMock = uuidv4();
  }
}
