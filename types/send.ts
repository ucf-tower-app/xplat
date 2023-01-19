/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { DocumentData } from 'firebase/firestore';
import { LazyObject } from './common';
import { Route } from './types';

export class Send extends LazyObject {
  protected attempts: number | undefined;
  protected timestamp: Date | undefined;
  protected route: Route | undefined;

  public initWithDocumentData(data: DocumentData): void {
    this.attempts = data.attempts;
    this.timestamp = data.timestamp;
    this.route = new Route(data.route);

    this.hasData = true;
  }

  public async getAttempts() {
    if (!this.hasData) await this.getData();
    return this.attempts!;
  }

  public async getTimestamp() {
    if (!this.hasData) await this.getData();
    return this.timestamp!;
  }

  public async getRoute() {
    if (!this.hasData) await this.getData();
    return this.route!;
  }
}

export class SendMock extends Send {
  constructor(attempts: number, timestamp: Date, route: Route) {
    super();
    this.attempts = attempts;
    this.timestamp = timestamp;
    this.route = route;

    this.hasData = true;
  }
}
