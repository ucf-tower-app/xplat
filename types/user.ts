/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  EmailAuthProvider,
  deleteUser,
  reauthenticateWithCredential,
  updateEmail,
  updatePassword,
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
  getDocs,
  orderBy,
  query,
  refEqual,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from 'firebase/storage';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import {
  DEFAULT_AVATAR_PATH,
  DEFAULT_BIO,
  DEFAULT_DISPLAY_NAME,
  auth,
  db,
  storage,
} from '../Firebase';
import { isKnightsEmail, validDisplayname } from '../api';
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
} from '../types';

export interface FetchedUser {
  docRefId: string;
  username: string;
  email: string;
  displayName: string;
  bio: string;
  status: UserStatus;
  avatarUrl: string;
  followingList: User[];
  totalPostSizeInBytes: number;
  bestBoulder: RouteClassifier | undefined;
  bestToprope: RouteClassifier | undefined;
  totalSends: number;
  userObject: User;
}
export class User extends LazyObject {
  // Expected and required when getting data
  public username?: string;
  public email?: string;
  public displayName?: string;
  public bio?: string;
  public status?: UserStatus;

  // Filled with defaults if not present when getting data
  public following?: User[];
  public followers?: User[];
  public avatar?: LazyStaticImage;
  public totalPostSizeInBytes?: number;
  public totalSends?: Map<RouteType, number>;
  public bestSends?: Map<RouteType, number>;
  public reports?: User[];
  public noSpoilers?: boolean;

  public initWithDocumentData(data: DocumentData): void {
    this.username = data.username;
    this.email = data.email;
    this.displayName = data.displayName;
    this.bio = data.bio;
    this.status = data.status as UserStatus;

    this.following = (data.following ?? []).map(
      (ref: DocumentReference<DocumentData>) => new User(ref)
    );
    this.followers = (data.followers ?? []).map(
      (ref: DocumentReference<DocumentData>) => new User(ref)
    );

    this.avatar = new LazyStaticImage(data.avatar ?? DEFAULT_AVATAR_PATH);

    this.totalPostSizeInBytes = data.totalPostSizeInBytes ?? 0;

    this.totalSends = new Map(
      Object.entries(data.totalSends ?? {}).map((a) => a as [RouteType, number])
    );
    this.bestSends = new Map(
      Object.entries(data.bestSends ?? {}).map((a) => a as [RouteType, number])
    );
    this.reports = (data.reports ?? []).map(
      (ref: DocumentReference<DocumentData>) => new User(ref)
    );
    this.noSpoilers = data.noSpoilers ?? true;

    this.hasData = true;
  }

  /** addReport
   * Add this user's report to specified content
   * @param content: the post or comment to be reported
   */
  public async addReport(content: Post | Comment | User) {
    // check that the content to be reported isn't from an employee/manager, we don't want to automod them
    if ((await (await content.getAuthor()).getStatus()) >= UserStatus.Employee)
      return Promise.reject('Cant report an employees content');

    if (!content.hasData) await content.getData();

    // if already reported or already has a significant number of reports (arbitrary), return
    if ((await this.alreadyReported(content)) || content.reports?.length! > 7)
      return;

    // update client side
    content.reports?.push(this);

    // update server side
    const newReportDocRef = doc(collection(db, 'reports'));

    return runTransaction(db, async (transaction: Transaction) => {
      transaction.set(newReportDocRef, {
        reporter: this.docRef!,
        reported:
          content instanceof User ? content.getUsername() : content.getAuthor(),
        timestamp: serverTimestamp(),
        content: content.docRef!,
      });
      transaction.update(content.docRef!, {
        reports: arrayUnion(this.docRef!),
      });
    });
  }

  /** removeReport
   * Remove this user's report of specified content
   * This is for users to remove their own reports, employees use removeAllReports.
   * @param content: the post or comment to be unreported
   */
  public async removeReport(content: Post | Comment) {
    if (!content.hasData) await content.getData();

    // if not reported, return
    if (await !this.alreadyReported(content)) return;

    // update client side
    content.reports = content.reports?.filter(
      (report) => !refEqual(report.docRef!, this.docRef!)
    );

    // update server side
    const q = await getDocs(
      query(
        collection(db, 'reports'),
        where('reporter', '==', this.docRef!),
        where('content', '==', content.docRef!)
      )
    );
    const reportDocRef = q.docs[0].ref;
    return runTransaction(db, async (transaction: Transaction) => {
      transaction.delete(reportDocRef);
      transaction.update(content.docRef!, {
        reports: arrayRemove(this.docRef!),
      });
    });
  }

