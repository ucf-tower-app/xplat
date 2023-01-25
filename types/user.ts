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
import { isKnightsEmail } from '../api';
import {
  Comment,
  LazyObject,
  LazyStaticImage,
  Post,
  RouteClassifier,
  RouteType,
  Send,
  UserStatus,
  containsRef,
  removeRef,
} from './types';

export class User extends LazyObject {
  // Expected and required when getting data
  public username?: string;
  public email?: string;
  public displayName?: string;
  public bio?: string;
  public status?: UserStatus;

  // Filled with defaults if not present when getting data
  public sends?: Send[];
  public following?: User[];
  public followers?: User[];
  public posts?: Post[];
  public avatar?: LazyStaticImage;
  public comments?: Comment[];
  public totalPostSizeInBytes?: number;
  public totalSends?: Map<RouteType, number>;
  public bestSends?: Map<RouteType, number>;

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

    this.totalSends = new Map(
      Object.entries(data.totalSends ?? {}).map((a) => a as [RouteType, number])
    );
    this.bestSends = new Map(
      Object.entries(data.bestSends ?? {}).map((a) => a as [RouteType, number])
    );

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
      const cacheDocRef = doc(db, 'caches', 'users');

      // Reads
      const thisUpdate = this.updateWithTransaction(transaction);

      await thisUpdate;
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

      transaction.update(cacheDocRef, {
        allUsers: arrayRemove({
          username: this.username!,
          displayName: this.displayName!,
          ref: this.docRef!,
        }),
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

  /** approveOtherUser
   * Approve another user, if this is an employee or higher and the other user is not Approved or higher
   * @param other: The user to approve
   * @remarks Updates other's status
   */
  public async approveOtherUser(other: User) {
    await this.checkIfSignedIn();

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

  /** promoteOtherToEmployee
   * Promote a user to Employee, if this is a manager
   * @param other: The user to promote
   * @remarks Updates other's status
   */
  public async promoteOtherToEmployee(other: User) {
    await this.checkIfSignedIn();

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

  /** promoteOtherToManager
   * Promote a user to Manager, if this is a manager. Downgrades this to employee.
   * @param other: The user to promote
   * @remarks Updates this and other's statuses
   */
  public async promoteOtherToManager(password: string, other: User) {
    await this.checkIfSignedIn();

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

  /** demoteEmployeeToApproved
   * Downgrade an employee to Approved, if this is a manager
   * @param other: The user to demote
   * @remarks Updates other's status
   */
  public async demoteEmployeeToApproved(other: User) {
    await this.checkIfSignedIn();

    return runTransaction(db, async (transaction) => {
      await Promise.all([
        this.updateWithTransaction(transaction),
        other.updateWithTransaction(transaction),
      ]);
      if (
        this.status! >= UserStatus.Manager &&
        other.status! == UserStatus.Employee
      ) {
        other.status = UserStatus.Approved;
        transaction.update(other.docRef!, { status: UserStatus.Approved });
      }
    });
  }

  /** demoteToVerified
   * Downgrade an employee to an Verified employee, if this is an employee.
   * This essentially sets a user to read-only, and will serve as a soft ban.
   * @param other: The user to demote
   * @remarks Updates other's status
   */
  public async demoteToVerified(other: User) {
    await this.checkIfSignedIn();

    return runTransaction(db, async (transaction) => {
      await Promise.all([
        this.updateWithTransaction(transaction),
        other.updateWithTransaction(transaction),
      ]);
      if (
        this.status! >= UserStatus.Manager &&
        other.status! <= UserStatus.Employee
      ) {
        other.status = UserStatus.Verified;
        transaction.update(other.docRef!, { status: UserStatus.Verified });
      }
    });
  }

  /** checkIfSignedIn
   * Checks if this Tower User is the current auth user.
   * @returns A resolved promise if this is the current auth user.
   */
  public async checkIfSignedIn(): Promise<void> {
    if (!auth.currentUser) return Promise.reject('Not signed in!');
    if (auth.currentUser.uid != this.docRef!.id)
      return Promise.reject(
        'Cannot perform this action on behalf of someone else.'
      );
  }

  public verifyEmailWithinTransaction(email: string, transaction: Transaction) {
    if (isKnightsEmail(email)) this.status = UserStatus.Approved;
    else this.status = UserStatus.Verified;
    transaction.update(this.docRef!, { status: this.status });
  }

  /** getBestSendClassifier
   * Get the best send for a given type
   * @param type: The query type
   * @returns A RouteClassifier, or undefined
   */
  public async getBestSendClassifier(type: RouteType) {
    if (!this.hasData) await this.getData();
    const grade = this.bestSends!.get(type);
    if (grade) return new RouteClassifier(grade, type);
  }

  /** getTotalSends
   * Get the number of sends for a given type
   * @param type: The query type
   */
  public async getTotalSends(type: RouteType) {
    if (!this.hasData) await this.getData();
    return this.totalSends!.get(type) ?? 0;
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
