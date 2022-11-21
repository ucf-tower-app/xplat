/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { LazyObject } from './common';
import { getDoc } from 'firebase/firestore';
import { User } from './types';

export class Comment extends LazyObject {
  private author: User | undefined;
  private timestamp: Date | undefined;
  private textContent: string | undefined;

  private async getData() {
    if (this.hasData) return;
    const docSnap = await getDoc(this.docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();

      this.author = new User(data.author);
      this.timestamp = data.timestamp;
      this.textContent = data.textContent;

      this.hasData = true;
    }
  }

  public async getAuthor() {
    if (!this.hasData) await this.getData();
    return this.author!;
  }

  public async getTimestamp() {
    if (!this.hasData) await this.getData();
    return this.timestamp!;
  }

  public async getTextContent() {
    if (!this.hasData) await this.getData();
    return this.textContent!;
  }
}
