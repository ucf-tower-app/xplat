/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { LazyObject, UserStatus } from './common';
import { DocumentReference, DocumentData, getDoc } from 'firebase/firestore';
import { Send } from './types';

export class User extends LazyObject {
  private username: string | undefined;
  private passwordHash: string | undefined;
  private bio: string | undefined;
  private status: UserStatus | undefined;
  private sends: Send[] | undefined;
  private following: User[] | undefined;
  private followers: User[] | undefined;

  private async getData() {
    if (this.hasData) return;
    const docSnap = await getDoc(this.docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();

      this.username = data.username;
      this.passwordHash = data.passwordHash;
      this.bio = data.bio;
      this.status = data.status as UserStatus;
      this.sends = data.sends.map(
        (ref: DocumentReference<DocumentData>) => new Send(ref)
      );
      this.following = data.following.map(
        (ref: DocumentReference<DocumentData>) => new User(ref)
      );
      this.followers = data.followers.map(
        (ref: DocumentReference<DocumentData>) => new User(ref)
      );

      this.hasData = true;
    }
  }

  public async getUsername() {
    if (!this.hasData) await this.getData();
    return this.username!;
  }

  public async getPasswordHash() {
    if (!this.hasData) await this.getData();
    return this.passwordHash!;
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
