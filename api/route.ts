/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  Transaction,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  where,
} from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../Firebase';
import { SubstringMatcher } from '../types/substringMatcher';
import {
  QueryCursor,
  Route,
  RouteClassifier,
  RouteStatus,
  RouteType,
  Tag,
  User,
} from '../types/types';

/** getRouteById
 * Returns a Firebase Route corresponding to the document ID provided
 * @param id: The Route's firebase ID
 * @remarks The returned Route is not guaranteed to have data in firebase.
 * This will result in subsequent getData() calls to throw.
 * @returns A Firebase Route
 */
export function getRouteById(routeId: string) {
  return new Route(doc(db, 'routes', routeId));
}

/** getRouteByName
 * Returns a Firebase Route with the corresponding name, or undefined
 * @param name: The Route's name
 * @remarks The returned Route is not guaranteed to have data in firebase.
 * This will result in subsequent getData() calls to throw.
 * @returns A Firebase Route, or undefined
 */
export async function getRouteByName(name: string) {
  const q = await getDocs(
    query(collection(db, 'routes'), where('name', '==', name), limit(1))
  );
  if (q.size === 0) return undefined;
  console.log(q.docs);
  const res = new Route(q.docs[0].ref);
  res.initWithDocumentData(q.docs[0].data());
  return res;
}

export interface CreateRouteArgs {
  name: string;
  classifier: RouteClassifier;
  description?: string;
  tags?: Tag[];
  setter?: User;
  rope?: number;
  thumbnail?: Blob;
  color?: string;
  setterRawName?: string;
}

/** createRoute
 * Creates a route
 * @param name: The route's name
 * @param classifier: The route's classifier
 * @param description: Optional, the route's description
 * @param tags: Optional, a list of Tag, the route's tags
 * @param setter: Optional, the Tower User of the setter
 * @param rope: Optional, which rope the route is on / closest to
 * @param thumbnail: Optional, the route's thumbnail
 * @param color: Optional, the hold colors
 * @param setterRawName: Optional, if no setter User exists, then just the name of the setter
 * @returns The newly created Route
 */
export async function createRoute({
  name,
  classifier,
  description = undefined,
  tags = undefined,
  setter = undefined,
  rope = undefined,
  thumbnail = undefined,
  color = undefined,
  setterRawName = undefined,
}: CreateRouteArgs) {
  if ((await getRouteByName(name)) !== undefined)
    return Promise.reject('Route with this name already exists!');
  const newRouteDocRef = doc(collection(db, 'routes'));
  const newForumDocRef = doc(collection(db, 'forums'));

  if (thumbnail) {
    await uploadBytes(
      ref(storage, 'routeThumbnails/' + newRouteDocRef.id),
      thumbnail
    );
  }

  return runTransaction(db, async (transaction: Transaction) => {
    transaction.set(newRouteDocRef, {
      name: name,
      rawgrade: classifier.rawgrade,
      type: classifier.type as string,
      ...(setter && { setter: setter.docRef! }),
      ...(rope && { rope: rope }),
      ...(tags && { tags: tags }),
      ...(color && { color: color }),
      ...(description && { description: description }),
      ...(thumbnail && { thumbnail: 'routeThumbnails/' + newRouteDocRef.id }),
      ...(setterRawName && { setterRawName: setterRawName }),
      forum: newForumDocRef,
      status: RouteStatus.Draft,
    });
    transaction.set(newForumDocRef, {
      route: newRouteDocRef,
      isArchived: false,
    });

    return new Route(newRouteDocRef);
  });
}

/** getActiveRoutesCursor
 * Get a cursor for all active routes from most recent
 * @returns A list of Tower Routes
 */
export function getActiveRoutesCursor() {
  return new QueryCursor<Route>(
    Route,
    5,
    collection(db, 'routes'),
    where('status', '==', RouteStatus.Active),
    orderBy('timestamp', 'desc')
  );
}

/** getAllRoutesCursor
 * Get a cursor for all active and archived routes from most recent
 * @returns A list of Tower Routes
 */
export function getAllRoutesCursor() {
  return new QueryCursor<Route>(
    Route,
    5,
    collection(db, 'routes'),
    where('status', 'in', [RouteStatus.Active, RouteStatus.Archived]),
    orderBy('timestamp', 'desc')
  );
}

/** getArchivedRoutesCursor
 * Get a cursor for all archived routes from most recent
 * @returns A list of Tower Routes
 */
export function getArchivedRoutesCursor() {
  return new QueryCursor<Route>(
    Route,
    5,
    collection(db, 'routes'),
    where('status', 'in', [RouteStatus.Archived]),
    orderBy('timestamp', 'desc')
  );
}

/** getDraftRoutesCursor
 * Get a cursor for all draft routes from most recent
 * @returns A list of Tower Routes
 */
