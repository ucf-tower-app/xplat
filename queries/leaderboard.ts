import { getDoc } from 'firebase/firestore';
import { getUserById } from '../api';
import {
  getMonthlyLeaderboardDocRef,
  getSemesterLeaderboardDocRef,
  User,
} from '../types';

export interface LeaderboardEntry {
  user: User;
  displayName: string;
  points: number;
  sends: number;
}

export function getRQKey_MonthlyLeaderboard(date: Date) {
  return ['leaderboard', getMonthlyLeaderboardDocRef(date).id];
}

export function getRQParams_MonthlyLeaderboard(date: Date) {
  return {
    queryKey: getRQKey_MonthlyLeaderboard(date),
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

export function getRQKey_SemesterLeaderboard(date: Date) {
  return ['leaderboard', getSemesterLeaderboardDocRef(date).id];
}

export function getRQParams_SemesterLeaderboard(date: Date) {
  return {
    queryKey: getRQKey_SemesterLeaderboard(date),
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
