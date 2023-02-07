import { getDoc } from 'firebase/firestore';
import { getUserById } from '../api';
import {
  User,
  getMonthlyLeaderboardDocRef,
  getSemesterLeaderboardDocRef,
} from '../types';

export interface LeaderboardEntry {
  user: User;
  displayName: string;
  points: number;
  sends: number;
}

export function getRQParams_MonthlyLeaderboard(date: Date) {
  return {
    queryKey: ['leaderboard', getMonthlyLeaderboardDocRef(date).id],
    queryFn: async () => {
      return getDoc(getMonthlyLeaderboardDocRef(date)).then((snap) => {
        if (snap.exists()) {
          return Object.entries(snap.data().data ?? {}).map(
            (a) =>
              ({
                ...(a[1] as {
                  displayName: string;
                  points: number;
                  sends: number;
                }),
                user: getUserById(a[0]),
              } as LeaderboardEntry)
          );
        }
      });
    },
  };
}

export function getRQParams_SemesterLeaderboard(date: Date) {
  return {
    queryKey: ['leaderboard', getSemesterLeaderboardDocRef(date).id],
    queryFn: async () => {
      return getDoc(getSemesterLeaderboardDocRef(date)).then((snap) => {
        if (snap.exists()) {
          return Object.entries(snap.data().data ?? {}).map(
            (a) =>
              ({
                ...(a[1] as {
                  displayName: string;
                  points: number;
                  sends: number;
                }),
                user: getUserById(a[0]),
              } as LeaderboardEntry)
          );
        }
      });
    },
  };
}