  /** alreadyReported
   * Checks if this  user has already reported the specified content
   * @returns true if this user has already reported the content, false otherwise
   */
  public async alreadyReported(content: Post | Comment | User) {
    if (!content.hasData) await content.getData();
    return containsRef(content.reports!, this);
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

    return Promise.all([
      updateDoc(this.docRef!, {
        following: arrayUnion(other.docRef),
      }).then(() => this.following!.push(other)),
      updateDoc(other.docRef!, { followers: arrayUnion(this.docRef) }),
    ]);
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
    return Promise.all([
      updateDoc(this.docRef!, {
        following: arrayRemove(other.docRef),
      }).then(() => removeRef(this.following!, other)),
      updateDoc(other.docRef!, { followers: arrayRemove(this.docRef) }),
    ]);
  }

  /** delete
   * Delete this user's own account. Requires that the user to be deleted is the current auth user.
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
      this.followers?.forEach((user) =>
        transaction.update(user.docRef!, {
          following: arrayRemove(this.docRef!),
        })
      );
    });
    console.log('Main transaction done');

    await deleteDoc(this.docRef!);
    console.log('Document deleted');
    await deleteUser(auth.currentUser!);
    console.log('Auth deleted');
  }

  /** clearAllReports
   * Clear all reports on this piece of content.
   * @param content: the post, comment, or user to be cleared of all current reports
   */
  public async clearAllReports(content: Post | Comment | User) {
    await this.checkIfSignedIn();
    if (this.status! < UserStatus.Employee)
      return Promise.reject('Not an employee, cant moderate!');

    content.getData();

    // update client side by deleting all reports from the content's report array
    content.reports = content.reports?.filter(
      (report) => !refEqual(report.docRef!, this.docRef!)
    );

    // update server side: get all reports on this content from the reports collection
    const q = await getDocs(
      query(collection(db, 'reports'), where('content', '==', content.docRef!))
    );
    // run a transaction that deletes all reports found in this query
    return runTransaction(db, async (transaction: Transaction) => {
      q.docs.forEach((reportDoc) => {
        // delete all from reports collection
        transaction.delete(reportDoc.ref);
        // delete all from the content's report array
        transaction.update(content.docRef!, {
          reports: arrayRemove(reportDoc.data().reporter),
        });
      });
    });
  }

  /** deleteReportedContent
   * Delete a piece of reported content, as well as its reports.
   * This doesn't ban users.
   * Employees should specify a reason as to why they took action, this will be held in a modHistory collection.
   * @param content: the post, comment, or user to be cleared of all current reports
   */
  public async deleteReportedContent(
    content: Post | Comment | User,
    modReason: string
  ) {
    await this.checkIfSignedIn();
    if (this.status! < UserStatus.Employee)
      return Promise.reject('Not an employee, cant moderate!');

    if (!content.hasData) await content.getData();

    this.clearAllReports(content);
    // if content is a post or comment, delete it.
    if (content instanceof Post || content instanceof Comment) content.delete();
    // if content is a user, remove their avatar & bio & displayname.
    else if (content instanceof User) {
      content.deleteAvatar();
      content.setBio(
        'My profile content got deleted by a moderator and I am so embarrassed.'
      );
      content.setDisplayName('Disappointment');
    }

    // add a modHistory entry
    const modHistoryDocRef = doc(db, 'modHistory');
    return setDoc(modHistoryDocRef, {
      userModerated: (await content.getAuthor()).username,
      userEmail: (await content.getAuthor()).email,
      mod: this.docRef,
      modReason: modReason,
      timestamp: serverTimestamp(),
    });
  }

