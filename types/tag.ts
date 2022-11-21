/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { LazyObject } from './common';
import { getDoc } from 'firebase/firestore';

export class Tag extends LazyObject {
  private name: string | undefined;
  private description: string | undefined;

  private async getData() {
    if (this.hasData) return;
    const docSnap = await getDoc(this.docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();

      this.name = data.name;
      this.description = data.description;

      this.hasData = true;
    }
  }

  public async getName() {
    if (!this.hasData) await this.getData();
    return this.name!;
  }

  public async getDescription() {
    if (!this.hasData) await this.getData();
    return this.description!;
  }
}
