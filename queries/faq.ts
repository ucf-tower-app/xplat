import { getDoc, doc, runTransaction, Transaction } from "firebase/firestore";
import { db } from "../Firebase";
import { FAQCollection } from "../types/faq";

const FAQDocRef = 'frequentlyasked';
const FAQcollection = 'faq';

export async function getFAQs(): Promise<FAQCollection>
{
  return (await getDoc(doc(db, FAQcollection, FAQDocRef))).data()!.cards as FAQCollection;
}

export async function setFAQs(FAQArray: FAQCollection)
{
  return runTransaction(db, async (transaction: Transaction) => {
    const docref = doc(db, FAQcollection, FAQDocRef);

    transaction.set(docref, {
      cards: FAQArray
    });
  });
}