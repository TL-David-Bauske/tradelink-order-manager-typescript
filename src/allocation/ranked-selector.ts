export class RankedSelector<T> {
  constructor(
    private readonly compare: (left: T, right: T) => number,
    private readonly qualifies: (candidate: T) => Promise<boolean>,
  ) {}

  async select(candidates: T[]): Promise<T | undefined> {
    for (const candidate of [...candidates].sort(this.compare)) {
      if (await this.qualifies(candidate)) return candidate;
    }
    return undefined;
  }
}
