import { LazyObject } from "./common";
import { DocumentReference, DocumentData, getDoc } from "firebase/firestore";
import { User } from "./types";

export class Post extends LazyObject{
    private author: User | undefined;
    private timestamp: Date | undefined;
    private textContent: string | undefined;
    private likes: User[] | undefined;

    private async getData() {
        if(this.hasData) return;
        const docSnap = await getDoc(this.docRef)
        if(docSnap.exists()) {
            const data = docSnap.data();

            this.author = new User(data.author);
            this.timestamp = data.timestamp;
            this.textContent = data.textContent;
            this.likes = data.likes.map((ref: DocumentReference<DocumentData>) => new User(ref));

            this.hasData = true;
        }
    }

    public async getAuthor() {
        if(!this.hasData) await this.getData();
        return this.author!;
    }

    public async getTimestamp() {
        if(!this.hasData) await this.getData();
        return this.timestamp!;
    }

    public async getTextContent() {
        if(!this.hasData) await this.getData();
        return this.textContent!;
    }

    public async getLikes() {
        if(!this.hasData) await this.getData();
        return this.likes!;
    }

    public async getComments() {
        if(!this.hasData) await this.getData();
    }
}