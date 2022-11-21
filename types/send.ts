/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { LazyObject } from './common';
import { Route } from './types';

export class Send extends LazyObject {
  private attempts: number | undefined;
  private timestamp: Date | undefined;
  private route: Route | undefined;

  private async getData() {
    if (this.hasData) return;

    const data = await this.getDocumentData();
    if (data !== undefined) {
      this.attempts = data.attempts;
      this.timestamp = data.timestamp;
      this.route = new Route(data.route);

      this.hasData = true;
    }
  }

  public async getAttempts() {
    if (!this.hasData) await this.getData();
    return this.attempts!;
  }

  public async getTimestamp() {
    if (!this.hasData) await this.getData();
    return this.timestamp!;
  }

  public async getRoute() {
    if (!this.hasData) await this.getData();
    return this.route!;
  }
}
