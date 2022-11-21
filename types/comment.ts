/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { LazyObject } from './common';
import { User } from './types';

export class Comment extends LazyObject {
  private author: User | undefined;
  private timestamp: Date | undefined;
  private textContent: string | undefined;

  private async getData() {
    if (this.hasData) return;

    const data = await this.getDocumentData();
    if (data !== undefined) {
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
