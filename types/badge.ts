/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { DocumentData } from 'firebase/firestore';
import { LazyObject } from './types';

export class Badge extends LazyObject {
  public name: string | undefined;
  public description: string | undefined;

  public initWithDocumentData(data: DocumentData) {
    this.name = data.name;
    this.description = data.description;

    this.hasData = true;
  }
  // ======================== Trivial Getters Below ========================

  /** getName
   */
  public async getName() {
    if (!this.hasData) await this.getData();
    return this.name!;
  }

  /** getDescription
   */
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
