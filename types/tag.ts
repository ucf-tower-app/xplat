/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { LazyObject } from './common';

export class Tag extends LazyObject {
  private name: string | undefined;
  private description: string | undefined;

  private async getData() {
    if (this.hasData) return;

    const data = await this.getDocumentData();
    if (data !== undefined) {
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
