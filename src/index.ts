export type NestedArray<T> = T | NestedArray<T>[];

// Utility to detect depth of nested arrays
function getDimension(arr: any): number {
  let dim = 0;
  while (Array.isArray(arr)) {
    dim++;
    arr = arr[0];
  }
  return dim;
}

// Utility to check if a value is BigInt
function isBigInt(value: any): value is bigint {
  return typeof value === "bigint";
}

/**
 * A generic, type-safe multidimensional array class that supports arbitrary nesting depth.
 *
 * Designed for use as both a flexible data store and a math engine, this class provides:
 *
 * - Automatic dimension detection
 * - Shape introspection
 * - Index-based value access and mutation
 * - Element-wise math operations (`add`, `sub`, `mul`, `div`)
 * - Array-style traversal methods (`map`, `forEach`, `filter`, `reduce`, `flatMap`)
 *
 * Supports both `number` and `BigInt` types for mathematical operations.
 *
 * @template T The type of values stored in the array (e.g., `number`, `bigint`)
 *
 * @example
 * const array = new AnyDimensionArray<number>([[1, 2], [3, 4]]);
 * console.log(array.getShape()); // [2, 2]
 * console.log(array.get(1, 0));  // 3
 *
 * const squared = array.map(x => x * x);
 * console.log(squared.getData()); // [[1, 4], [9, 16]]
 */
export class AnyDimensionArray<T> {
  private data: NestedArray<T>;
  private dim: number;

  constructor(data: NestedArray<T>) {
    this.data = data;
    this.dim = getDimension(data);
  }

  /**
   * Returns the number of dimensions in the array.
   * @returns {number} The depth of nesting (e.g., 2 for a 2D array).
   */
  getDimension(): number {
    return this.dim;
  }

  /**
   * Returns the raw nested array data.
   * @returns {NestedArray<T>} The underlying data structure.
   */
  getData(): NestedArray<T> {
    return this.data;
  }

  /**
   * Returns the shape of the array as an array of dimension sizes.
   * @returns {number[]} An array representing the size of each dimension.
   */
  getShape(): number[] {
    const shape: number[] = [];
    let current: any = this.data;
    while (Array.isArray(current)) {
      shape.push(current.length);
      current = current[0];
    }
    return shape;
  }

  /**
   * Retrieves the value at the specified indices.
   * @param {...number} indices - The indices to access (e.g., get(1, 2)).
   * @returns {T} The value at the given location.
   */
  get(...indices: number[]): T {
    let current: any = this.data;
    for (const i of indices) {
      if (!Array.isArray(current)) throw new Error("Too many indices");
      current = current[i];
    }
    return current as T;
  }

  /**
   * Sets the value at the specified indices.
   * @param {...number} indices - The indices to access (e.g., set(1, 2, value)).
   * @param {T} value - The value to assign.
   */
  set(...args: [...indices: number[], value: T]): void {
    const value = args.pop() as T;
    let current: any = this.data;
    for (let i = 0; i < args.length - 1; i++) {
      current = current[args[i]];
    }
    current[args[args.length - 1]] = value;
  }

  /**
   * Applies a function to every element and returns a new array.
   * @param {(value: T) => T} fn - Function to apply to each value.
   * @returns {AnyDimensionArray<T>} A new array with transformed values.
   */
  map(fn: (value: T) => T): AnyDimensionArray<T> {
    function recursiveMap(data: NestedArray<T>): NestedArray<T> {
      if (!Array.isArray(data)) return fn(data);
      return data.map((item) => recursiveMap(item)) as NestedArray<T>;
    }
    return new AnyDimensionArray<T>(recursiveMap(this.data));
  }

  /**
   * Iterates over every element in the array.
   * @param {(value: T, path: number[]) => void} fn - Function called for each value and its index path.
   */
  forEach(fn: (value: T, path: number[]) => void): void {
    function recursive(data: NestedArray<T>, path: number[]) {
      if (!Array.isArray(data)) {
        fn(data, path);
      } else {
        data.forEach((item, i) => recursive(item, [...path, i]));
      }
    }
    recursive(this.data, []);
  }

