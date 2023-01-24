function clean(str: string) {
  return str.toLowerCase().replace(/\s/g, '');
}

/** class SubstringMatcher
 * Given either a list of strings or a map from string to some T, support matching
 * For matching, spaces are removed and case is ignored to allow for less strict matching
 * @method getMatches: Return all values whose key contains the query as a substring
 */
export class SubstringMatcher<T> {
  private cleanToOutput: Map<string, T>;
  constructor(source: string[] | Map<string, T>) {
    this.cleanToOutput = new Map<string, T>();
    if (source instanceof Map) {
      source.forEach((v, k) => this.cleanToOutput.set(clean(k), v));
    } else {
      source.forEach((v) => this.cleanToOutput.set(clean(v), v as T));
    }
  }

  public getMatches(substring: string) {
    substring = clean(substring);
    const res: T[] = [];
    this.cleanToOutput.forEach((v, k) => {
      if (k.includes(substring)) res.push(v);
    });
    return Array.from(new Set(res.flat(10)));
  }
}
