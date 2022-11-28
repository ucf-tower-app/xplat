/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { LazyObject, UserStatus } from './common';
import { DocumentReference, DocumentData, setDoc } from 'firebase/firestore';
import { Send } from './types';

export class User extends LazyObject {
  protected username?: string;
  protected email?: string;
  protected bio?: string;
  protected status?: UserStatus;
  protected sends?: Send[];
  protected following?: User[];
  protected followers?: User[];

  protected initWithDocumentData(data: DocumentData): void {
    this.username = data.username;
    this.email = data.email;
    this.bio = data.bio;
    this.status = data.status as UserStatus;
    this.sends = (data.sends ?? []).map(
      (ref: DocumentReference<DocumentData>) => new Send(ref)
    );
    this.following = (data.following ?? []).map(
      (ref: DocumentReference<DocumentData>) => new User(ref)
    );
    this.followers = (data.followers ?? []).map(
      (ref: DocumentReference<DocumentData>) => new User(ref)
    );

    this.hasData = true;
  }

  private async pushUpdateToFirestore() {
    const data: DocumentData = {
      username: this.username,
      email: this.email,
      bio: this.bio,
      status: this.status! as number,
      sends: this.sends?.map((send: Send) => send.docRef),
      following: this.following?.map((user: User) => user.docRef),
      followers: this.followers?.map((user: User) => user.docRef),
    };
    await setDoc(this.docRef!, data, { merge: true });
  }

  public async followUser(other: User) {
    if (
      (await this.getFollowing()).some(
        (user: User) => user.docRef?.path === other.docRef?.path
      )
    )
      return;
    this.following?.push(other);
    await other.addFollower(this);
    await this.pushUpdateToFirestore();
  }

  private async addFollower(other: User) {
    if (
      (await this.getFollowers()).some(
        (user: User) => user.docRef?.path === other.docRef?.path
      )
    )
      return;
    this.followers?.push(other);
    await this.pushUpdateToFirestore();
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
