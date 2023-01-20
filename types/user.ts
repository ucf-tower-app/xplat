/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  EmailAuthProvider,
  deleteUser,
  reauthenticateWithCredential,
} from 'firebase/auth';
import {
  DocumentData,
  DocumentReference,
  Transaction,
  arrayRemove,
  arrayUnion,
  deleteDoc,
  doc,
  runTransaction,
} from 'firebase/firestore';
import { deleteObject } from 'firebase/storage';
import { DEFAULT_AVATAR_PATH, auth, db } from '../Firebase';
import { LazyObject, UserStatus, containsRef } from './common';
import { Comment, LazyStaticImage, Post, Send } from './types';

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
  protected totalPostSizeInBytes?: number;

  public initWithDocumentData(data: DocumentData): void {
    this.username = data.username;
    this.email = data.email;
    this.displayName = data.displayName;
    this.bio = data.bio;
    this.status = data.status as UserStatus;
    this.posts = (data.posts ?? []).map(
      (ref: DocumentReference<DocumentData>) => new Post(ref)
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
    this.comments = (data.comments ?? []).map(
      (ref: DocumentReference<DocumentData>) => new Comment(ref)
    );
    this.avatar = new LazyStaticImage(data.avatarPath ?? DEFAULT_AVATAR_PATH);
    this.totalPostSizeInBytes = data.totalPostSizeInBytes ?? 0;

    this.hasData = true;
  }

  /** followUser
   * Follow a user.
   * @param other: The User to follow
   * @remarks both this and other's following and follower lists will be updated
   */
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

  /** delete
   * Delete a user. Requires that the user to be deleted is the current auth user.
   * Deletes all relevant effects from the user such as:
   * - Posts and Comments
   * - Avatar
   * - Cache entries
   * @param password: The user's auth password. Required by auth.
   */
  public async delete(password: string) {
    if (!auth.currentUser) return Promise.reject('Not signed in!');
    if (auth.currentUser.uid != this.docRef!.id)
      return Promise.reject(
        'Cannot delete User to which you are not signed in.'
      );
    await this.getData(true);
    // Force update to have best non-guaranteed recent data
    await reauthenticateWithCredential(
      auth.currentUser!,
      EmailAuthProvider.credential(this.email!, password)
    );

    const preTasks: Promise<any>[] = [];

    this.posts!.forEach((post) => {
      console.log(post);
      preTasks.push(post.delete());
    });
    this.comments!.forEach((comment) => preTasks.push(comment.delete()));

    if (this.avatar && !this.avatar.pathEqual(DEFAULT_AVATAR_PATH))
      preTasks.push(deleteObject(this.avatar.getStorageRef()));

    await Promise.all(preTasks);
    console.log('Pre-tasks done');

    // Now, all comments and posts we've ever made have *probably* been deleted.
    // However, to be sure, we'll collect some tasks to do after the main transaction.
    const postActions = await runTransaction(db, async (transaction) => {
      // Definitions
      const usernameCacheDocRef = doc(db, 'caches', 'users');

      // Reads
      const usernameCacheRead = transaction.get(usernameCacheDocRef);
      const thisUpdate = this.updateWithTransaction(transaction);

      await thisUpdate;
      const usernameMap = (await usernameCacheRead).data()!.usernameToUser;
      // Writes

      const postActions: { posts: Post[]; comments: Comment[] } = {
        posts: this.posts!,
        comments: this.comments!,
      };

      this.followers!.forEach((follower) =>
        transaction.update(follower.docRef!, {
          following: arrayRemove(this.docRef!),
        })
      );
      this.following!.forEach((following) =>
        transaction.update(following.docRef!, {
          followers: arrayRemove(this.docRef!),
        })
      );

      delete usernameMap[this.username!];

      transaction.update(usernameCacheDocRef, {
        usernameToUser: usernameMap,
      });

      return postActions;
    });
    console.log('Main transaction done');

    const postTasks: Promise<any>[] = [];
    postActions.posts.forEach((post) => postTasks.push(post.delete()));
    postActions.comments.forEach((comment) => postTasks.push(comment.delete()));

    await Promise.all(postTasks);
    console.log('Post-tasks done');
    await deleteDoc(this.docRef!);
    console.log('Document deleted');
    await deleteUser(auth.currentUser!);
    console.log('Auth deleted');
  }

  public async approveOtherUser(other: User) {
    if (!auth.currentUser) return Promise.reject('Not signed in!');
    if (auth.currentUser.uid != this.docRef!.id)
      return Promise.reject('Cannot approve users on behalf of someone else.');

    return runTransaction(db, async (transaction) => {
      await Promise.all([
        this.updateWithTransaction(transaction),
        other.updateWithTransaction(transaction),
      ]);
      if (
        this.status! >= UserStatus.Employee &&
        other.status! <= UserStatus.Verified
      ) {
        other.status = UserStatus.Approved;
        transaction.update(other.docRef!, { status: UserStatus.Approved });
      }
    });
  }

  public async promoteOtherToEmployee(other: User) {
    if (!auth.currentUser) return Promise.reject('Not signed in!');
    if (auth.currentUser.uid != this.docRef!.id)
      return Promise.reject('Cannot promote users on behalf of someone else.');

    return runTransaction(db, async (transaction) => {
      await Promise.all([
        this.updateWithTransaction(transaction),
        other.updateWithTransaction(transaction),
      ]);
      if (
        this.status! >= UserStatus.Manager &&
        other.status! <= UserStatus.Approved
      ) {
        other.status = UserStatus.Employee;
        transaction.update(other.docRef!, { status: UserStatus.Employee });
      }
    });
  }

  public async promoteOtherToManager(password: string, other: User) {
    if (!auth.currentUser) return Promise.reject('Not signed in!');
    if (auth.currentUser.uid != this.docRef!.id)
      return Promise.reject('Cannot promote users on behalf of someone else.');

    await reauthenticateWithCredential(
      auth.currentUser!,
      EmailAuthProvider.credential(this.email!, password)
    );

    return runTransaction(db, async (transaction) => {
      await Promise.all([
        this.updateWithTransaction(transaction),
        other.updateWithTransaction(transaction),
      ]);
      if (
        this.status! >= UserStatus.Manager &&
        other.status! == UserStatus.Employee
      ) {
        other.status = UserStatus.Manager;
        transaction.update(other.docRef!, { status: UserStatus.Manager });
        if (this.status! == UserStatus.Manager) {
          this.status! = UserStatus.Employee;
          transaction.update(this.docRef!, { status: UserStatus.Employee });
        }
      }
    });
  }

  // ======================== Trivial Getters Below ========================
  /** getPosts()
   */
  public async getPosts() {
    if (!this.hasData) await this.getData();
    return this.posts!;
  }

  /** getAvatarUrl()
   */
  public async getAvatarUrl() {
    if (!this.hasData) await this.getData();
    return this.avatar!.getImageUrl();
  }

  /** getTotalPostSizeInBytes()
   */
  public async getTotalPostSizeInBytes() {
    if (!this.hasData) await this.getData();
    return this.totalPostSizeInBytes!;
  }

  /** getUsername()
   */
  public async getUsername() {
    if (!this.hasData) await this.getData();
    return this.username!;
  }

  /** getEmail()
   */
  public async getEmail() {
    if (!this.hasData) await this.getData();
    return this.email!;
  }

  /** getDisplayName()
   */
  public async getDisplayName() {
    if (!this.hasData) await this.getData();
    return this.displayName!;
  }

  /** getBio()
   */
  public async getBio() {
    if (!this.hasData) await this.getData();
    return this.bio!;
  }

  /** getStatus()
   */
  public async getStatus() {
    if (!this.hasData) await this.getData();
    return this.status!;
  }

  /** getComments()
   */
  public async getComments() {
    if (!this.hasData) await this.getData();
    return this.comments!;
  }

  /** getSends()
   */
  public async getSends() {
    if (!this.hasData) await this.getData();
    return this.sends!;
  }

  /** getFollowing()
   */
  public async getFollowing() {
    if (!this.hasData) await this.getData();
    return this.following!;
  }

  /** getFollowers()
   */
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
