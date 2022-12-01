/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { LazyObject, LazyStaticImage } from './common';
import { DocumentReference, DocumentData } from 'firebase/firestore';
import { Comment, Forum, User } from './types';

export class Post extends LazyObject {
  // Expected and required when getting data
  protected author?: User;
  protected timestamp?: Date;
  protected textContent?: string;
  protected forum?: Forum;

  // Filled with defaults if not present when getting data
  protected likes?: User[];
  protected comments?: Comment[];
  protected _isSaved?: boolean;

  // Might remain undefined even if has data
  protected imageContent?: LazyStaticImage;

  protected initWithDocumentData(data: DocumentData) {
    this.author = new User(data.author);
    this.timestamp = data.timestamp;
    this.textContent = data.textContent;
    this.forum = new Forum(data.forum);

    this.likes = (data.likes ?? []).map(
      (ref: DocumentReference<DocumentData>) => new User(ref)
    );
    this.comments = (data.comments ?? []).map(
      (ref: DocumentReference<DocumentData>) => new Comment(ref)
    );
    this._isSaved = data._isSaved ?? false;

    if (data.imageContent)
      this.imageContent = new LazyStaticImage(data.imageContent);

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

  public async getForum() {
    if (!this.hasData) await this.getData();
    return this.forum!;
  }

  public async hasImageContent() {
    if (!this.hasData) await this.getData();
    return this.imageContent !== undefined;
  }

  public async getImageContentUrl() {
    if (!this.hasData) await this.getData();
    return this.imageContent?.getImageUrl();
  }

  public async isSaved() {
    if (!this.hasData) await this.getData();
    return this._isSaved!;
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
