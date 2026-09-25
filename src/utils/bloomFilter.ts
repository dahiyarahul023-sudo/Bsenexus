/**
 * High-Performance Client-Side Bloom Filter
 * Browser-compatible implementation of Kirsch-Mitzenmacher double-hashing
 * Zero False Negatives for instant client-side ticker & ID validation
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

  constructor(expectedCapacity: number = 20000, desiredFalsePositiveRate: number = 0.01) {
    this.capacity = Math.max(100, expectedCapacity);
    const p = Math.max(0.0001, Math.min(0.2, desiredFalsePositiveRate));

    const rawBits = Math.ceil(-(this.capacity * Math.log(p)) / (Math.LN2 * Math.LN2));
    this.byteSize = Math.ceil(rawBits / 8);
    this.bitSize = this.byteSize * 8;
    this.bitArray = new Uint8Array(this.byteSize);
    this.hashCount = Math.max(1, Math.min(16, Math.round((this.bitSize / this.capacity) * Math.LN2)));
  }

  private fnv1a(str: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
  }

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
    return (h >>> 0) || 1;
  }

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

  public add(key: string): void {
    if (!key) return;
    const indices = this.getBitIndices(String(key).trim().toUpperCase());
    for (const bitIndex of indices) {
      const byteIdx = bitIndex >> 3;
      const bitOffset = bitIndex & 7;
      this.bitArray[byteIdx] |= (1 << bitOffset);
    }
    this.itemsCount++;
  }

  public has(key: string): boolean {
    if (!key) return false;
    const indices = this.getBitIndices(String(key).trim().toUpperCase());

    for (const bitIndex of indices) {
      const byteIdx = bitIndex >> 3;
      const bitOffset = bitIndex & 7;
      if ((this.bitArray[byteIdx] & (1 << bitOffset)) === 0) {
        this.negativeBypasses++;
        return false; // DEFINITELY NOT IN SET (0 DB / API Hit needed!)
      }
    }

    this.positiveChecks++;
    return true; // POSSIBLY IN SET
  }

  public getStats(): BloomFilterStats {
    const exponent = -(this.hashCount * this.itemsCount) / this.bitSize;
    const estimatedFPR = Math.pow(1 - Math.exp(exponent), this.hashCount);
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

  public clear(): void {
    this.bitArray.fill(0);
    this.itemsCount = 0;
    this.negativeBypasses = 0;
    this.positiveChecks = 0;
  }
}
