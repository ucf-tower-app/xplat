/* eslint-disable @typescript-eslint/no-non-null-assertion */
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import {
  DocumentData,
  DocumentReference,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
  limit,
  query,
  refEqual,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { deleteObject, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../Firebase';
import { getRouteByName } from '../api';
import { Forum, LazyObject, LazyStaticImage, Send, Tag, User } from './types';

export enum RouteType {
  Boulder = 'Boulder',
  Toprope = 'Top-Rope',
  Traverse = 'Traverse',
  Leadclimb = 'Lead-Climb',
  Competition = 'Competition',
}

export enum RouteColor {
  Red = 'red',
  Blue = 'blue',
  Green = 'green',
  Yellow = 'yellow',
  Orange = 'orange',
  Purple = 'purple',
  Pink = 'pink',
  Black = 'black',
  White = 'white',
  Grey = 'grey',
  Brown = 'brown',
  Multi = 'multi',
  Other = 'other',
}

export enum RouteTech {
  OH = 'OH',
  ON = 'ON',
  OFF = 'OFF',
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
  public points: number;
  constructor(rawgrade: number, type: RouteType) {
    this.type = type;
    this.rawgrade = rawgrade;
    this.displayString = gradeToDisplayString(rawgrade, type);
    if (type == RouteType.Toprope || type == RouteType.Leadclimb)
      this.points = rawgrade;
    else this.points = rawgrade * 10 + 60;
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

export interface EditRouteArgs {
  name?: string;
  classifier?: RouteClassifier;
  description?: string;
  tags?: Tag[];
  setter?: User;
  rope?: number;
  thumbnail?: Blob;
  color?: string;
  setterRawName?: string;
  tech?: RouteTech;
}

export class Route extends LazyObject {
  // Expected and required when getting data
  public name?: string;
  public classifier?: RouteClassifier;
  public forum?: Forum;

  // Filled with defaults if not present when getting data
  public likes?: User[];
  public tags?: Tag[];
  public status?: RouteStatus;
  public description?: string;
  public sendCount?: number;
  public totalStars?: number;
  public numRatings?: number;

  // Might remain undefined even if has data
  public setter?: User;
  public thumbnail?: LazyStaticImage;
  public rope?: number;
  public timestamp?: Date;
  public color?: string;
  public setterRawName?: string;
  public tech?: RouteTech;

  public initWithDocumentData(data: DocumentData): void {
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
    this.sendCount = data.sendCount ?? 0;
    this.totalStars = data.totalStars ?? 0;
    this.numRatings = data.numRatings ?? 0;
    this.description = data.description ?? '';

    if (data.setter) this.setter = new User(data.setter);
    if (data.thumbnail) this.thumbnail = new LazyStaticImage(data.thumbnail);
    if (data.rope) this.rope = data.rope;
    if (data.color) this.color = data.color;
    if (data.tech) this.tech = data.tech;
    if (data.setterRawName) this.setterRawName = data.setterRawName;
    if (data.timestamp)
      this.timestamp = new Date(
        data.timestamp.seconds * 1000 + data.timestamp.nanoseconds / 1000000
      );

    this.hasData = true;
  }

  /** Route::addLike()
   * Given a user, like a route if they haven't liked it.
   * @remarks updates this route's list of likes
   */
  public async addLike(user: User) {
    if (this.hasData && (await this.likedBy(user))) return;
    await runTransaction(db, async (transaction) => {
      transaction.update(this.docRef!, { likes: arrayUnion(user.docRef!) });
    });
    if (this.hasData) this.likes?.push(user);
  }

  /** Route::removeLike()
   * Given a user, unlike a route if they've liked it.
   * @remarks updates this route's list of likes
   */
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

  /** Route::upgradeStatus()
   * Upgrade the status of this route, iff the *actual status* (in the database) of the route is currently equal to what this object has.
   * @remarks updates this object's status
   */
  public async upgradeStatus() {
    const client_oldStatus = await this.getStatus();
    const cacheDocRef = doc(db, 'caches', 'archivedRoutes');

    return runTransaction(db, async (transaction) => {
      await this.updateWithTransaction(transaction);
      const server_oldStatus = await this.getStatus();
      if (client_oldStatus != server_oldStatus) return;
      if (client_oldStatus == RouteStatus.Archived) return;
      else if (client_oldStatus == RouteStatus.Draft) {
        transaction.update(this.docRef!, {
          status: RouteStatus.Active,
          timestamp: serverTimestamp(),
        });
        this.status = RouteStatus.Active;
      } else {
        transaction.update(cacheDocRef, { names: arrayUnion(this.name) });
        transaction.update(this.docRef!, { status: RouteStatus.Archived });
        this.status = RouteStatus.Archived;
      }
    });
  }

  /** getSendByUser
   * Check if a user has sent it. 'It' being this route, of course.
   * @param user
   * @returns: A Send if they've sent it, else undefined
   */
  public async getSendByUser(user: User) {
    const q = await getDocs(
      query(
        collection(db, 'sends'),
        where('user', '==', user.docRef!),
        where('route', '==', this.docRef!),
        limit(1)
      )
    );
    if (q.size === 0) return undefined;
    console.log(q.docs);
    const res = new Send(q.docs[0].ref);
    res.initWithDocumentData(q.docs[0].data());
    return res;
  }

  /** FUCKINSENDIT
   * FUCKIN SEND IT, MAN! HELL YEAH MY BROTHER
   * @param sender: The sender
   * @param rating: Optional, a number 1-5, the star rating given
   * @returns: Either the send if they've already sent it, or the new send
   * @remarks Updates numSends and star ratings accordingly
   */
  public async FUCKINSENDIT(sender: User, rating: number | undefined) {
    const already = await this.getSendByUser(sender);
    if (already !== undefined) {
      console.log('Already sent it');
      return already;
    }
    const newSendDocRef = doc(collection(db, 'sends'));
    await runTransaction(db, async (transaction) => {
      await Promise.all([
        this.updateWithTransaction(transaction),
        sender.updateWithTransaction(transaction),
      ]);
      const totalSends = sender.totalSends!;
      const bestSends = sender.bestSends!;
      totalSends.set(
        this.classifier!.type,
        (totalSends.get(this.classifier!.type) ?? 0) + 1
      );
      if (
        (bestSends.get(this.classifier!.type) ?? this.classifier!.rawgrade) <=
        this.classifier!.rawgrade
      )
        bestSends.set(this.classifier!.type, this.classifier!.rawgrade);

      this.sendCount = this.sendCount! + 1;
      if (rating) {
        this.totalStars! += rating;
        this.numRatings! += 1;
      }
      transaction
        .update(this.docRef!, {
          sendCount: increment(1),
          ...(rating && {
            totalStars: increment(rating),
            numRatings: increment(1),
          }),
        })
        .set(newSendDocRef, {
          user: sender.docRef!,
          route: this.docRef!,
          timestamp: serverTimestamp(),
          rawgrade: this.classifier!.rawgrade,
          type: this.classifier!.type as string,
        })
        .update(sender.docRef!, {
          totalSends: Object.fromEntries(totalSends),
          bestSends: Object.fromEntries(bestSends),
        });
    });
    return new Send(newSendDocRef);
  }

  /** delete
   * Delete a draft route
   * @throws if the route is not a draft
   */
  public async delete() {
    await this.getData(true);
    if (this.status! !== RouteStatus.Draft)
      return Promise.reject('Can only delete a draft route');
    const tasks = [deleteDoc(this.docRef!), deleteDoc(this.forum!.docRef!)];
    if (this.thumbnail)
      tasks.push(deleteObject(this.thumbnail.getStorageRef()));
    return Promise.all(tasks);
  }

  /** edit
   * Update a route with any of the non-undefined params.
   * All params are optional since not every param *has* to change.
   * @param name: Route's name
   * @param classifier: Route's classifier
   * @param description: The route's description
   * @param tags: A list of Tag, the route's tags
   * @param setter: The Tower User of the setter
   * @param rope: Which rope the route is on / closest to
   * @param thumbnail: The route's thumbnail
   * @param color: The hold colors
   * @param setterRawName: If no setter User exists, then just the name of the setter
   * @param tech: The route's tech
   * @remarks Updates this route's fields
   */
  public async edit({
    name = undefined,
    classifier = undefined,
    description = undefined,
    tags = undefined,
    setter = undefined,
    rope = undefined,
    thumbnail = undefined,
    color = undefined,
    setterRawName = undefined,
    tech = undefined,
  }: EditRouteArgs) {
    if (name && (await getRouteByName(name)) !== undefined)
      return Promise.reject('Route with this name already exists!');
    await this.getData(true);
    if (thumbnail) {
      if (this.thumbnail) await deleteObject(this.thumbnail.getStorageRef());
      await uploadBytes(
        ref(storage, 'routeThumbnails/' + this.docRef!.id),
        thumbnail
      );
    }
    const res = runTransaction(db, async (transaction) => {
      await this.updateWithTransaction(transaction);
      transaction.update(this.docRef!, {
        ...(name && { name: name }),
        ...(classifier && { classifier: classifier }),
        ...(description && { description: description }),
        ...(tags && { tags: tags }),
        ...(setter && { setter: setter }),
        ...(rope && { rope: rope }),
        ...(color && { color: color }),
        ...(tech && { tech: tech }),
        ...(setterRawName && { setterRawName: setterRawName }),
        ...(thumbnail && { thumbnail: 'routeThumbnails/' + this.docRef!.id }),
      });
    });

    if (name) this.name = name;
    if (classifier) this.classifier = classifier;
    if (description) this.description = description;
    if (tags) this.tags = tags;
    if (setter) this.setter = setter;
    if (rope) this.rope = rope;
    if (color) this.color = color;
    if (setterRawName) this.setterRawName = setterRawName;
    if (thumbnail)
      this.thumbnail = new LazyStaticImage(
        'routeThumbnails/' + this.docRef!.id
      );

    return res;
  }

  // ======================== Trivial Getters Below ========================
  /** likedBy
   */
  public async likedBy(user: User) {
    return this.getLikes().then((likes) =>
      likes.some((like) => refEqual(like.docRef!, user.docRef!))
    );
  }

  /** getTech
   */
  public async getTech() {
    if (!this.hasData) await this.getData();
    return this.tech!;
  }

  /** hasTimestamp
   */
  public async hasTimestamp() {
    if (!this.hasData) await this.getData();
    return this.timestamp !== undefined;
  }

  /** getTimestamp
   */
  public async getTimestamp() {
    if (!this.hasData) await this.getData();
    return this.timestamp!;
  }

  /** getDescription
   */
  public async getDescription() {
    if (!this.hasData) await this.getData();
    return this.description!;
  }

  /** hasRope
   */
  public async hasRope() {
    if (!this.hasData) await this.getData();
    return this.rope !== undefined;
  }

  /** getRope
   */
  public async getRope() {
    if (!this.hasData) await this.getData();
    return this.rope!;
  }

  /** getSendCount
   */
  public async getSendCount() {
    if (!this.hasData) await this.getData();
    return this.sendCount!;
  }

  /** hasSetterRawName
   */
  public async hasSetterRawName() {
    if (!this.hasData) await this.getData();
    return this.setterRawName !== undefined;
  }

  /** getSetterRawName
   */
  public async getSetterRawName() {
    if (!this.hasData) await this.getData();
    return this.setterRawName!;
  }

  /** getName
   */
  public async getName() {
    if (!this.hasData) await this.getData();
    return this.name!;
  }

  /** getGradeDisplayString
   */
  public async getGradeDisplayString() {
    if (!this.hasData) await this.getData();
    return this.classifier!.displayString;
  }

  /** getType
   */
  public async getType() {
    if (!this.hasData) await this.getData();
    return this.classifier!.type;
  }

  /** hasSetter
   */
  public async hasSetter() {
    if (!this.hasData) await this.getData();
    return this.setter !== undefined;
  }

  /** getSetter
   */
  public async getSetter() {
    if (!this.hasData) await this.getData();
    return this.setter!;
  }

  /** hasColor
   */
  public async hasColor() {
    if (!this.hasData) await this.getData();
    return this.color !== undefined;
  }

  /** getColor
   */
  public async getColor() {
    if (!this.hasData) await this.getData();
    return this.color!;
  }

  /** getForum
   */
  public async getForum() {
    if (!this.hasData) await this.getData();
    return this.forum!;
  }

  /** getLikes
   */
  public async getLikes() {
    if (!this.hasData) await this.getData();
    return this.likes!;
  }

  /** getTags
   */
  public async getTags() {
    if (!this.hasData) await this.getData();
    return this.tags!;
  }

  /** getStatus
   */
  public async getStatus() {
    if (!this.hasData) await this.getData();
    return this.status!;
  }

  /** hasThumbnail
   */
  public async hasThumbnail() {
    if (!this.hasData) await this.getData();
    return this.thumbnail !== undefined;
  }

  /** getThumbnailUrl
   */
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
    forum: Forum,
    likes: User[],
    tags: Tag[],
    status: RouteStatus,
    description: string,
    setter?: User,
    thumbnail?: LazyStaticImage,
    rope?: number
  ) {
    super();
    this.name = name;
    this.classifier = classifier;
    (this.forum = forum), (this.likes = likes);
    this.tags = tags;
    this.status = status;
    this.description = description;
    this.setter = setter;
    this.thumbnail = thumbnail;
    this.rope = rope;

    this.hasData = true;
    this._idMock = uuidv4();
  }

  public addLikes(likes: User[]) {
    this.likes = this.likes?.concat(likes);
  }

  public addTags(tags: Tag[]) {
    this.tags = this.tags?.concat(tags);
  }
}
