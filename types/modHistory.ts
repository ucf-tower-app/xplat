/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { DocumentData } from 'firebase/firestore';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { LazyObject, User } from '../types';

export class ModHistory extends LazyObject {
  public userModerated?: User;
  public userEmail?: String;
  public mod?: User;
  public modReason?: String;
  public timestamp?: Date;

  public initWithDocumentData(data: DocumentData): void {
    this.userModerated = new User(data.user);
    this.userEmail = new String(data.userEmail);
    this.mod = new User(data.mod);
    this.modReason = new String(data.modReason);
    this.timestamp = new Date(
      data.timestamp.seconds * 1000 + data.timestamp.nanoseconds / 1000000
    );

    this.hasData = true;
  }

  // ======================== Trivial Getters Below ========================

  /** getUserModerated
   */
  public async getUserModerated() {
    if (!this.hasData) await this.getData();
    return this.userModerated!;
  }

  /** getUserEmail
   */
  public async getUserEmail() {
    if (!this.hasData) await this.getData();
    return this.userEmail!;
  }

  /** getMod
   */
  public async getMod() {
    if (!this.hasData) await this.getData();
    return this.mod!;
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

}

export class ModHistoryMock extends ModHistory {
  constructor(userModerated: User, userEmail: String, mod: User, modReason: String, timestamp: Date) {
    super();
    this.userModerated = userModerated;
    this.userEmail = userEmail;
    this.mod = mod;
    this.modReason = modReason;
    this.timestamp = timestamp;

    this.hasData = true;
    this._idMock = uuidv4();
  }
}
