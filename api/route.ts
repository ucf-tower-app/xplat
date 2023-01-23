/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  Transaction,
  collection,
  doc,
  orderBy,
  runTransaction,
  where,
} from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../Firebase';
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

export interface CreateRouteArgs {
  name: string;
  classifier: RouteClassifier;
  description?: string;
  tags?: Tag[];
  setter?: User;
  rope?: number;
  thumbnail?: Blob;
  color?: string;
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
}: CreateRouteArgs) {
  const newRouteDocRef = doc(collection(db, 'routes'));
  const newForumDocRef = doc(collection(db, 'forums'));

  if (thumbnail) {
    await uploadBytes(
      ref(storage, 'routeThumbnails/' + newRouteDocRef.id),
      thumbnail
    );
  }

  return runTransaction(db, async (transaction: Transaction) => {
    const cacheDocRef = doc(db, 'caches', 'allRoutes');

    const routeNameToRoute = (await transaction.get(cacheDocRef)).data()!
      .routeNameToRoute;
    routeNameToRoute[name] = newRouteDocRef;

    transaction.update(cacheDocRef, { routeNameToRoute: routeNameToRoute });
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

/** getAllBoulderClassifiers
 * Get list of all boulder classifiers
 */
export function getAllBoulderClassifiers() {
  return [-1, 0, 1, 2, 3, 4, 5, 6, 7].map(
    (x) => new RouteClassifier(x, RouteType.Boulder)
  );
}

/** getAllTraverseRouteClassifiers
 * Get list of all traverse classifiers
 */
export function getAllTraverseRouteClassifiers() {
  return [1, 2, 3, 4].map((x) => new RouteClassifier(x, RouteType.Traverse));
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

/** getAllLeadclimbRouteClassifiers
 * Get list of all lead climb classifiers
 */
export function getAllLeadclimbRouteClassifiers() {
  return [
    49, 50, 51, 59, 60, 61, 69, 70, 71, 79, 80, 81, 89, 90, 91, 99, 100, 101,
    109, 110, 111, 119, 120, 121, 129, 130, 131,
  ].map((x) => new RouteClassifier(x, RouteType.Leadclimb));
}

/** getAllCompetitionRouteClassifiers
 * Get list of all comp route classifiers
 */
export function getAllCompetitionRouteClassifiers() {
  return [1, 2, 3, 4].map((x) => new RouteClassifier(x, RouteType.Competition));
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
