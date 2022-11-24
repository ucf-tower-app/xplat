/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { DocumentData } from 'firebase/firestore';
import { LazyObject } from './common';

export class Badge extends LazyObject {
  protected name: string | undefined;
  protected description: string | undefined;

  protected initWithDocumentData(data: DocumentData) {
    this.name = data.name;
    this.description = data.description;

    this.hasData = true;
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

export class BadgeMock extends Badge {
  constructor(name: string, description: string) {
    super();
    this.name = name;
    this.description = description;

    this.hasData = true;
  }
}