  /** banUser
   * Ban a user, as well as delete all their content. Keeps their account/email in auth.
   * Employees should specify a reason as to why they took action, this will be held in a modHistory collection.
   * @param user: the user to be banned
   * @param modReason: the reason for the ban
   * @param password: the user's auth password. Required by auth.
   */
  public async banUser(user: User, modReason: string, password: string) {
    await this.checkIfSignedIn();
    if (this.status! < UserStatus.Employee)
      return Promise.reject('Not an employee, cant moderate!');

    await reauthenticateWithCredential(
      auth.currentUser!,
      EmailAuthProvider.credential(this.email!, password)
    );

    user.getData();

    // delete all content by specified user WITHOUT deleteing their account
    const preTasks: Promise<any>[] = [];

    if (user.avatar && !user.avatar.pathEqual(DEFAULT_AVATAR_PATH))
      preTasks.push(deleteObject(user.avatar.getStorageRef()));

    await Promise.all(preTasks);
    console.log('Pre-tasks done');

    // Now, all comments and posts we've ever made have *probably* been deleted.
    // However, to be sure, we'll collect some tasks to do after the main transaction.
    await runTransaction(db, async (transaction) => {
      // Definitions
      const cacheDocRef = doc(db, 'caches', 'users');

      // Reads
      await user.updateWithTransaction(transaction);

      // Writes
      transaction.update(cacheDocRef, {
        allUsers: arrayRemove({
          username: user.username!,
          displayName: user.displayName!,
          ref: user.docRef!,
        }),
      });
    });
    console.log('Main transaction done');

    // update user status to banned
    await runTransaction(db, async (transaction: Transaction) => {
      await user.updateWithTransaction(transaction);
      user.status = UserStatus.Banned;
      transaction.update(user.docRef!, { status: UserStatus.Banned });
    });
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

  /** changePassword
   * Change password
   * @param oldPassword
   * @param newPassword
   */
  public async changePassword(oldPassword: string, newPassword: string) {
    await this.checkIfSignedIn();
    await reauthenticateWithCredential(
      auth.currentUser!,
      EmailAuthProvider.credential(this.email!, oldPassword)
    );
    return updatePassword(auth.currentUser!, newPassword);
  }

  public async changeEmail(
    oldEmail: string,
    newEmail: string,
    password: string
  ) {
    await this.checkIfSignedIn();
    await this.getData();
    await reauthenticateWithCredential(
      auth.currentUser!,
      EmailAuthProvider.credential(this.email!, password)
    );
    if (this.email! !== oldEmail)
      return Promise.reject('Must provide the correct old email!');
    if (this.status! === UserStatus.Manager)
      return Promise.reject(
        'Unable to delete manager account: Please ensure there are other manager accounts and demote your own before deleting.'
      );
    if (isKnightsEmail(oldEmail))
      return Promise.reject(
        "Unable to change an account's email which is using a knights email."
      );

    return updateEmail(auth.currentUser!, newEmail).then(() => {
      updateDoc(this.docRef!, {
        email: newEmail,
        status: UserStatus.Unverified,
      });
    });
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

  /** getTotalSendsByType
   * Get the number of sends for a given type
   * @param type: The query type
   */
  public async getTotalSendsByType(type: RouteType) {
    if (!this.hasData) await this.getData();
    return this.totalSends!.get(type) ?? 0;
  }

  /** getTotalSends
   * Get the number of sends for all types
   * @param type: The query type
   */
  public async getTotalSends() {
    if (!this.hasData) await this.getData();
    return (
      (await this.getTotalSendsByType(RouteType.Boulder)) +
      (await this.getTotalSendsByType(RouteType.Toprope)) +
      (await this.getTotalSendsByType(RouteType.Competition)) +
      (await this.getTotalSendsByType(RouteType.Traverse)) +
      (await this.getTotalSendsByType(RouteType.Leadclimb))
    );
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
  }

  /** setAvatar
   * Set this user's avatar.
   * @param avatar: The user's avatar
   * @throws if the new avatar is over 100k
   * @throws if this is not the signed in user
   */
  public async setAvatar(avatar: Blob) {
    await this.checkIfSignedIn();

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

  /** setAvatarToDefault
   * Set this user's avatar to the default avatar.
   * For functions like reporting a user where we don't want to remove their reported avatar from the DB yet
   */
  public async setAvatarToDefault() {
    await this.checkIfSignedIn();

    return runTransaction(db, async (transaction) => {
      await this.updateWithTransaction(transaction);
      this.avatar = new LazyStaticImage(DEFAULT_AVATAR_PATH);
      transaction.update(this.docRef!, {
        avatar: DEFAULT_AVATAR_PATH,
      });
    });
  }

  public async setBio(bio: string) {
    await this.checkIfSignedIn();
    return updateDoc(this.docRef!, { bio: bio }).then(() => (this.bio = bio));
  }

  public async setDisplayName(displayName: string) {
    await this.checkIfSignedIn();
    if (this.displayName! === displayName) return;
    if (!validDisplayname(displayName))
      return Promise.reject('Invalid Display Name!');

    return runTransaction(db, async (transaction) => {
      const cacheDocRef = doc(db, 'caches', 'users');

      transaction
        .update(cacheDocRef, {
          allUsers: arrayRemove({
            username: this.username!,
            displayName: this.displayName!,
            ref: this.docRef!,
          }),
        })
        .update(cacheDocRef, {
          allUsers: arrayUnion({
            username: this.username!,
            displayName: displayName,
            ref: this.docRef!,
          }),
        })
        .update(this.docRef!, { displayName: displayName });
    }).then(() => (this.displayName = displayName));
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

  /** checkShouldBeHidden
   * Checks if this user's avatar, bio, and display name should be hidden.
   * @returns true if this content should be hidden, false if not
   */
  public async checkShouldBeHidden() {
    if (!this.hasData) await this.getData();
    return this.reports!.length >= 5;
  }

  /** hideProfileContent
   * Client-side setting of profile content to be default avatar & under review.
   * No public shaming like "under review", just set to defaults.
   */
  public async hideProfileContent() {
    if (!this.hasData) await this.getData();
    this.avatar = new LazyStaticImage(DEFAULT_AVATAR_PATH);
    this.bio = "I'm a new climber!";
    this.displayName = 'Tower Climber';
  }

  // ======================== Fetchers and Builders ========================

  public async fetch() {
    let shouldBeHidden: Boolean = await this.checkShouldBeHidden();

    return {
      docRefId: this.docRef!.id,
      username: await this.getUsername(),
      email: await this.getEmail(),
      status: await this.getStatus(),
      displayName: shouldBeHidden
        ? DEFAULT_DISPLAY_NAME
        : await this.getDisplayName(),
      bio: shouldBeHidden ? DEFAULT_BIO : await this.getBio(),
      avatarUrl: shouldBeHidden
        ? getDownloadURL(ref(storage, DEFAULT_AVATAR_PATH))
        : await this.getAvatarUrl(),
      followingList: this.following ?? [],
      followersList: this.followers ?? [],
      totalPostSizeInBytes: await this.getTotalPostSizeInBytes(),
      bestBoulder: await this.getBestSendClassifier(RouteType.Boulder),
      bestToprope: await this.getBestSendClassifier(RouteType.Toprope),
      totalSends: await this.getTotalSends(),
      postsCursor: this.getPostsCursor(),
      followersCursor: this.getFollowersCursor(),
      followingCursor: await this.getFollowingCursor(),
      userObject: this,
    } as FetchedUser;
  }

  public buildFetcher() {
    return async () => this.getData().then(() => this.fetch());
  }

  public static buildFetcherFromDocRefId(docRefId: string) {
    return new User(doc(db, 'users', docRefId)).buildFetcher();
  }

  /** toggleNoSpoilers
   * Toggle whether or not the user wants spoilers.
   * @remarks use getNoSpoilers to get the current value
   * @throws if this is not the signed in user
   */
  public async toggleNoSpoilers() {
    await this.checkIfSignedIn();

    return updateDoc(this.docRef!, {
      noSpoilers: !(await this.getNoSpoilers()),
    }).then(() => (this.noSpoilers = !this.noSpoilers!));
  }

  // ======================== Trivial Getters Below ========================

  /** getAuthor
   * @returns this user :)
   * @remarks this is here to make User work cleanly with reporting functions, avoids ternary operators
   */
  public getAuthor() {
    return this;
  }

  /** getNoSpoilers
   * @returns true if the user doesn't want spoilers
   */
  public async getNoSpoilers() {
    if (!this.hasData) await this.getData();
    return this.noSpoilers!;
  }

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
}

export class UserMock extends User {
  constructor(
    username: string,
    email: string,
    displayName: string,
    bio: string,
    status: UserStatus,
    following: User[],
    avatar?: LazyStaticImage,
    reports?: User[],
    noSpoilers?: boolean
  ) {
    super();
    this.username = username;
    this.email = email;
    this.displayName = displayName;
    this.bio = bio;
    this.status = status;
    this.following = following;
    this.avatar = avatar;
    this.reports = reports;
    this.noSpoilers = noSpoilers;

    this.hasData = true;
    this._idMock = uuidv4();
  }

  public addFollowing(following: User[]) {
    this.following = this.following?.concat(following);
  }
}
