import { Route } from '../types/types';
import { db } from '../Firebase';
import { doc } from 'firebase/firestore';

export function getRouteById(routeId: string) {
  return new Route(doc(db, 'routes', routeId));
}
