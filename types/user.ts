/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updateEmail,
  updatePassword,
} from 'firebase/auth';
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  DocumentData,
  DocumentReference,
  getDocs,
  orderBy,
  query,
  refEqual,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  Transaction,
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
import { isKnightsEmail, validDisplayname } from '../api';
import {
  auth,
  db,
  DEFAULT_AVATAR_PATH,
  DEFAULT_BIO,
  DEFAULT_DISPLAY_NAME,
  storage,
} from '../Firebase';
import {
  ArrayCursor,
  Comment,
  containsRef,
  LazyObject,
  LazyStaticImage,
  Post,
  QueryCursor,
  removeRef,
  Report,
  RouteClassifier,
  RouteType,
  Send,
  UserStatus,
} from '../types';

export interface FetchedUser {
  docRefId: string;
  username: string;
  displayName: string;
  bio: string;
  status: UserStatus;
  avatarUrl: string;
  followingList: User[];
  followersList: User[];
  totalPostSizeInBytes: number;
  bestBoulder: RouteClassifier | undefined;
  bestToprope: RouteClassifier | undefined;
  totalSends: number;
  userObject: User;
}

export enum UserActionError {
  EmployeeReport = "Can't report an employee's content!",
  NotSignedIn = 'This action requires being signed in!',
  NotYourUser = 'You cannot perform this action on behalf of another user',
  NotAnEmployee = 'This action can only be performed by employees',
  IncorrectOldEmail = 'Must provide your old email!',
  MusntBeManager = 'Unable to perform this action as a manager account. Please ensure there are other manager accounts and demote this account.',
  AlreadyKnights = "Unable to change an account's email which is already using a knights email.",
  AvatarTooLarge = 'Avatar too large!',
  InvalidDisplayName = 'InvalidDisplayName',
}

export class User extends LazyObject {
  // Expected and required when getting data
  public username?: string;
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
      throw UserActionError.EmployeeReport;

    if (!content.hasData) await content.getData();

    // if already reported or already has a significant number of reports (arbitrary), return
    if ((await this.alreadyReported(content)) || content.reports?.length! > 7)
      return;

    // update client side
    content.reports?.push(this);

    // update server side
    const newReportDocRef = doc(collection(db, 'reports'));

