/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { containsRef, LazyObject, LazyStaticImage, removeRef, UserStatus } from './common';
import {
  DocumentReference,
  DocumentData,
  Transaction,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { runTransaction } from 'firebase/firestore';
import { Send, Post } from './types';
import { db, DEFAULT_AVATAR_PATH } from '../Firebase';

export class User extends LazyObject {
  // Expected and required when getting data
  protected username?: string;
  protected email?: string;
  protected displayName?: string;
  protected bio?: string;
  protected status?: UserStatus;

  // Filled with defaults if not present when getting data
  protected sends?: Send[];
  protected following?: User[];
  protected followers?: User[];
  protected posts?: Post[];
  protected avatar?: LazyStaticImage;
  protected comments?: Comment[];

  protected initWithDocumentData(data: DocumentData): void {
    this.username = data.username;
    this.email = data.email;
    this.displayName = data.displayName;
    this.bio = data.bio;
    this.status = data.status as UserStatus;
    this.posts = (data.posts ?? []).map(
      (ref: DocumentReference<DocumentData>) => new Send(ref)
    );
    this.sends = (data.sends ?? []).map(
      (ref: DocumentReference<DocumentData>) => new Send(ref)
    );
    this.following = (data.following ?? []).map(
      (ref: DocumentReference<DocumentData>) => new User(ref)
    );
    this.followers = (data.followers ?? []).map(
      (ref: DocumentReference<DocumentData>) => new User(ref)
    );
    this.avatar = new LazyStaticImage(data.avatarPath ?? DEFAULT_AVATAR_PATH);

    this.hasData = true;
  }

  public async followUser(other: User) {
    // If we already have data, might as well run the free short-circuit check.
    // We're going to run it anyways during the transaction, but if we can avoid it,
    // might as well do it now.
    if (this.hasData && containsRef(this.following!, other)) return;

    return runTransaction(db, async (transaction: Transaction) => {
      const thisSnap = await transaction.get(this.docRef!);
      const otherSnap = await transaction.get(other.docRef!);

      this.initWithDocumentData(thisSnap.data()!);
      other.initWithDocumentData(otherSnap.data()!);

      if (containsRef(this.following!, other)) return;

      this.following?.push(other);
      other.followers?.push(this);

      transaction.update(this.docRef!, {
        following: arrayUnion(other.docRef),
      });
      transaction.update(other.docRef!, {
        followers: arrayUnion(this.docRef),
      });
    });
  }

    /** unfollowUser
   * Unfollow a user.
   * @param other: The User to unfollow
   * @remarks both this and other's following and follower lists will be updated
   */
  public async unfollowUser(other: User) {
    // If this user has data and their following array doesn't contain the other user, return
    if (this.hasData && !containsRef(this.following!, other)) return;

    // Else run the transaction, which will get the data fresh and then run the same check and return if it fails
    return runTransaction(db, async (transaction: Transaction) => {
      const thisSnap = await transaction.get(this.docRef!);
      const otherSnap = await transaction.get(other.docRef!);

      this.initWithDocumentData(thisSnap.data()!);
      other.initWithDocumentData(otherSnap.data()!);

      if (!containsRef(this.following!, other)) return;

      // If we get here, we know that this user is following the other user
      // Update client-side
      removeRef(this.following!, other);
      removeRef(other.followers!, this);

      // Then update the db
      transaction.update(this.docRef!, {
        following: arrayRemove(other.docRef),
      });
      transaction.update(other.docRef!, {
        followers: arrayRemove(this.docRef),
      });
    });
  }

  public async getPosts() {
    if (!this.hasData) await this.getData();
    return this.posts!;
  }

  public async getAvatarUrl() {
    if (!this.hasData) await this.getData();
    return this.avatar!.getImageUrl();
  }

  public async getUsername() {
    if (!this.hasData) await this.getData();
    return this.username!;
  }

  public async getEmail() {
    if (!this.hasData) await this.getData();
    return this.email!;
  }

  public async getDisplayName() {
    if (!this.hasData) await this.getData();
    return this.displayName!;
  }

  public async getBio() {
    if (!this.hasData) await this.getData();
    return this.bio!;
  }

  public async getStatus() {
    if (!this.hasData) await this.getData();
    return this.status!;
  }

  public async getComments() {
    if (!this.hasData) await this.getData();
    return this.comments!;
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
    email: string,
    displayName: string,
    bio: string,
    status: UserStatus,
    sends: Send[],
    following: User[],
    followers: User[],
    avatar?: LazyStaticImage
  ) {
    super();
    this.username = username;
    this.email = email;
    this.displayName = displayName;
    this.bio = bio;
    this.status = status;
    this.sends = sends;
    this.following = following;
    this.followers = followers;
    this.avatar = avatar;

    this.hasData = true;
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