export function getDraftRoutesCursor() {
  return new QueryCursor<Route>(
    Route,
    5,
    collection(db, 'routes'),
    where('status', 'in', [RouteStatus.Draft]),
    orderBy('timestamp', 'desc')
  );
}

/** getArchivedRoutesSubstringMatcher
 * Get a matcher which will substring match the names of all archived routes
 */
export async function getArchivedRoutesSubstringMatcher() {
  const names = await getDoc(doc(db, 'caches', 'archivedRoutes'));
  return new SubstringMatcher<string>(names.data()!.names);
}

/** getAllBoulderClassifiers
 * Get list of all boulder classifiers
 */
export function getAllBoulderClassifiers() {
  return [-1, 0, 1, 2, 3, 4, 5, 6, 7].map(
    (x) => new RouteClassifier(x, RouteType.Boulder)
  );
}

/** convertBoulderStringToClassifier
 * Turns a boulder grade string into its classifier
 * @param boulderString: The boulder string to convert
 */
export function convertBoulderStringToClassifier(boulderString: string) {
  const rawgrade = boulderString.endsWith('B')
    ? -1
    : parseInt(boulderString[boulderString.length - 1]);
  return new RouteClassifier(rawgrade, RouteType.Boulder);
}

/** getAllTraverseRouteClassifiers
 * Get list of all traverse classifiers
 */
export function getAllTraverseRouteClassifiers() {
  return [1, 2, 3, 4].map((x) => new RouteClassifier(x, RouteType.Traverse));
}

/** convertTraverseStringToClassifier
 * Turns a traverse grade string into its classifier
 * @param traverseString: The traverse string to convert
 */
export function convertTraverseStringToClassifier(traverseString: string) {
  const rawgrade = traverseString.charCodeAt(0) - 'A'.charCodeAt(0) + 1;
  return new RouteClassifier(rawgrade, RouteType.Traverse);
}

/** getAllTopropeRouteClassifiers
 * Get list of all toprope classifiers
 */
export function getAllTopropeRouteClassifiers() {
  return [
    49, 50, 51, 59, 60, 61, 69, 70, 71, 79, 80, 81, 89, 90, 91, 99, 100, 101,
    109, 110, 111, 119, 120, 121, 129, 130, 131,
  ].map((x) => new RouteClassifier(x, RouteType.Toprope));
}

/** convertTopropeStringToClassifier
 * Turns a toprope grade string into its classifier
 * @param topropeString: The toprope string to convert
 */
export function convertTopropeStringToClassifier(topropeString: string) {
  let rawgrade = parseInt(topropeString.split('.')[1]) * 10;
  if (topropeString.endsWith('-')) rawgrade--;
  else if (topropeString.endsWith('+')) rawgrade++;
  return new RouteClassifier(rawgrade, RouteType.Toprope);
}

/** getAllLeadclimbRouteClassifiers
 * Get list of all lead climb classifiers
 */
export function getAllLeadclimbRouteClassifiers() {
  return [
    49, 50, 51, 59, 60, 61, 69, 70, 71, 79, 80, 81, 89, 90, 91, 99, 100, 101,
    109, 110, 111, 119, 120, 121, 129, 130, 131,
  ].map((x) => new RouteClassifier(x, RouteType.Leadclimb));
}

/** convertLeadclimbStringToClassifier
 * Turns a leadclimb grade string into its classifier
 * @param leadclimbString: The leadclimb string to convert
 */
export function convertLeadclimbStringToClassifier(leadclimbString: string) {
  let rawgrade = parseInt(leadclimbString.split('.')[1]) * 10;
  if (leadclimbString.endsWith('-')) rawgrade--;
  else if (leadclimbString.endsWith('+')) rawgrade++;
  return new RouteClassifier(rawgrade, RouteType.Leadclimb);
}

/** getAllCompetitionRouteClassifiers
 * Get list of all comp route classifiers
 */
export function getAllCompetitionRouteClassifiers() {
  return [1, 2, 3, 4].map((x) => new RouteClassifier(x, RouteType.Competition));
}

/** convertCompetitionStringToClassifier
 * Turns a competition grade string into its classifier
 * @param competitionString: The competition string to convert
 */
export function convertCompetitionStringToClassifier(
  competitionString: string
) {
  const rawgrade = competitionString.charCodeAt(0) - 'A'.charCodeAt(0) + 1;
  return new RouteClassifier(rawgrade, RouteType.Competition);
}

/** getAllRouteClassifiers
 * Get list of all route classifiers of all types
 */
export function getAllRouteClassifiers() {
  return getAllBoulderClassifiers().concat(
    getAllTraverseRouteClassifiers(),
    getAllLeadclimbRouteClassifiers(),
    getAllCompetitionRouteClassifiers(),
    getAllTopropeRouteClassifiers()
  );
}
