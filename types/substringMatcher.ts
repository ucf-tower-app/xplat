function clean(str: string) {
  return str.toLowerCase().replace(' ', '');
}

export class SubstringMatcher {
  private cleanToOutput: Map<string, string>;
  constructor(source: string[] | Map<string, string>) {
    this.cleanToOutput = new Map<string, string>();
    if (source instanceof Map) {
      source.forEach((v, k) => this.cleanToOutput.set(clean(k), v));
    } else {
      source.forEach((v) => this.cleanToOutput.set(clean(v), v));
    }
  }

  public getMatches(substring: string) {
    substring = clean(substring);
    const res: string[] = [];
    this.cleanToOutput.forEach((v, k) => {
      if (k.includes(substring)) res.push(v);
    });
    return res;
  }
}
