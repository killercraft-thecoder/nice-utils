type NestedArray<T> = T | NestedArray<T>[];

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

class AnyDimensionArray<T> {
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
