/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { DocumentData, updateDoc } from 'firebase/firestore';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { LazyObject, Route, RouteClassifier, User } from '../types';

export type FetchedSend = {
  user: User;
  route: Route;
  timestamp: Date;
  routeName: string;
  classifier: RouteClassifier;
};

export class Send extends LazyObject {
  public user?: User;
  public route?: Route;
  public timestamp?: Date;
  public classifier?: RouteClassifier;
  public routeName?: string;

  public initWithDocumentData(data: DocumentData): void {
    this.user = new User(data.user);
    this.classifier = new RouteClassifier(data.rawgrade, data.type);
    this.timestamp = new Date(
      data.timestamp.seconds * 1000 + data.timestamp.nanoseconds / 1000000
    );
    this.route = new Route(data.route);

    if (data.routeName !== undefined) this.routeName = data.routeName;

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

  /** getRouteName
   */
  public async getRouteName() {
    if (!this.hasData) await this.getData();
    if (this.routeName !== undefined) return this.routeName;
    const res = await this.route!.getName();
    updateDoc(this.docRef!, { routeName: res }); // Myelinate
    return res;
  }

  // ======================== Fetchers and Builders ========================

  public async fetch() {
    return {
      user: await this.getUser(),
      route: await this.getRoute(),
      timestamp: await this.getTimestamp(),
      classifier: await this.getClassifier(),
      routeName: await this.getRouteName(),
    } as FetchedSend;
  }

  public buildFetcher() {
    return async () => this.getData().then(() => this.fetch());
  }
}

export class SendMock extends Send {
  constructor(user: User, timestamp: Date, route: Route) {
    super();
    this.user = user;
    this.timestamp = timestamp;
    this.route = route;

    this.hasData = true;
    this.routeName = 'mock route name';
    this._idMock = uuidv4();
  }
}
