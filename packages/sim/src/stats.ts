// Small statistics toolkit (no dependencies).

/** Wilson score interval for a proportion; `k` may be fractional (shared wins count 1/k). */
export function wilson(k: number, n: number, z = 1.959964): { p: number; lo: number; hi: number } {
  if (n <= 0) return { p: NaN, lo: NaN, hi: NaN };
  const p = k / n;
  const z2 = z * z;
  const den = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / den;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / den;
  return { p, lo: Math.max(0, centre - half), hi: Math.min(1, centre + half) };
}

export function mean(xs: number[]): number {
  if (!xs.length) return NaN;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

export function sd(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  let s = 0;
  for (const x of xs) s += (x - m) * (x - m);
  return Math.sqrt(s / (xs.length - 1));
}

export function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function histogram(xs: number[], binWidth: number, min?: number, max?: number) {
  const lo = min ?? Math.floor(Math.min(...xs) / binWidth) * binWidth;
  const hi = max ?? Math.ceil((Math.max(...xs) + 1e-9) / binWidth) * binWidth;
  const bins = Math.max(1, Math.round((hi - lo) / binWidth));
  const counts = new Array(bins).fill(0);
  for (const x of xs) counts[Math.min(bins - 1, Math.max(0, Math.floor((x - lo) / binWidth)))]++;
  return { lo, binWidth, counts };
}

/** Running accumulator for mean / sd without storing values. */
export class Acc {
  n = 0;
  sum = 0;
  sq = 0;
  add(x: number, w = 1) {
    this.n += w;
    this.sum += x * w;
    this.sq += x * x * w;
  }
  get mean() {
    return this.n ? this.sum / this.n : NaN;
  }
  get sd() {
    if (this.n < 2) return 0;
    const v = (this.sq - (this.sum * this.sum) / this.n) / (this.n - 1);
    return Math.sqrt(Math.max(0, v));
  }
  toJSON() {
    return { n: this.n, mean: round(this.mean, 4), sd: round(this.sd, 4) };
  }
}

export const round = (x: number, d = 3) => (Number.isFinite(x) ? Math.round(x * 10 ** d) / 10 ** d : x);

/** Point-biserial correlation between a binary-ish outcome y and x (Pearson r). */
export function pearson(x: number[], y: number[]): number {
  const n = x.length;
  const mx = mean(x),
    my = mean(y);
  let sxy = 0,
    sxx = 0,
    syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  return sxy / Math.sqrt(sxx * syy);
}

/**
 * Logistic regression by Newton–Raphson (IRLS) on standardized features.
 * Returns coefficients per feature (in standard deviations), with the intercept first.
 */
export function logistic(X: number[][], y: number[], iters = 25, ridge = 1e-6): number[] {
  const n = X.length;
  const k = X[0].length + 1;
  const beta = new Array(k).fill(0);
  for (let it = 0; it < iters; it++) {
    const g = new Array(k).fill(0);
    const H = Array.from({ length: k }, () => new Array(k).fill(0));
    for (let i = 0; i < n; i++) {
      const xi = [1, ...X[i]];
      let z = 0;
      for (let j = 0; j < k; j++) z += beta[j] * xi[j];
      const p = 1 / (1 + Math.exp(-z));
      const w = p * (1 - p);
      for (let a = 0; a < k; a++) {
        g[a] += (y[i] - p) * xi[a];
        for (let b = 0; b < k; b++) H[a][b] += w * xi[a] * xi[b];
      }
    }
    for (let a = 0; a < k; a++) H[a][a] += ridge;
    const step = solve(H, g);
    let delta = 0;
    for (let j = 0; j < k; j++) {
      beta[j] += step[j];
      delta = Math.max(delta, Math.abs(step[j]));
    }
    if (delta < 1e-8) break;
  }
  return beta;
}

function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    [M[c], M[piv]] = [M[piv], M[c]];
    const d = M[c][c] || 1e-12;
    for (let j = c; j <= n; j++) M[c][j] /= d;
    for (let r = 0; r < n; r++)
      if (r !== c) {
        const f = M[r][c];
        for (let j = c; j <= n; j++) M[r][j] -= f * M[c][j];
      }
  }
  return M.map((row) => row[n]);
}

export function standardize(cols: number[][]): { Z: number[][]; means: number[]; sds: number[] } {
  const k = cols.length;
  const n = cols[0].length;
  const means = cols.map(mean);
  const sds = cols.map((c) => sd(c) || 1);
  const Z: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row = new Array(k);
    for (let j = 0; j < k; j++) row[j] = (cols[j][i] - means[j]) / sds[j];
    Z.push(row);
  }
  return { Z, means, sds };
}
