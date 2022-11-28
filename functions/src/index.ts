/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {EventContext} from "firebase-functions";
import {DocumentSnapshot} from "firebase-functions/v1/firestore";
admin.initializeApp();
const db = admin.firestore();

exports.addUserToCache = functions.firestore.document("/users/{userId}")
    .onCreate((snap, context: EventContext) => {
      const username: string = snap.data().username;
      const uid: string = context.params.userId;

      functions.logger.log("Adding user", username, "with id", uid);
      return db.doc("caches/users").get()
          .then((userCacheSnap: DocumentSnapshot) => {
            const map = userCacheSnap.data()!.usernameToUserID;
            map[username] = uid;
            return db.doc("caches/users").set({usernameToUserID: map},
                {merge: true});
          })
          .catch((error) => {
            functions.logger.log(error);
          });
    });
