import { db } from './Firebase.js'
import { doc, getDoc } from "firebase/firestore";

export async function testConnection() {
    const docRef = doc(db, 'users', 'dummy')
    const docSnap = await getDoc(docRef);

    console.log(docSnap)

    if (docSnap.exists()) {
        console.log("Document data:", docSnap.data());
        const data = docSnap.data()
        console.log(data.sends[0])

        const send = await getDoc(data.sends[0])

        if (send.exists()) console.log("Send: ", send.data())
        else console.log("Unlucky")
    } else console.log("No dummy");

}