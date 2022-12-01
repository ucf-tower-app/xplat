/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { LazyObject, UserStatus } from './common';
import {
  DocumentReference,
  DocumentData,
  Transaction,
} from 'firebase/firestore';
import { runTransaction } from 'firebase/firestore';
import { Send } from './types';
import { db } from '../Firebase';

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

  public async followUser(other: User) {
    // If we already have data, might as well run the free short-circuit check.
    // We're going to run it anyways during the transaction, but if we can avoid it,
    // might as well do it now.
    if (
      this.hasData &&
      (await this.getFollowing()).some(
        (user: User) => user.docRef?.path === other.docRef?.path
      )
    )
      return;

    return runTransaction(db, async (transaction: Transaction) => {
      const thisSnap = await transaction.get(this.docRef!);
      const otherSnap = await transaction.get(other.docRef!);

      this.initWithDocumentData(thisSnap.data()!);
      other.initWithDocumentData(otherSnap.data()!);

      if (
        this.following?.some(
          (user: User) => user.docRef?.path === other.docRef?.path
        ) ||
        other.followers?.some(
          (user: User) => user.docRef?.path === this.docRef?.path
        )
      )
        return;

      this.following?.push(other);
      other.followers?.push(this);

      transaction.update(this.docRef!, {
        following: this.following!.map((user: User) => user.docRef),
      });
      transaction.update(other.docRef!, {
        followers: other.followers!.map((user: User) => user.docRef),
      });
    });
  }

  public async getUsername() {
    if (!this.hasData) await this.getData();
    return this.username!;
  }

  public async getEmail() {
    if (!this.hasData) await this.getData();
    return this.email!;
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