  /**
   * Filters elements based on a predicate and returns a flat array of matching values.
   * @param {(value: T, path: number[]) => boolean} fn - Predicate function.
   * @returns {T[]} Flat array of values that passed the test.
   */
  filter(fn: (value: T, path: number[]) => boolean): T[] {
    const result: T[] = [];
    this.forEach((value, path) => {
      if (fn(value, path)) result.push(value);
    });
    return result;
  }

  /**
   * Reduces all elements to a single value.
   * @param {(acc: U, value: T, path: number[]) => U} fn - Reducer function.
   * @param {U} initial - Initial accumulator value.
   * @returns {U} Final accumulated result.
   */
  reduce<U>(fn: (acc: U, value: T, path: number[]) => U, initial: U): U {
    let acc = initial;
    this.forEach((value, path) => {
      acc = fn(acc, value, path);
    });
    return acc;
  }

  /**
   * Applies a function to each element and flattens the result into a 1D array.
   * @param {(value: T, path: number[]) => U} fn - Mapping function.
   * @returns {U[]} Flattened array of mapped values.
   */
  flatMap<U>(fn: (value: T, path: number[]) => U): U[] {
    const result: U[] = [];
    this.forEach((value, path) => {
      result.push(fn(value, path));
    });
    return result;
  }

  /**
   * Reshapes the array into a new shape.
   *
   * The total number of elements must remain the same.
   *
   * @param {number[]} newShape - The desired shape (e.g., [2, 3])
   * @returns {AnyDimensionArray<T>} A new array with the reshaped structure
   * @throws {Error} If the shape is incompatible with the number of elements
   */
  reshape(newShape: number[]): AnyDimensionArray<T> {
    const totalElements = this.getFlatData().length;
    const expectedElements = newShape.reduce((acc, val) => acc * val, 1);

    if (totalElements !== expectedElements) {
      throw new Error(
        `Cannot reshape: ${totalElements} elements into shape [${newShape.join(", ")}]`
      );
    }

    const flat = [...this.getFlatData()];
    const build = (shape: number[]): any => {
      if (shape.length === 0) return flat.shift();
      const size = shape[0];
      const rest = shape.slice(1);
      const result = [];
      for (let i = 0; i < size; i++) {
        result.push(build(rest));
      }
      return result;
    };

    return new AnyDimensionArray<T>(build(newShape));
  }

  /**
   * Flattens the nested array structure into a 1D array.
   * Used internally for reshaping and element-wise operations.
   */
  private getFlatData(): T[] {
    const flatten = (arr: any): T[] => {
      if (!Array.isArray(arr)) return [arr];
      return arr.reduce((acc: T[], val: any) => acc.concat(flatten(val)), []);
    };

    return flatten(this.data);
  }

  /**
   * Extracts a subarray based on slice ranges for each dimension.
   *
   * @param {Array<[number, number]>} ranges - An array of [start, end] pairs for each dimension.
   * @returns {AnyDimensionArray<T>} A new array containing the sliced data.
   * @throws {Error} If the number of ranges doesn't match the array's dimensionality.
   *
   * @example
   * const arr = new AnyDimensionArray<number>([[1, 2, 3], [4, 5, 6]]);
   * const sliced = arr.slice([[0, 2], [1, 3]]);
   * console.log(sliced.getData()); // [[2, 3], [5, 6]]
   */
  slice(ranges: Array<[number, number]>): AnyDimensionArray<T> {
    const shape = this.getShape();
    if (ranges.length !== shape.length) {
      throw new Error(
        `Slice dimension mismatch: expected ${shape.length} ranges, got ${ranges.length}`
      );
    }

    const sliceRecursive = (data: any, dim: number): any => {
      const [start, end] = ranges[dim];
      const sliced = data.slice(start, end);
      if (dim === ranges.length - 1) return sliced;
      return sliced.map((sub: any) => sliceRecursive(sub, dim + 1));
    };

    const slicedData = sliceRecursive(this.data, 0);
    return new AnyDimensionArray<T>(slicedData);
  }

