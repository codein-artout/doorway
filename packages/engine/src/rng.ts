// Seeded RNG (R30): sfc32, seeded by cyrb128 string hashing. State serializes to a hex string.

export type RngState = [number, number, number, number];

/** cyrb128: hashes a string into four 32-bit words (public domain, bryc). */
export function cyrb128(str: string): RngState {
  let h1 = 1779033703,
    h2 = 3144134277,
    h3 = 1013904242,
    h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

/** A small mutable sfc32 generator. Deterministic given its state. */
export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(state: RngState) {
    [this.a, this.b, this.c, this.d] = state;
  }

  static fromSeed(seed: string): Rng {
    const r = new Rng(cyrb128(seed));
    // warm up
    for (let i = 0; i < 12; i++) r.nextU32();
    return r;
  }

  static fromString(s: string): Rng {
    const parts = s.split(':').map((x) => parseInt(x, 16) >>> 0);
    if (parts.length !== 4 || parts.some((x) => Number.isNaN(x))) throw new Error(`Bad rng state "${s}"`);
    return new Rng(parts as RngState);
  }

  toString(): string {
    return [this.a, this.b, this.c, this.d].map((x) => (x >>> 0).toString(16).padStart(8, '0')).join(':');
  }

  nextU32(): number {
    this.a >>>= 0;
    this.b >>>= 0;
    this.c >>>= 0;
    this.d >>>= 0;
    let t = (this.a + this.b) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.d = (this.d + 1) | 0;
    t = (t + this.d) | 0;
    this.c = (this.c + t) | 0;
    return t >>> 0;
  }

  /** float in [0, 1) */
  next(): number {
    return this.nextU32() / 4294967296;
  }

  /** integer in [0, n) */
  int(n: number): number {
    if (n <= 0) throw new Error('Rng.int: n must be > 0');
    return Math.floor(this.next() * n);
  }

  pick<T>(arr: readonly T[]): T {
    return arr[this.int(arr.length)];
  }

  /** in-place Fisher–Yates shuffle */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }
}

/** Seed for a bot's private stream: hash(gameSeed, seat, policyId) (R30). */
export function botSeed(gameSeed: string, seat: number, policyId: string): string {
  return `bot|${gameSeed}|${seat}|${policyId}`;
}
