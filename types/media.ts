import { ref } from 'firebase/storage';
import { storage } from '../Firebase';
import { getUrl } from '../api';

export class LazyStaticImage {
  protected imagePath: string;
  protected imageUrl?: string;

  constructor(imagePath: string, imageUrl?: string) {
    this.imagePath = imagePath;
    this.imageUrl = imageUrl;
  }

  public pathEqual(path: string) {
    return this.imagePath === path;
  }

  public async getImageUrl() {
    if (this.imageUrl === undefined) {
      this.imageUrl = await getUrl(this.imagePath);
    }
    return this.imageUrl;
  }

  public getStorageRef() {
    return ref(storage, this.imagePath);
  }
}

export class LazyStaticVideo {
  protected thumbnailPath: string;
  protected thumbnailUrl?: string;
  protected videoPath: string;
  protected videoUrl?: string;

  constructor(
    thumbnailPath: string,
    videoPath: string,
    thumbnailUrl?: string,
    videoUrl?: string
  ) {
    this.thumbnailPath = thumbnailPath;
    this.videoPath = videoPath;
    this.thumbnailUrl = thumbnailUrl;
    this.videoUrl = videoUrl;
  }

  public async getThumbnailUrl() {
    if (this.thumbnailUrl === undefined) {
      this.thumbnailUrl = await getUrl(this.thumbnailPath);
    }
    return this.thumbnailUrl;
  }

  public async getVideoUrl() {
    if (this.videoUrl === undefined) {
      this.videoUrl = await getUrl(this.videoPath);
    }
    return this.videoUrl;
  }

  public getThumbnailStorageRef() {
    return ref(storage, this.thumbnailPath);
  }

  public getVideoStorageRef() {
    return ref(storage, this.videoPath);
  }
}