  /**
   * Concatenates this array with another array along the first dimension.
   *
   * Allows variation in width (second dimension) and deeper structure.
   *
   * @param {AnyDimensionArray<T>} other - The array to concatenate.
   * @returns {AnyDimensionArray<T>} A new array with combined data.
   *
   * @example
   * const a = new AnyDimensionArray<number>([[1, 2], [3]]);
   * const b = new AnyDimensionArray<number>([[4, 5, 6]]);
   * const result = a.concat(b);
   * console.log(result.getData()); // [[1, 2], [3], [4, 5, 6]]
   */
  concat(other: AnyDimensionArray<T>): AnyDimensionArray<T> {
    if (!Array.isArray(this.data) || !Array.isArray(other.data)) {
      throw new Error(
        "Concat only works on arrays with at least one dimension."
      );
    }

    const combined = [...this.data, ...other.data];
    return new AnyDimensionArray<T>(combined);
  }

  /**
   * Adds a new element to the end of the first dimension.
   *
   * @param {any} item - The item to push (must match the structure of existing elements).
   */
  push(item: any): void {
    if (!Array.isArray(this.data)) {
      throw new Error("Cannot push to a scalar value.");
    }
    this.data.push(item);
  }

  /**
   * Removes and returns the last element from the first dimension.
   *
   * @returns {any} The removed element.
   */
  pop(): any {
    if (!Array.isArray(this.data)) {
      throw new Error("Cannot pop from a scalar value.");
    }
    return this.data.pop();
  }

  // Internal recursive math helper
  private static recursiveMath<T extends number | bigint>(
    a: NestedArray<T>,
    b: NestedArray<T>,
    op: (x: T, y: T) => T
  ): NestedArray<T> {
    if (!Array.isArray(a) && !Array.isArray(b)) return op(a, b);
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) throw new Error("Shape mismatch");
      return a.map((ai, i) => this.recursiveMath(ai, b[i], op));
    }
    throw new Error("Shape mismatch");
  }

  /**
   * Inserts an item at the beginning of the first dimension.
   *
   * @param {any} item - The item to insert.
   * @throws {Error} If the array is scalar and cannot be unshifted.
   */
  unshift(item: any): void {
    if (!Array.isArray(this.data)) {
      throw new Error("Cannot unshift into a scalar value.");
    }
    this.data.unshift(item);
  }

  /**
   * Removes and returns the first item from the first dimension.
   *
   * @returns {any} The removed item.
   * @throws {Error} If the array is scalar and cannot be shifted.
   */
  shift(): any {
    if (!Array.isArray(this.data)) {
      throw new Error("Cannot shift from a scalar value.");
    }
    return this.data.shift();
  }

  /**
   * Performs element-wise addition of two arrays.
   * @param {AnyDimensionArray<T>} a - First operand.
   * @param {AnyDimensionArray<T>} b - Second operand.
   * @returns {AnyDimensionArray<T>} Resulting array after addition.
   */
  static add<T extends number | bigint>(
    a: AnyDimensionArray<T>,
    b: AnyDimensionArray<T>
  ): AnyDimensionArray<T> {
    return new AnyDimensionArray<T>(
      this.recursiveMath(
        a.getData(),
        b.getData(),
        (x, y) => (isBigInt(x) ? x + (y as bigint) : x + (y as any)) as T
      )
    );
  }

  /**
   * Performs element-wise subtraction of two arrays.
   * @param {AnyDimensionArray<T>} a - First operand.
   * @param {AnyDimensionArray<T>} b - Second operand.
   * @returns {AnyDimensionArray<T>} Resulting array after subtraction.
   */
  static sub<T extends number | bigint>(
    a: AnyDimensionArray<T>,
    b: AnyDimensionArray<T>
  ): AnyDimensionArray<T> {
    return new AnyDimensionArray<T>(
      this.recursiveMath(
        a.getData(),
        b.getData(),
        (x, y) => (isBigInt(x) ? x - (y as bigint) : x - (y as number)) as T
      )
    );
  }

  /**
   * Performs element-wise multiplication of two arrays.
   * @param {AnyDimensionArray<T>} a - First operand.
   * @param {AnyDimensionArray<T>} b - Second operand.
   * @returns {AnyDimensionArray<T>} Resulting array after multiplication.
   */
  static mul<T extends number | bigint>(
    a: AnyDimensionArray<T>,
    b: AnyDimensionArray<T>
  ): AnyDimensionArray<T> {
    return new AnyDimensionArray<T>(
      this.recursiveMath(
        a.getData(),
        b.getData(),
        (x, y) => (isBigInt(x) ? x * (y as bigint) : x * (y as number)) as T
      )
    );
  }

  /**
   * Performs element-wise division of two arrays.
   * @param {AnyDimensionArray<T>} a - Numerator array.
   * @param {AnyDimensionArray<T>} b - Denominator array.
   * @returns {AnyDimensionArray<T>} Resulting array after division.
   * @throws {Error} If division by zero occurs.
   */
  static div<T extends number | bigint>(
    a: AnyDimensionArray<T>,
    b: AnyDimensionArray<T>
  ): AnyDimensionArray<T> {
    return new AnyDimensionArray<T>(
      this.recursiveMath(a.getData(), b.getData(), (x, y) => {
        if (isBigInt(x)) {
          if ((y as bigint) === BigInt(0)) throw new Error("Division by zero");
          return (x / (y as bigint)) as T;
        } else {
          if ((y as number) === 0) throw new Error("Division by zero");
          return (x / (y as number)) as T;
        }
      })
    );
  }
}

