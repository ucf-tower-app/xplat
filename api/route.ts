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
import {
  NaturalRules,
  QueryCursor,
  Route,
  RouteClassifier,
  RouteStatus,
  RouteType,
  Tag,
  User,
} from '../types';
import { SubstringMatcher } from '../types/substringMatcher';

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

export enum GetRouteByNameError {
  NoSuchRoute = 'Failed to find the specified route',
}

/** getRouteByName
 * Returns a Firebase Route with the corresponding name
 * @param name: The Route's name
 * @throws if the specified route does not exist
 * @returns A Firebase Route, or undefined
 */
export async function getRouteByName(name: string) {
  const q = await getDocs(
    query(collection(db, 'routes'), where('name', '==', name), limit(1))
  );
  if (q.size === 0) throw GetRouteByNameError.NoSuchRoute;
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
  naturalRules?: NaturalRules;
}

export enum CreateRouteError {
  RouteNameExists = 'A route with this name already exists! Please choose another name.',
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
 * @param naturalRules: Optional, the Route's naturalRules
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
  naturalRules = undefined,
}: CreateRouteArgs) {
  if ((await getRouteByName(name)) !== undefined)
    throw CreateRouteError.RouteNameExists;
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
      ...(naturalRules && { naturalRules: naturalRules }),
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

export async function getArchivedRouteNames() {
  return (await getDoc(doc(db, 'caches', 'archivedRoutes'))).data()!
    .names as string[];
}

export function buildMatcher(names: string[]) {
  return new SubstringMatcher<string>(names);
}

export function buildSet(names: string[]) {
  return new Set<string>(names);
}

/** getArchivedRoutesSubstringMatcher
 * Get a matcher which will substring match the names of all archived routes
 */
export async function getArchivedRoutesSubstringMatcher() {
  const names = await getDoc(doc(db, 'caches', 'archivedRoutes'));
  return new SubstringMatcher<string>(await getArchivedRouteNames());
}

/** convertBoulderStringToClassifier
 * Turns a boulder grade string into its classifier
 * @param boulderString: The boulder string to convert
 */
export function convertBoulderStringToClassifier(boulderString: string) {
  const rawgrade = boulderString.endsWith('B')
    ? 40
    : parseInt(boulderString[boulderString.length - 1]) * 10 + 50;
  return new RouteClassifier(rawgrade, RouteType.Boulder);
}

export function getAllTraverseRouteClassifiers() {
  return ['Beginner', 'Intermediate', 'Advanced'].map(
    convertTraverseStringToClassifier
  );
}

export function getAllCompRouteClassifiers() {
  return ['A', 'B', 'C', 'D'].map(convertCompetitionStringToClassifier);
}

export function getAllBoulderClassifiers() {
  return ['VB', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7'].map(
    convertBoulderStringToClassifier
  );
}

export function getAllRopeDifficulties() {
  return ['5.5', '5.6', '5.7', '5.8', '5.9', '5.10', '5.11', '5.12', '5.13'];
}

export function getAllRopeModifiers() {
  return ['', '+', '-', 'A', 'B', 'C', 'D'];
}

/** convertTraverseStringToClassifier
 * Turns a traverse grade string into its classifier
 * @param traverseString: The traverse string to convert
 */
export function convertTraverseStringToClassifier(traverseString: string) {
  if (traverseString == 'Beginner')
    return new RouteClassifier(50, RouteType.Traverse);
  if (traverseString == 'Intermediate')
    return new RouteClassifier(70, RouteType.Traverse);
  else return new RouteClassifier(90, RouteType.Traverse);
}

/** convertTopropeStringToClassifier
 * Turns a toprope grade string into its classifier
 * @param topropeString: The toprope string to convert
 */
export function convertTopropeStringToClassifier(topropeString: string) {
  let rawgrade = parseInt(topropeString.split('.')[1]) * 10;
  if (topropeString.endsWith('A')) rawgrade -= 3;
  if (topropeString.endsWith('-')) rawgrade -= 2;
  if (topropeString.endsWith('B')) rawgrade -= 1;
  if (topropeString.endsWith('C')) rawgrade += 1;
  if (topropeString.endsWith('+')) rawgrade += 2;
  if (topropeString.endsWith('D')) rawgrade += 3;
  return new RouteClassifier(rawgrade, RouteType.Toprope);
}

/** convertLeadclimbStringToClassifier
 * Turns a leadclimb grade string into its classifier
 * @param leadclimbString: The leadclimb string to convert
 */
export function convertLeadclimbStringToClassifier(leadclimbString: string) {
  let rawgrade = parseInt(leadclimbString.split('.')[1]) * 10;
  if (leadclimbString.endsWith('A')) rawgrade -= 3;
  if (leadclimbString.endsWith('-')) rawgrade -= 2;
  if (leadclimbString.endsWith('B')) rawgrade -= 1;
  if (leadclimbString.endsWith('C')) rawgrade += 1;
  if (leadclimbString.endsWith('+')) rawgrade += 2;
  if (leadclimbString.endsWith('D')) rawgrade += 3;
  return new RouteClassifier(rawgrade, RouteType.Leadclimb);
}

/** convertCompetitionStringToClassifier
 * Turns a competition grade string into its classifier
 * @param competitionString: The competition string to convert
 */
export function convertCompetitionStringToClassifier(
  competitionString: string
) {
  const rawgrade = competitionString.charCodeAt(0) - 'A'.charCodeAt(0);
  return new RouteClassifier(rawgrade * 20 + 50, RouteType.Competition);
}
