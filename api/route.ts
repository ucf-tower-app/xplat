/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Route, RouteStatus, User } from '../types/types';
import { db } from '../Firebase';
import {
  collection,
  doc,
  runTransaction,
  Transaction,
} from 'firebase/firestore';

export function getRouteById(routeId: string) {
  return new Route(doc(db, 'routes', routeId));
}

export function createRoute(
  name: string,
  rating: string,
  setter: User | undefined = undefined
) {
  return runTransaction(db, async (transaction: Transaction) => {
    const newRouteDocRef = doc(collection(db, 'routes'));
    const newForumDocRef = doc(collection(db, 'forums'));
    const cacheDocRef = doc(db, 'caches', 'routeNameToID');

    const map = (await transaction.get(cacheDocRef)).data()!.map;
    map[name] = newRouteDocRef.id;

    transaction.update(cacheDocRef, { map: map });
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