export enum LengthUnit {
  Meter = "m",
  Kilometer = "km",
  Mile = "mi",
  Foot = "ft",
  Inch = "in",
}

export enum WeightUnit {
  Gram = "g",
  Kilogram = "kg",
  Pound = "lb",
  Ounce = "oz",
}

export enum ClockSpeedUnit {
  Hz = "Hz",
  KHz = "kHz",
  MHz = "MHz",
  GHz = "GHz",
}

export enum SpeedUnit {
  Mps = "m/s",
  Kph = "km/h",
  Mph = "mph",
}

export enum CurrencyUnit {
  USD = "USD",
  EUR = "EUR",
  YEN = "JPY",
}

/**
 * A static utility class for converting between common units of measurement.
 *
 * Supports weight, length, clock speed, speed, and approximate currency conversions.
 *
 * Currency conversions are approximate and should not be used for financial decisions.
 *
 * All methods are static and return converted numeric values.
 */
export class Units {
  /**
   * Converts a numeric value from one unit to another.
   *
   * Supported categories include:
   * - Length (e.g., meters, kilometers, miles)
   * - Weight (e.g., grams, pounds, kilograms)
   * - Clock speed (e.g., Hz, MHz, GHz)
   * - Speed (e.g., m/s, km/h, mph)
   * - Currency (e.g., USD, EUR, JPY — approximate only)
   *
   * Currency conversions are static and may not reflect real-time exchange rates.
   *
   * @param {number} value - The numeric value to convert.
   * @param {string} from - The source unit (e.g., "USD", "m", "Hz").
   * @param {string} to - The target unit (e.g., "EUR", "km", "GHz").
   * @returns {number} The converted value.
   * @throws {Error} If the conversion is unsupported or units are incompatible.
   *
   * @example
   * Units.convert(100, "USD", "EUR"); // ~93
   * Units.convert(2, "GHz", "MHz");   // 2000
   * Units.convert(5, "m", "ft");      // ~16.4
   */
  static convert(value: number, from: string, to: string): number {
    const key = `${from}->${to}`;

    const conversionTable: Record<string, number> = {
      // Length
      "m->km": 0.001,
      "km->m": 1000,
      "m->mi": 0.000621371,
      "mi->m": 1609.34,
      "m->ft": 3.28084,
      "ft->m": 0.3048,
      "m->in": 39.3701,
      "in->m": 0.0254,

      // Weight
      "g->kg": 0.001,
      "kg->g": 1000,
      "lb->kg": 0.453592,
      "kg->lb": 2.20462,
      "oz->g": 28.3495,
      "g->oz": 0.035274,

      // Clock speed
      "Hz->kHz": 0.001,
      "kHz->Hz": 1000,
      "Hz->MHz": 0.000001,
      "MHz->Hz": 1_000_000,
      "Hz->GHz": 0.000000001,
      "GHz->Hz": 1_000_000_000,

      // Speed
      "m/s->km/h": 3.6,
      "km/h->m/s": 0.277778,
      "m/s->mph": 2.23694,
      "mph->m/s": 0.44704,

      // Currency (approximate)
      "USD->EUR": 0.93,
      "EUR->USD": 1.07,
    };

    if (key in conversionTable) {
      return value * conversionTable[key];
    }

    throw new Error(`Unsupported conversion: ${from} to ${to}`);
  }
}