    return runTransaction(db, async (transaction: Transaction) => {
      const rep = await content.getAuthor();
      transaction.set(newReportDocRef, {
        reporter: this.docRef!,
        reported: rep.docRef!,
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

  /** getReportsCursor
   * get a QueryCursor for a Comment's reports starting from most recent
   */
  public getReportsCursor() {
    return new QueryCursor(
      Report,
      5,
      collection(db, 'reports'),
      where('reporter', '==', this.docRef!),
      orderBy('timestamp', 'desc')
    );
  }

  /** clearEffects
   * delete all reports, posts, and comments by this user
   *
   */
  public async clearEffects() {
    if (!this.docRef) return;
    const tasks: any[] = [];

    // delete all their reports
    (
      await this.getReportsCursor().________getAll_CLOWNTOWN_LOTS_OF_READS()
    ).forEach((rpt) => tasks.push(deleteDoc(rpt?.docRef!)));
    // delete all their posts, which also deletes posts' reports & comments & comments' reports
    (
      await this.getPostsCursor().________getAll_CLOWNTOWN_LOTS_OF_READS()
    ).forEach((post) => tasks.push(post?.delete()));
    // delete all ther comments, which also deletes comments' reports
    (
      await this.getCommentsCursor().________getAll_CLOWNTOWN_LOTS_OF_READS()
    ).forEach((cmt) => tasks.push(cmt?.delete()));

    await Promise.all(tasks);
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
    if (!auth.currentUser) throw UserActionError.NotSignedIn;
    if (auth.currentUser.uid != this.docRef!.id) UserActionError.NotYourUser;

    await this.getData(true);
    // Force update to have best non-guaranteed recent data
    await reauthenticateWithCredential(
      auth.currentUser!,
      EmailAuthProvider.credential(auth.currentUser!.email!, password)
    );

    const preTasks: Promise<any>[] = [];

    if (this.avatar && !this.avatar.pathEqual(DEFAULT_AVATAR_PATH))
      preTasks.push(deleteObject(this.avatar.getStorageRef()));

    // delete all posts, comments, and reports
    await this.clearEffects();

    await Promise.all(preTasks);

    // remove user from cache
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

    await deleteDoc(this.docRef!);
    await deleteUser(auth.currentUser!);
  }

  /** clearAllReports
   * Clear all reports on this piece of content.
   * @param content: the post, comment, or user to be cleared of all current reports
   */
  public async clearAllReports(content: Post | Comment | User) {
    await this.checkIfSignedIn();

    if (this.status! < UserStatus.Employee) throw UserActionError.NotAnEmployee;

    content.getData();

    // update client side by deleting all reports from the content's report array
    content.reports = content.reports?.filter(
      (report) => !refEqual(report.docRef!, this.docRef!)
    );

    // add a modHistory entry
    this.addModAction(
      await content.getAuthor(),
      this,
      'Cleared all reports on this content.'
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

    if (this.status! < UserStatus.Employee) throw UserActionError.NotAnEmployee;

    if (!content.hasData) await content.getData();

    let deletionPromises = [];
    deletionPromises.push(this.clearAllReports(content));
    // if content is a post or comment, delete it.
    if (content instanceof Post || content instanceof Comment)
      deletionPromises.push(content.delete());
    // if content is a user, remove their avatar & bio & displayname.
    else if (content instanceof User) {
      deletionPromises.push(content.deleteAvatar());
      deletionPromises.push(
        content.setBio(
          'My profile content got deleted by a moderator and I am so embarrassed.'
        )
      );
      deletionPromises.push(content.setDisplayName('Disappointment'));
    }

    // add a modHistory entry
    deletionPromises.push(
      this.addModAction(
        await content.getAuthor(),
        this,
        'Deleted reported content: ' + modReason
      )
    );

    await Promise.all(deletionPromises);
  }

  /** getDateMM_DD_YYYY
   * @returns the current date in the format MM_DD_YYYY
   */
  public async getDateMM_DD_YYYY() {
    const date = new Date();
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString();
    return `${month}_${day}_${year}`;
  }

  /** addModAction
   * Add a modAction array entry to the current day's doc in modHistory.
   * @remarks this function should not be called directly.
   * @param userModerated: the user who was moderated
   * @param moderator: the user who moderated
   * @param modReason: the reason for the moderation
   */
  public async addModAction(
    userModerated: User,
    moderator: User,
    modReason: String
  ) {
    const documentId = await this.getDateMM_DD_YYYY();
    const modHistoryDocRef = await doc(db, 'modHistory', documentId);

    // Creates doc or updates it with the new modAction
    await setDoc(
      modHistoryDocRef,
      {
        timestamp: Timestamp.now(),
        actions: arrayUnion({
          userModeratedUsername: await userModerated.getUsername(),
          moderatorUsername: await moderator.getUsername(),
          modReason: modReason,
          timestamp: Timestamp.now(),
          userModerated: userModerated.docRef!,
          moderator: moderator.docRef!,
        }),
      },
      { merge: true }
    );
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

    if (this.status! < UserStatus.Employee) throw UserActionError.NotAnEmployee;

    await reauthenticateWithCredential(
      auth.currentUser!,
      EmailAuthProvider.credential(auth.currentUser!.email!, password)
    );

    user.getData();

    // delete all content by specified user WITHOUT deleteing their account
    const preTasks: Promise<any>[] = [];

    if (user.avatar && !user.avatar.pathEqual(DEFAULT_AVATAR_PATH))
      preTasks.push(deleteObject(user.avatar.getStorageRef()));

    // delete all posts, comments, and reports
    await this.clearEffects();

    await Promise.all(preTasks);

    // remove user from cache
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

    // update user status to banned
    await runTransaction(db, async (transaction: Transaction) => {
      await user.updateWithTransaction(transaction);
      user.status = UserStatus.Banned;
      transaction.update(user.docRef!, { status: UserStatus.Banned });
    });

    // add a modHistory entry
    this.addModAction(user, this, 'Banned user: ' + modReason);
  }

  /** approveOtherUser
   * Approve another user, if this is an employee or higher and the other user is not Approved or higher
   * @param other: The user to approve
   * @remarks Updates other's status
   */
  public async approveOtherUser(password: string, other: User) {
    await this.checkIfSignedIn();

    await reauthenticateWithCredential(
      auth.currentUser!,
      EmailAuthProvider.credential(auth.currentUser!.email!, password)
    );

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

      // add a modHistory entry
      this.addModAction(other, this, 'Promoted this user to approved.');
    });
  }

  /** promoteOtherToEmployee
   * Promote a user to Employee, if this is a manager
   * @param other: The user to promote
   * @remarks Updates other's status
   */
  public async promoteOtherToEmployee(password: string, other: User) {
    await this.checkIfSignedIn();

    await reauthenticateWithCredential(
      auth.currentUser!,
      EmailAuthProvider.credential(auth.currentUser!.email!, password)
    );

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

      // add a modHistory entry
      this.addModAction(other, this, 'Promoted this user to employee.');
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
      EmailAuthProvider.credential(auth.currentUser!.email!, password)
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

      // add a modHistory entry
      this.addModAction(other, this, 'Promoted this user to manager.');
    });
  }

  /** demoteEmployeeToApproved
   * Downgrade an employee to Approved, if this is a manager
   * @param other: The user to demote
   * @remarks Updates other's status
   */
  public async demoteEmployeeToApproved(password: string, other: User) {
    await this.checkIfSignedIn();

    await reauthenticateWithCredential(
      auth.currentUser!,
      EmailAuthProvider.credential(auth.currentUser!.email!, password)
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
        other.status = UserStatus.Approved;
        transaction.update(other.docRef!, { status: UserStatus.Approved });
      }

      // add a modHistory entry
      this.addModAction(other, this, 'Demoted this employee to approved.');
    });
  }

  /** demoteToVerified
   * Downgrade an employee to an Verified employee, if this is an employee.
   * This essentially sets a user to read-only, and will serve as a soft ban.
   * @param other: The user to demote
   * @remarks Updates other's status
   */
  public async demoteToVerified(password: string, other: User) {
    await this.checkIfSignedIn();

    await reauthenticateWithCredential(
      auth.currentUser!,
      EmailAuthProvider.credential(auth.currentUser!.email!, password)
    );

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

      // add a modHistory entry
      this.addModAction(other, this, 'Demoted this user to verified.');
    });
  }

  /** checkIfSignedIn
   * Checks if this Tower User is the current auth user.
   * @returns A resolved promise if this is the current auth user.
   */
  public async checkIfSignedIn(): Promise<void> {
    if (!auth.currentUser) throw UserActionError.NotSignedIn;
    if (auth.currentUser.uid != this.docRef!.id)
      throw UserActionError.NotYourUser;
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
      EmailAuthProvider.credential(auth.currentUser!.email!, oldPassword)
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
      EmailAuthProvider.credential(auth.currentUser!.email!, password)
    );
    if (auth.currentUser!.email! !== oldEmail)
      throw UserActionError.IncorrectOldEmail;
    if (this.status! === UserStatus.Manager)
      throw UserActionError.MusntBeManager;
    if (isKnightsEmail(oldEmail)) throw UserActionError.AlreadyKnights;

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

  /**
   * @deprecated Please don't use
   * @param email \
   * @param transaction
   */
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
  public getCommentsCursor() {
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

    if (avatar.size > 100000) throw UserActionError.AvatarTooLarge;

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
      throw UserActionError.InvalidDisplayName;

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
