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
  collection,
  deleteDoc,
  doc,
  orderBy,
  runTransaction,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from 'firebase/storage';
import { DEFAULT_AVATAR_PATH, auth, db, storage } from '../Firebase';
import { isKnightsEmail } from '../api';
import {
  ArrayCursor,
  Comment,
  LazyObject,
  LazyStaticImage,
  Post,
  QueryCursor,
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
  public avatar?: LazyStaticImage;
  public totalPostSizeInBytes?: number;
  public totalSends?: Map<RouteType, number>;
  public bestSends?: Map<RouteType, number>;

  public initWithDocumentData(data: DocumentData): void {
    this.username = data.username;
    this.email = data.email;
    this.displayName = data.displayName;
    this.bio = data.bio;
    this.status = data.status as UserStatus;

    this.sends = (data.sends ?? []).map(
      (ref: DocumentReference<DocumentData>) => new Send(ref)
    );
    this.following = (data.following ?? []).map(
      (ref: DocumentReference<DocumentData>) => new User(ref)
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
   * @remarks this following list will be updated
   */
  public async followUser(other: User) {
    // If we already have data, might as well run the free short-circuit check.
    // We're going to run it anyways during the transaction, but if we can avoid it,
    // might as well do it now.
    if (!this.hasData) await this.getData();
    if (containsRef(this.following!, other)) return;
    this.following!.push(other);
    return updateDoc(this.docRef!, { following: arrayUnion(other.docRef) });
  }

  /** unfollowUser
   * Unfollow a user.
   * @param other: The User to unfollow
   * @remarks this following list will be updated
   */
  public async unfollowUser(other: User) {
    // If this user has data and their following array doesn't contain the other user, return
    if (!this.hasData) await this.getData();
    if (!containsRef(this.following!, other)) return;
    removeRef(this.following!, other);
    return updateDoc(this.docRef!, { following: arrayRemove(other.docRef) });
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

    if (this.avatar && !this.avatar.pathEqual(DEFAULT_AVATAR_PATH))
      preTasks.push(deleteObject(this.avatar.getStorageRef()));

    await Promise.all(preTasks);
    console.log('Pre-tasks done');

    // Now, all comments and posts we've ever made have *probably* been deleted.
    // However, to be sure, we'll collect some tasks to do after the main transaction.
    await runTransaction(db, async (transaction) => {
      // Definitions
      const cacheDocRef = doc(db, 'caches', 'users');

      // Reads
      await this.updateWithTransaction(transaction);

      // Writes
      transaction.update(cacheDocRef, {
        allUsers: arrayRemove({
          username: this.username!,
          displayName: this.displayName!,
          ref: this.docRef!,
        }),
      });
    });
    console.log('Main transaction done');

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

  /** getRecentSendsCursor
   * Get a QueryCursor for a User's sends ordered by most recent
   */
  public getRecentSendsCursor() {
    return new QueryCursor(
      Send,
      3,
      collection(db, 'sends'),
      where('user', '==', this.docRef!),
      orderBy('timestamp', 'desc')
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

  /** getPostsCursor
   * get a QueryCursor for a Users's posts starting from most recent
   */
  public getPostsCursor() {
    return new QueryCursor(
      Post,
      3,
      collection(db, 'posts'),
      where('author', '==', this.docRef!),
      orderBy('timestamp', 'desc')
    );
  }

  /** getFollowersCursor
   * get a QueryCursor for a Users's followers
   */
  public getFollowersCursor() {
    return new QueryCursor(
      User,
      5,
      collection(db, 'users'),
      where('following', 'array-contains', this.docRef!)
    );
  }

  /** getCommentsCursor()
   *  get a QueryCursor for a Users's comments starting from most recent
   */
  public async getCommentsCursor() {
    return new QueryCursor(
      Comment,
      5,
      collection(db, 'comments'),
      where('author', '==', this.docRef!),
      orderBy('timestamp', 'desc')
    );

  /** setAvatar
   * Set this user's avatar.
   * @param avatar: The user's avatar
   * @throws if the new avatar is over 100k
   * @throws if this is not the signed in user
   */
  public async setAvatar(avatar: Blob) {
    await this.checkIfSignedIn();

    console.log(avatar.size);
    if (avatar.size > 100_000) return Promise.reject('Avatar too large!');

    if (this.avatar && !this.avatar.pathEqual(DEFAULT_AVATAR_PATH))
      await deleteObject(this.avatar.getStorageRef());

    await uploadBytes(ref(storage, 'avatars/' + this.docRef!.id), avatar);
    return runTransaction(db, async (transaction) => {
      await this.updateWithTransaction(transaction);
      this.avatar = new LazyStaticImage('avatars/' + this.docRef!.id);
      transaction.update(this.docRef!, {
        avatar: 'avatars/' + this.docRef!.id,
      });
    });
  }

  /** deleteAvatar
   * Delete this user's avatar.
   * @throws if this is not the signed in user
   */
  public async deleteAvatar() {
    await this.checkIfSignedIn();
    if (this.avatar && !this.avatar.pathEqual(DEFAULT_AVATAR_PATH))
      await deleteObject(this.avatar.getStorageRef());
  }

  /** getAvatarUrl()
   */
  public async getAvatarUrl() {
    if (!this.hasData) {
      return getDownloadURL(ref(storage, 'avatars/' + this.docRef!.id));
    } else {
      return this.avatar!.getImageUrl();
    }
  }

  // ======================== Trivial Getters Below ========================

  /** getFollowingCursor
   * get an ArrayCursor for a User's following
   */
  public async getFollowingCursor() {
    if (!this.hasData) await this.getData();
    return new ArrayCursor(this.following!);
  }

  /** isFollowing
   */
  public async isFollowing(user: User) {
    if (!this.hasData) await this.getData();
    return containsRef(this.following!, user);
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

  /** getSends()
   */
  public async getSends() {
    if (!this.hasData) await this.getData();
    return this.sends!;
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
    this.avatar = avatar;

    this.hasData = true;
  }

  public addSends(sends: Send[]) {
    this.sends = this.sends?.concat(sends);
  }

  public addFollowing(following: User[]) {
    this.following = this.following?.concat(following);
  }
}
