/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  collection,
  doc,
  DocumentReference,
  getDoc,
  runTransaction,
  Transaction,
} from 'firebase/firestore';
import { db } from '../Firebase';
import { Route, RouteStatus, User } from '../types/types';

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

/** createRoute
 * Creates a route
 * @param name: The route's name
 * @param rating: The route's rating
 * @param setter: The Tower User of the setter, or undefined. Defaults to undefined.
 * @returns The newly created Route
 */
export function createRoute(
  name: string,
  rating: string,
  setter: User | undefined = undefined
) {
  return runTransaction(db, async (transaction: Transaction) => {
    const newRouteDocRef = doc(collection(db, 'routes'));
    const newForumDocRef = doc(collection(db, 'forums'));
    const cacheDocRef = doc(db, 'caches', 'allRoutes');

    const routeNameToRoute = (await transaction.get(cacheDocRef)).data()!
      .routeNameToRoute;
    routeNameToRoute[name] = newRouteDocRef;

    transaction.update(cacheDocRef, { routeNameToRoute: routeNameToRoute });
    transaction.set(newRouteDocRef, {
      name: name,
      rating: rating,
      ...(setter && { setter: setter.docRef! }),
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

/** getActiveRoutes
 * Get a list of all the active routes
 * @returns A list of Tower Routes
 */
export async function getActiveRoutes() {
  const cacheDocRef = doc(db, 'caches', 'activeRoutes');
  const routeNameToRoute: Object = (await getDoc(cacheDocRef)).data()!
    .routeNameToRoute;
  return Object.values(routeNameToRoute).map(
    (ref: DocumentReference) => new Route(ref)
  );
}

/** getAllRoutes
 * Get a list of all the active and archived routes
 * @returns A list of Tower Routes
 */
export async function getAllRoutes() {
  const cacheDocRef = doc(db, 'caches', 'allRoutes');
  const routeNameToRoute: Object = (await getDoc(cacheDocRef)).data()!
    .routeNameToRoute;
  return Object.values(routeNameToRoute).map(
    (ref: DocumentReference) => new Route(ref)
  );
}
