/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { LazyObject, UserStatus } from './common';
import { DocumentReference, DocumentData } from 'firebase/firestore';
import { Send } from './types';

export class User extends LazyObject {
  protected username: string | undefined;
  protected bio: string | undefined;
  protected status: UserStatus | undefined;
  protected sends: Send[] | undefined;
  protected following: User[] | undefined;
  protected followers: User[] | undefined;

  protected initWithDocumentData(data: DocumentData): void {
    this.username = data.username;
    this.bio = data.bio;
    this.status = data.status as UserStatus;
    this.sends = data.sends.map(
      (ref: DocumentReference<DocumentData>) => new Send(ref)
    );
    this.following = data.following.map(
      (ref: DocumentReference<DocumentData>) => new User(ref)
    );
    this.followers = data.followers.map(
      (ref: DocumentReference<DocumentData>) => new User(ref)
    );

    this.hasData = true;
  }

  public async getUsername() {
    if (!this.hasData) await this.getData();
    return this.username!;
  }

  public async getBio() {
    if (!this.hasData) await this.getData();
    return this.bio!;
  }

  public async getStatus() {
    if (!this.hasData) await this.getData();
    return this.status!;
  }

  public async getSends() {
    if (!this.hasData) await this.getData();
    return this.sends!;
  }

  public async getFollowing() {
    if (!this.hasData) await this.getData();
    return this.following!;
  }

  public async getFollowers() {
    if (!this.hasData) await this.getData();
    return this.followers!;
  }
}

export class UserMock extends User {
  constructor(
    username: string,
    bio: string,
    status: UserStatus,
    sends: Send[],
    following: User[],
    followers: User[]
  ) {
    super();
    this.username = username;
    this.bio = bio;
    this.status = status;
    this.sends = sends;
    this.following = following;
    this.followers = followers;
  }

  public addSends(sends: Send[]) {
    this.sends = this.sends?.concat(sends);
  }

  public addFollowing(following: User[]) {
    this.following = this.following?.concat(following);
  }

  public addFollowers(followers: User[]) {
    this.followers = this.followers?.concat(followers);
  }
}
