/**
 * High-Performance Bloom Filter for Real-Time Deduplication & 0-Query DB Defense
 *
 * Implements the Kirsch-Mitzenmacher optimization (double-hashing with FNV-1a & Murmur3)
 * Provides O(1) membership testing with mathematically guaranteed ZERO False Negatives:
 * - If .has(key) returns FALSE: The item is 100% DEFINITELY NOT in the database (0 DB read).
 * - If .has(key) returns TRUE: The item is POSSIBLY in the database (perform 1 targeted lookup).
 */

export interface BloomFilterStats {
  capacity: number;
  itemsCount: number;
  bitSize: number;
  byteSize: number;
  hashCount: number;
  negativeBypasses: number;
  positiveChecks: number;
  currentFalsePositiveRate: number;
  memorySavedKb: number;
}

export class BloomFilter {
  private bitArray: Uint8Array;
  private bitSize: number;
  private byteSize: number;
  private hashCount: number;
  private capacity: number;
  private itemsCount: number = 0;
  private negativeBypasses: number = 0;
  private positiveChecks: number = 0;

  constructor(expectedCapacity: number = 50000, desiredFalsePositiveRate: number = 0.01) {
    this.capacity = Math.max(100, expectedCapacity);
    const p = Math.max(0.0001, Math.min(0.2, desiredFalsePositiveRate));

    // Optimal bit array size: m = -(n * ln(p)) / (ln(2)^2)
    const rawBits = Math.ceil(-(this.capacity * Math.log(p)) / (Math.LN2 * Math.LN2));
    this.byteSize = Math.ceil(rawBits / 8);
    this.bitSize = this.byteSize * 8;
    this.bitArray = new Uint8Array(this.byteSize);

    // Optimal hash count: k = (m / n) * ln(2)
    this.hashCount = Math.max(1, Math.min(16, Math.round((this.bitSize / this.capacity) * Math.LN2)));
  }

  /**
   * 32-bit FNV-1a Hash (h1)
   */
  private fnv1a(str: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
  }

  /**
   * 32-bit Murmur3-like Hash (h2)
   */
  private murmur3(str: string): number {
    let h = 0x9747b28c;
    for (let i = 0; i < str.length; i++) {
      let k = str.charCodeAt(i);
      k = Math.imul(k, 0xcc9e2d51);
      k = (k << 15) | (k >>> 17);
      k = Math.imul(k, 0x1b873593);
      h ^= k;
      h = (h << 13) | (h >>> 19);
      h = Math.imul(h, 5) + 0xe6546b64;
    }
    h ^= str.length;
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return (h >>> 0) || 1; // Non-zero step
  }

  /**
   * Get the k bit indices for a given string key using Kirsch-Mitzenmacher
   */
  public getBitIndices(key: string): number[] {
    const h1 = this.fnv1a(key);
    const h2 = this.murmur3(key);
    const indices: number[] = [];

    for (let i = 0; i < this.hashCount; i++) {
      const bitIndex = (h1 + Math.imul(i, h2)) % this.bitSize;
      indices.push(bitIndex >= 0 ? bitIndex : bitIndex + this.bitSize);
    }
    return indices;
  }

  /**
   * Add a key into the Bloom filter
   */
  public add(key: string): void {
    if (!key) return;
    const indices = this.getBitIndices(String(key));
    for (const bitIndex of indices) {
      const byteIdx = bitIndex >> 3; // bitIndex / 8
      const bitOffset = bitIndex & 7; // bitIndex % 8
      this.bitArray[byteIdx] |= (1 << bitOffset);
    }
    this.itemsCount++;
  }

  /**
   * Check if a key might be in the set
   * Returns false = 100% GUARANTEED NOT PRESENT (0 DB queries needed!)
   * Returns true = POSSIBLY PRESENT (verify with database/cache)
   */
  public has(key: string): boolean {
    if (!key) return false;
    const indices = this.getBitIndices(String(key));

    for (const bitIndex of indices) {
      const byteIdx = bitIndex >> 3;
      const bitOffset = bitIndex & 7;
      if ((this.bitArray[byteIdx] & (1 << bitOffset)) === 0) {
        this.negativeBypasses++;
        return false; // DEFINITELY NOT PRESENT
      }
    }

    this.positiveChecks++;
    return true; // POSSIBLY PRESENT
  }

  /**
   * Get real-time telemetry and efficiency metrics
   */
  public getStats(): BloomFilterStats {
    // Current theoretical false positive rate: (1 - e^(-k * n / m))^k
    const exponent = -(this.hashCount * this.itemsCount) / this.bitSize;
    const estimatedFPR = Math.pow(1 - Math.exp(exponent), this.hashCount);

    // Approximate memory that a Set<string> of these items would take (~48 bytes per string key)
    const rawSetBytes = this.itemsCount * 48;
    const memorySavedKb = Math.max(0, Math.round((rawSetBytes - this.byteSize) / 1024));

    return {
      capacity: this.capacity,
      itemsCount: this.itemsCount,
      bitSize: this.bitSize,
      byteSize: this.byteSize,
      hashCount: this.hashCount,
      negativeBypasses: this.negativeBypasses,
      positiveChecks: this.positiveChecks,
      currentFalsePositiveRate: Number(estimatedFPR.toFixed(5)),
      memorySavedKb
    };
  }

  /**
   * Reset filter
   */
  public clear(): void {
    this.bitArray.fill(0);
    this.itemsCount = 0;
    this.negativeBypasses = 0;
    this.positiveChecks = 0;
  }

  /**
   * Export compact state as base64 string
   */
  public exportBase64(): string {
    return Buffer.from(this.bitArray).toString('base64');
  }

  /**
   * Import from base64 string
   */
  public importBase64(b64: string): void {
    const buf = Buffer.from(b64, 'base64');
    if (buf.length === this.byteSize) {
      this.bitArray.set(buf);
    }
  }
}
