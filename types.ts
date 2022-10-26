import { DocumentReference, DocumentData } from 'firebase/firestore';
import { getDoc } from "firebase/firestore";

export enum UserStatus {
    Unverified = 0,
    Verified = 1,
    Approved = 2,
    Employee = 3,
    Manager = 4,
    Developer = 5,
}

class LazyObject {
    protected docRef: DocumentReference<DocumentData>;
    protected hasData: boolean;

    constructor(docRef: DocumentReference<DocumentData>) {
        this.docRef = docRef;
        this.hasData = false;
    }
}

export class User extends LazyObject{

    private username: string | undefined;
    private passwordHash: string | undefined;
    private bio: string | undefined;
    private status: UserStatus | undefined;
    private sends: Send[] | undefined;
    private following: User[] | undefined;
    private followers: User[] | undefined;

    private async getData() {
        if(this.hasData) return;
        const docSnap = await getDoc(this.docRef)
        if(docSnap.exists()) {
            const data = docSnap.data();

            this.username = data.username;
            this.passwordHash = data.passwordHash;
            this.bio = data.bio;
            this.status = data.status as UserStatus;
            this.sends = data.sends.map((ref: DocumentReference<DocumentData>) => new Send(ref));
            this.following = data.following.map((ref: DocumentReference<DocumentData>) => new User(ref));
            this.followers = data.followers.map((ref: DocumentReference<DocumentData>) => new User(ref));

            this.hasData = true;
        }
    }

    public async getUsername() {
        if(!this.hasData) await this.getData();
        return this.username!;
    }

    public async getPasswordHash() {
        if(!this.hasData) await this.getData();
        return this.passwordHash!;
    }

    public async getBio() {
        if(!this.hasData) await this.getData();
        return this.bio!;
    }

    public async getStatus() {
        if(!this.hasData) await this.getData();
        return this.status!;
    }

    public async getSends() {
        if(!this.hasData) await this.getData();
        return this.sends!;
    }

    public async getFollowing() {
        if(!this.hasData) await this.getData();
        return this.following!;
    }

    public async getFollowers() {
        if(!this.hasData) await this.getData();
        return this.followers!;
    }
}

export class Send extends LazyObject{
    private attempts: number | undefined;
    private timestamp: Date | undefined;
    private route: Route | undefined;

    private async getData() {
        if(this.hasData) return;
        const docSnap = await getDoc(this.docRef)
        if(docSnap.exists()) {
            const data = docSnap.data();

            this.attempts = data.attempts;
            this.timestamp = data.timestamp;
            this.route = new Route(data.route);

            this.hasData = true;
        }
    }

    public async getAttempts() {
        if(!this.hasData) await this.getData();
        return this.attempts!;
    }
    
    public async getTimestamp() {
        if(!this.hasData) await this.getData();
        return this.timestamp!;
    }

    public async getRoute() {
        if(!this.hasData) await this.getData();
        return this.route!;
    }
}

export class Route extends LazyObject{
    private name: string | undefined;
    private rating: string | undefined;
    private setter: User | undefined;
    private thread: Thread | undefined;
    private likes: User[] | undefined;
    private tags: Tag[] | undefined;

    private async getData() {
        if(this.hasData) return;
        const docSnap = await getDoc(this.docRef)
        if(docSnap.exists()) {
            const data = docSnap.data();

            this.name = data.name;
            this.rating = data.rating;
            this.setter = new User(data.setter);
            this.thread = new Thread(data.thread);
            this.likes = data.likes.map((ref: DocumentReference<DocumentData>) => new User(ref));
            this.tags = data.tags.map((ref: DocumentReference<DocumentData>) => new Tag(ref));

            this.hasData = true;
        }
    }

    public async getName() {
        if(!this.hasData) await this.getData();
        return this.name!;
    }

    public async getRating() {
        if(!this.hasData) await this.getData();
        return this.rating!;
    }
    
    public async getSetter() {
        if(!this.hasData) await this.getData();
        return this.setter!;
    }

    public async getThread() {
        if(!this.hasData) await this.getData();
        return this.thread!;
    }

    public async getLikes() {
        if(!this.hasData) await this.getData();
        return this.likes!;
    }

    public async getTags() {
        if(!this.hasData) await this.getData();
        return this.tags!;
    }
}

export class Thread extends LazyObject{
    private messages: Message[] | undefined;

    private async getData() {
        if(this.hasData) return;
        const docSnap = await getDoc(this.docRef)
        if(docSnap.exists()) {
            const data = docSnap.data();

            this.messages = data.messages.map((ref: DocumentReference<DocumentData>) => new Message(ref));

            this.hasData = true;
        }
    }

    public async getMessages() {
        if(!this.hasData) await this.getData();
        return this.messages!;
    }
} 

export class Message extends LazyObject{
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
}

export class Tag extends LazyObject{
    private name: string | undefined;
    private description: string | undefined;

    private async getData() {
        if(this.hasData) return;
        const docSnap = await getDoc(this.docRef)
        if(docSnap.exists()) {
            const data = docSnap.data();

            this.name = data.name;
            this.description = data.description;

            this.hasData = true;
        }
    }

    public async getName() {
        if(!this.hasData) await this.getData();
        return this.name!;
    }

    public async getDescription() {
        if(!this.hasData) await this.getData();
        return this.description!;
    }
}

export class Badge extends LazyObject{
    private name: string | undefined;
    private description: string | undefined;

    private async getData() {
        if(this.hasData) return;
        const docSnap = await getDoc(this.docRef)
        if(docSnap.exists()) {
            const data = docSnap.data();

            this.name = data.name;
            this.description = data.description;

            this.hasData = true;
        }
    }

    public async getName() {
        if(!this.hasData) await this.getData();
        return this.name!;
    }

    public async getDescription() {
        if(!this.hasData) await this.getData();
        return this.description!;
    }
}