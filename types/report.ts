/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { DocumentData } from 'firebase/firestore';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { LazyObject, User, Post, Comment } from '../types';

export class Report extends LazyObject {
  public reporter?: User;
  public reported?: User;
  public content?: Post | Comment | User;
  public timestamp?: Date;

  public initWithDocumentData(data: DocumentData): void {
    this.reporter = new User(data.user);
    this.reported = new User(data.user);
    if (data.content instanceof Post) this.content = new Post(data.mod);
    else if (data.content instanceof Comment) this.content = new Comment(data.mod);
    else this.content = new User(data.mod);
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
  constructor(reporter: User, reported: User, content: Post | Comment | User, timestamp: Date) {
    super();
    this.reporter = reporter;
    this.reported = reported;
    this.content = content;
    this.timestamp = timestamp;

    this.hasData = true;
    this._idMock = uuidv4();
  }
}
