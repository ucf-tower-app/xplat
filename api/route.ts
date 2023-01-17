/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  collection,
  doc,
  DocumentReference,
  getDoc,
  runTransaction,
  Transaction,
} from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../Firebase';
import { Route, RouteStatus, Tag, User } from '../types/types';

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
  rating: string;
  type: string;
  description?: string;
  tags?: Tag[];
  setter?: User;
  rope?: number;
  thumbnail?: Blob;
}

/** createRoute
 * Creates a route
 * @param name: The route's name
 * @param rating: The route's rating
 * @param setter: The Tower User of the setter, or undefined. Defaults to undefined.
 * @returns The newly created Route
 */
export async function createRoute({
  name,
  rating,
  type,
  description = undefined,
  tags = undefined,
  setter = undefined,
  rope = undefined,
  thumbnail = undefined,
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
      rating: rating,
      type: type,
      ...(setter && { setter: setter.docRef! }),
      ...(rope && { rope: rope }),
      ...(tags && { tags: tags }),
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

/** getActiveRoutes
 * Get a list of all the active routes
 * @returns A list of Tower Routes
 */
export async function getActiveRoutes() {
  const cacheDocRef = doc(db, 'caches', 'activeRoutes');
  const routeNameToRoute: Record<string, DocumentReference> = (
    await getDoc(cacheDocRef)
  ).data()!.routeNameToRoute;
  return Object.values(routeNameToRoute).map((ref) => new Route(ref));
}

/** getAllRoutes
 * Get a list of all the active and archived routes
 * @returns A list of Tower Routes
 */
export async function getAllRoutes() {
  const cacheDocRef = doc(db, 'caches', 'allRoutes');
  const routeNameToRoute: Record<string, DocumentReference> = (
    await getDoc(cacheDocRef)
  ).data()!.routeNameToRoute;
  return Object.values(routeNameToRoute).map((ref) => new Route(ref));
}