/**
 * Checks if a value is null, undefined,NaN, or empty (string, array, object).
 */
export function isEmpty(value: any): boolean {
  if (value == null) return true;
  if (value == undefined) return true;
  if (isNaN(value)) return true;
  if (typeof value === "string" || Array.isArray(value))
    return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
}

/**
 * Checks if a value is a plain object (not array, function, or class instance).
 */
export function isPlainObject(value: any): boolean {
  return Object.prototype.toString.call(value) === "[object Object]";
}

/**
 * Checks if a value is a number or BigInt.
 */
export function isNumeric(value: any): boolean {
  return typeof value === "number" || typeof value === "bigint";
}

/**
 * Performs a deep equality check between two values.
 */
export function isEqual(a: any, b: any): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Deeply clones an object or array.
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Deeply merges two objects.
 */
export function deepMerge<T>(target: T, source: Partial<T>): T {
  for (const key in source) {
    if (isPlainObject(source[key]) && isPlainObject(target[key])) {
      target[key] = deepMerge(target[key], source[key] as any);
    } else {
      target[key] = source[key] as any;
    }
  }
  return target;
}

/**
 * Flattens a nested array into a 1D array.
 */
export function flatten<T>(arr: any[]): T[] {
  return arr.reduce(
    (acc, val) => acc.concat(Array.isArray(val) ? flatten(val) : val),
    []
  );
}

/**
 * Clamps a number between min and max bounds.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Rounds a number to a fixed number of decimal places.
 */
export function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Linearly interpolates between two values.
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Generates a range of numbers.
 */
export function range(start: number, end: number, step = 1): number[] {
  const result: number[] = [];
  for (let i = start; i < end; i += step) {
    result.push(i);
  }
  return result;
}

/**
 * Checks if the code is running in a browser environment.
 */
export function isBrowser(): boolean {
  return (
    typeof window !== "undefined" && typeof window.document !== "undefined"
  );
}

/**
 * Checks if the code is running in a Node.js environment.
 */
export function isNode(): boolean {
  return (
    typeof process !== "undefined" &&
    process.versions != null &&
    process.versions.node != null
  );
}

/**
 * Safely retrieves an environment variable (Node only).
 */
export function getEnvVar(name: string): string | undefined {
  return isNode() ? process.env[name] : undefined;
}

/**
 * Generates a random UUID (version 4).
 * Uses `crypto.randomUUID()` if available, otherwise falls back to manual generation.
 *
 * @returns {string} A randomly generated UUID string.
 */
export function uuid(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  // Manual fallback for environments without crypto.randomUUID
  const hex = (n: number): string =>
    crypto
      .getRandomValues(new Uint8Array(n))
      .reduce((acc, byte) => acc + byte.toString(16).padStart(2, "0"), "");

  const segment = (length: number): string => hex(length / 2);

  return [
    segment(8),
    segment(4),
    "4" + segment(3).slice(1), // UUID version 4
    ((8 + Math.random() * 4) | 0).toString(16) + segment(3).slice(1), // UUID variant
    segment(12),
  ].join("-");
}
