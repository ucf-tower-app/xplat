import { db } from './Firebase.js'
import { doc } from "firebase/firestore";
import { User, Send} from "./types"

export async function testConnection() {
    const docRef = doc(db, 'users', 'dummy')

    const user = new User(docRef);
    console.log(user);
    const send: Send = (await user.getSends())[0]
    await send.getAttempts()
    console.log(send)
}

export async function getUserById(id: string) {
    return new User(doc(db, 'users', id))
}