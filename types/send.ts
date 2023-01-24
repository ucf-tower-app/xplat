/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { DocumentData } from 'firebase/firestore';
import { LazyObject, Route, RouteClassifier, User } from './types';

export class Send extends LazyObject {
  public user?: User;
  public route?: Route;
  public timestamp?: Date;
  public classifier?: RouteClassifier;

  public initWithDocumentData(data: DocumentData): void {
    this.user = new User(data.user);
    this.classifier = new RouteClassifier(data.rawgrade, data.type);
    this.timestamp = new Date(
      data.timestamp.seconds * 1000 + data.timestamp.nanoseconds / 1000000
    );
    this.route = new Route(data.route);

    this.hasData = true;
  }
  // ======================== Trivial Getters Below ========================

  /** getUser
   */
  public async getUser() {
    if (!this.hasData) await this.getData();
    return this.user!;
  }

  /** getClassifier
   */
  public async getClassifier() {
    if (!this.hasData) await this.getData();
    return this.classifier!;
  }

  /** getTimestamp
   */
  public async getTimestamp() {
    if (!this.hasData) await this.getData();
    return this.timestamp!;
  }

  /** getRoute
   */
  public async getRoute() {
    if (!this.hasData) await this.getData();
    return this.route!;
  }
}

export class SendMock extends Send {
  constructor(user: User, timestamp: Date, route: Route) {
    super();
    this.user = user;
    this.timestamp = timestamp;
    this.route = route;

    this.hasData = true;
  }
}
