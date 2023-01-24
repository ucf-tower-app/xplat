import {
  CollectionReference,
  DocumentReference,
  QueryConstraint,
  QueryDocumentSnapshot,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
} from 'firebase/firestore';
import { db } from '../Firebase';
import { LazyObject, Post } from './types';

/** QueryCursor class. Generic on some LazyObject
 * @constructor: Takes the generic type, stride, collection ref, and list of query constraints
 * @method hasNext(): async, returns whether the cursor can return data either from memory or by querying.
 * @method peekNext(): async, returns the next result without advancing the queue
 * @method pollNext(): async, returns the next result and advances the queue
 * @remarks Please don't call methods on the same object multiple times concurrently. They should block each other.
 */
export class QueryCursor<T extends LazyObject> {
  private lastVisible: QueryDocumentSnapshot | undefined = undefined;
  private results: (T | undefined)[] = [];
  private idx: number = 0;
  private firstQuery: Promise<void>;
  private stride: number;
  private Tcreator: new (data: DocumentReference) => T;

  private collection: CollectionReference;
  private constraints: QueryConstraint[];
  constructor(
    Tcreator: new (data: DocumentReference) => T,
    stride: number,
    collection: CollectionReference,
    ...queryConstraints: QueryConstraint[]
  ) {
    this.Tcreator = Tcreator;
    this.stride = stride;
    this.collection = collection;
    this.constraints = queryConstraints;
    const first = query(
      this.collection,
      ...this.constraints,
      limit(this.stride)
    );
    this.firstQuery = getDocs(first).then((snaps) => {
      this.lastVisible = snaps.docs[snaps.docs.length - 1];
      snaps.docs.forEach(this.addSnap, this);
    });
  }

  private addSnap(snap: QueryDocumentSnapshot) {
    const post: T = new this.Tcreator(snap.ref);
    post.initWithDocumentData(snap.data());
    this.results.push(post);
  }

  private async advance() {
    await this.firstQuery;
    if (this.idx < this.results.length) return;
    const snaps = await getDocs(
      query(
        this.collection,
        ...this.constraints,
        startAfter(this.lastVisible),
        limit(this.stride)
      )
    );
    this.lastVisible = snaps.docs[snaps.docs.length - 1];
    snaps.docs.forEach(this.addSnap, this);

    // If we didn't get the expected number of snaps, we're done
    if (snaps.docs.length < this.stride) this.results.push(undefined);
  }

  public async peekNext() {
    if (this.idx >= this.results.length) await this.advance();
    return this.results[this.idx];
  }

  public async hasNext() {
    return (await this.peekNext()) !== undefined;
  }

  public async pollNext() {
    const res = await this.peekNext();
    if (!res) return res;
    this.idx++;
    return res;
  }

  public async ________getAll_CLOWNTOWN_LOTS_OF_READS() {
    const res = [];
    while (await this.hasNext()) res.push(await this.pollNext());
    return res;
  }
}

/** PostCursorMerger class
 * Takes a list of QueryCursor<Post> and makes them act as one big sorted cursor.
 * @constructor takes a list of QueryCursor<Post>
 * @method peekNext(): Same as QueryCursor
 * @method pollNext(): Same as QueryCursor
 * @remarks Please don't call methods on the same object multiple times concurrently. They should block each other.
 */
export class PostCursorMerger {
  private left?: PostCursorMerger | QueryCursor<Post>;
  private right?: PostCursorMerger | QueryCursor<Post>;

  private next?: Post;
  constructor(cursors: QueryCursor<Post>[]) {
    if (cursors.length < 2) {
      this.left = cursors.at(0);
      this.right = cursors.at(1);
    } else {
      const mid = cursors.length / 2;
      this.left = new PostCursorMerger(cursors.slice(0, mid));
      this.right = new PostCursorMerger(cursors.slice(mid));
    }
  }

  private async nextSide() {
    const left = await this.left?.peekNext();
    const right = await this.right?.peekNext();
    if (!left) return this.right;
    if (!right) return this.left;
    if ((await left.getTimestamp()) > (await right.getTimestamp()))
      return this.left;
    else return this.right;
  }

  public async peekNext(): Promise<Post | undefined> {
    if (this.next) return this.next;
    return (this.next = await (await this.nextSide())?.peekNext());
  }

  public async pollNext(): Promise<Post | undefined> {
    this.next = undefined;
    return (await this.nextSide())?.pollNext();
  }
}

// Not suitable for human consumption
export function getTestMergePostsCursor() {
  const potato = new QueryCursor(
    Post,
    3,
    collection(db, 'posts'),
    where('author', 'in', [
      doc(db, 'users', '8lKYOpsrMPa8YJijWZP94TXcydG3'),
      doc(db, 'users', 'k0pzkJmLyXXqxrV8RBCYYhMw1Ig2'),
    ]),
    orderBy('timestamp', 'desc')
  );

  const lift = new QueryCursor(
    Post,
    3,
    collection(db, 'posts'),
    where('author', 'in', [doc(db, 'users', '7MK6pdWbG8UJe7VPusFL06EVXp83')]),
    orderBy('timestamp', 'desc')
  );

  return new PostCursorMerger([potato, lift]);
}
