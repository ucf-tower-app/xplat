/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { DocumentData, getDoc } from 'firebase/firestore';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { LazyObject, User } from '../types';

type FetchedModAction = {
  userModeratedUsername: String;
  moderatorUsername: String;
  modReason: String;
  timestamp: Date;
  userModerated: User | undefined;
  moderator: User | undefined;
};

export class ModAction extends LazyObject {
  // Expected and required when getting data
  public userModeratedUsername?: String;
  public moderatorUsername?: String;
  public modReason?: String;
  public timestamp?: Date;

  // Might remain undefined even if has data
  public userModerated?: User;
  public moderator?: User;

  public initWithDocumentData(data: DocumentData): void {
    this.userModeratedUsername = data.userModeratedUsername;
    this.moderatorUsername = data.moderatorUsername;
    this.modReason = new String(data.modReason);
    this.timestamp = new Date(
      data.timestamp.seconds * 1000 + data.timestamp.nanoseconds / 1000000
    );

    // check if these users still exist in db
    getDoc(data.userModerated).then((docSnap) => {
      if (docSnap.exists()) {
        this.userModerated = new User(data.userModerated);
      }
    });
    getDoc(data.moderator).then((docSnap) => {
      if (docSnap.exists()) {
        this.moderator = new User(data.moderator);
      }
    });

    this.hasData = true;
  }

  // ======================== Trivial Getters Below ========================

  /** hasUserModerated
   */
  public async hasUserModerated() {
    if (!this.hasData) await this.getData();
    return this.userModerated !== undefined;
  }

  /** getUserModerated
   */
  public async getUserModerated() {
    if (!this.hasData) await this.getData();
    return this.userModerated!;
  }

  /** getUserModeratedUsername
   * @returns a string of the username
   * To be used only when the user moderated has been deleted
   */
  public async getUserModeratedUsername() {
    if (!this.hasData) await this.getData();
    return this.userModeratedUsername!;
  }

  /** hasModerator
   */
  public async hasModerator() {
    if (!this.hasData) await this.getData();
    return this.moderator !== undefined;
  }

  /** getModerator
   */
  public async getModerator() {
    if (!this.hasData) await this.getData();
    return this.moderator!;
  }

  /** getModeratorUsername
   * @returns a string of the username
   * To be used only when the moderator user has been deleted
   */
  public async getModeratorUsername() {
    if (!this.hasData) await this.getData();
    return this.moderatorUsername!;
  }

  /** getModReason
   */
  public async getModReason() {
    if (!this.hasData) await this.getData();
    return this.modReason!;
  }

  /** getTimestamp
   */
  public async getTimestamp() {
    if (!this.hasData) await this.getData();
    return this.timestamp!;
  }

  public async fetch() {
    if (!this.hasData) await this.getData();

    return {
      userModeratedUsername: this.userModeratedUsername!,
      moderatorUsername: this.moderatorUsername!,
      modReason: this.modReason!,
      timestamp: this.timestamp!,
      userModerated: this.userModerated,
      moderator: this.moderator,
    } as FetchedModAction;
  }
}

export class ModActionMock extends ModAction {
  constructor(
    userModeratedUsername: String,
    moderatorUsername: String,
    modReason: String,
    timestamp: Date,
    userModerated: User,
    moderator: User
  ) {
    super();
    this.userModeratedUsername = userModeratedUsername;
    this.moderatorUsername = moderatorUsername;
    this.modReason = modReason;
    this.timestamp = timestamp;
    this.userModerated = userModerated;
    this.moderator = moderator;

    this.hasData = true;
    this._idMock = uuidv4();
  }
}
