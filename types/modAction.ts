/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { DocumentData } from 'firebase/firestore';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { LazyObject, User } from '../types';

export class ModAction extends LazyObject {
  public userModerated?: User;
  public mod?: User;
  public modReason?: String;
  public timestamp?: Date;

  public initWithDocumentData(data: DocumentData): void {
    this.userModerated = new User(data.userModerated);
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

export class ModActionMock extends ModAction {
  constructor(
    userModerated: User,
    mod: User,
    modReason: String,
    timestamp: Date
  ) {
    super();
    this.userModerated = userModerated;
    this.mod = mod;
    this.modReason = modReason;
    this.timestamp = timestamp;

    this.hasData = true;
    this._idMock = uuidv4();
  }
}
