/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  DocumentData,
  DocumentReference,
  arrayRemove,
  arrayUnion,
  refEqual,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../Firebase';
import { LazyObject } from './common';
import { Forum, LazyStaticImage, Tag, User } from './types';

export enum RouteType {
  Boulder = 'Boulder',
  Toprope = 'Top-Rope',
  Traverse = 'Traverse',
  Leadclimb = 'Lead-Climb',
  Competition = 'Competition',
}

export enum RouteStatus {
  Draft = 0,
  Active = 1,
  Archived = 2,
}

/** RouteClassifier class
 * Given a route type and grade number, respective user-displayable string
 * @param rawgrade: The number stored in firebase and backend objects
 * @param routeType: The associated routeType
 * Boulder: grade x returns 'Vx', except x=-1, which is 'VB'
 * Traverse/Comp: Grade x where x is in [1,26] returns A-Z as expected
 * Toprope/Leadclimb: Grade x returns '5.<round(x/10)>'. If x is not divisible by 10, the bias will be the +/- as expected.
 * E.g. Toprope 61 -> '5.6+', Toprope 69 -> '5.7-', Toprope 70 -> '5.7'
 */
export class RouteClassifier {
  public type: RouteType;
  public rawgrade: number;
  public displayString: string;
  constructor(rawgrade: number, type: RouteType) {
    this.type = type;
    this.rawgrade = rawgrade;
    this.displayString = gradeToDisplayString(rawgrade, type);
  }
}

function gradeToDisplayString(grade: number, type: RouteType) {
  if (type == RouteType.Boulder) {
    if (grade == -1) return 'VB';
    else return 'V' + grade;
  } else if (type == RouteType.Traverse || type == RouteType.Competition) {
    return String.fromCharCode(65 /*A = 65*/ + grade - 1);
  } else {
    return (
      '5.' +
      Math.round(grade / 10) +
      (grade % 10 == 1 ? '+' : '') +
      (grade % 10 == 9 ? '-' : '')
    );
  }
}

export class Route extends LazyObject {
  // Expected and required when getting data
  protected name?: string;
  protected classifier?: RouteClassifier;
  protected forum?: Forum;

  // Filled with defaults if not present when getting data
  protected likes?: User[];
  protected tags?: Tag[];
  protected status?: RouteStatus;
  protected description?: string;

  // Might remain undefined even if has data
  protected setter?: User;
  protected thumbnail?: LazyStaticImage;
  protected rope?: number;

  public initWithDocumentData(data: DocumentData): void {
    console.log('Init with data:');
    console.log(data);

    this.name = data.name;
    this.classifier = new RouteClassifier(
      data.rawgrade,
      data.type as RouteType
    );
    this.forum = new Forum(data.forum);

    this.likes = (data.likes ?? []).map(
      (ref: DocumentReference<DocumentData>) => new User(ref)
    );
    this.tags = (data.tags ?? []).map(
      (ref: DocumentReference<DocumentData>) => new Tag(ref)
    );
    this.status = (data.status ?? 0) as RouteStatus;
    this.description = data.description ?? '';

    if (data.setter) this.setter = new User(data.setter);
    if (data.thumbnail) this.thumbnail = new LazyStaticImage(data.thumbnail);
    if (data.rope) this.rope = data.rope;

    this.hasData = true;
  }

  public async addLike(user: User) {
    if (this.hasData && (await this.likedBy(user))) return;
    await runTransaction(db, async (transaction) => {
      transaction.update(this.docRef!, { likes: arrayUnion(user.docRef!) });
    });
    if (this.hasData) this.likes?.push(user);
  }

  public async removeLike(user: User) {
    if (this.hasData && !(await this.likedBy(user))) return;
    await runTransaction(db, async (transaction) => {
      transaction.update(this.docRef!, { likes: arrayRemove(user.docRef!) });
    });
    if (this.hasData)
      this.likes = this.likes?.filter(
        (like) => !refEqual(like.docRef!, user.docRef!)
      );
  }

  public async likedBy(user: User) {
    return this.getLikes().then((likes) =>
      likes.some((like) => refEqual(like.docRef!, user.docRef!))
    );
  }

  public async getDescription() {
    if (!this.hasData) await this.getData();
    return this.description!;
  }

  public async hasRope() {
    if (!this.hasData) await this.getData();
    return this.rope !== undefined;
  }

  public async getRope() {
    if (!this.hasData) await this.getData();
    return this.rope!;
  }

  public async getName() {
    if (!this.hasData) await this.getData();
    return this.name!;
  }

  public async getGradeDisplayString() {
    if (!this.hasData) await this.getData();
    return this.classifier!.displayString;
  }

  public async getType() {
    if (!this.hasData) await this.getData();
    return this.classifier!.type;
  }

  public async hasSetter() {
    if (!this.hasData) await this.getData();
    return this.setter !== undefined;
  }

  public async getSetter() {
    if (!this.hasData) await this.getData();
    return this.setter!;
  }

  public async getForum() {
    if (!this.hasData) await this.getData();
    return this.forum!;
  }

  public async getLikes() {
    if (!this.hasData) await this.getData();
    return this.likes!;
  }

  public async getTags() {
    if (!this.hasData) await this.getData();
    return this.tags!;
  }

  public async getStatus() {
    if (!this.hasData) await this.getData();
    return this.status!;
  }

  public async hasThumbnail() {
    if (!this.hasData) await this.getData();
    return this.thumbnail !== undefined;
  }

  public async getThumbnailUrl() {
    if (!this.hasData) await this.getData();
    return this.thumbnail!.getImageUrl();
  }

  public async getThumbnailStorageRef() {
    if (!this.hasData) await this.getData();
    return this.thumbnail!.getStorageRef();
  }
}

export class RouteMock extends Route {
  constructor(
    name: string,
    classifier: RouteClassifier,
    setter: User,
    forum: Forum,
    likes: User[],
    tags: Tag[]
  ) {
    super();
    this.name = name;
    this.classifier = classifier;
    this.setter = setter;
    this.forum = forum;
    this.likes = likes;
    this.tags = tags;

    this.hasData = true;
  }

  public addLikes(likes: User[]) {
    this.likes = this.likes?.concat(likes);
  }

  public addTags(tags: Tag[]) {
    this.tags = this.tags?.concat(tags);
  }
}
