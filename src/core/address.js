// @flow

import deepEqual from "lodash.isequal";

export type Address<T: string> = {|
  +repositoryName: string,
  +pluginName: string,
  +type: T,
  +id: string,
|};

export interface Addressable<T: string> {
  +address: Address<T>;
}

export type SansAddress<T: string, U: Addressable<T>> = $Exact<
  $Diff<U, {+address: Address<T>}>
>;

export type AddressMapJSON<T: string, U: Addressable<T>> = {
  [serializedAddress: string]: SansAddress<T, U>,
};

/**
 * A data structure for storing addressable objects, keyed by their
 * addresses.
 */
export class AddressMap<T: string, U: Addressable<T>> {
  // TODO(@wchargin): Evaluate performance gains from using a triple-map
  // here. Cf. https://jsperf.com/address-string-302039074.
  _data: {[serializedAddress: string]: U};

  /**
   * Create an empty `AddressMap`.
   */
  constructor() {
    this._data = {};
  }

  /**
   * Test whether this map logically equals another map. Two maps are
   * logically equal if they contain the same keys and the values at
   * each key are deep-equal.
   */
  equals(that: AddressMap<T, U>): boolean {
    return deepEqual(this._data, that._data);
  }

  toJSON(): AddressMapJSON<T, U> {
    const result = {};
    Object.keys(this._data).forEach((key) => {
      const node = {...this._data[key]};
      delete node.address;
      result[key] = node;
    });
    return result;
  }

  static fromJSON(json: AddressMapJSON<T, U>): AddressMap<T, U> {
    const result: AddressMap<T, U> = new AddressMap();
    Object.keys(json).forEach((key) => {
      result._data[key] = {...json[key], address: JSON.parse(key)};
    });
    return result;
  }

  /**
   * Add the given object to the map, replacing any existing value for
   * the same address.
   *
   * Returns `this` for easy chaining.
   */
  add(u: U): this {
    if (u.address == null) {
      throw new Error(`address is ${String(u.address)}`);
    }
    const key = JSON.stringify(u.address);
    this._data[key] = u;
    return this;
  }

  /**
   * Get the object at the given address, if it exists, or `undefined`
   * otherwise.
   */
  get(address: Address<T>): U {
    if (address == null) {
      throw new Error(`address is ${String(address)}`);
    }
    const key = JSON.stringify(address);
    return this._data[key];
  }

  /**
   * Get all objects stored in the map, in some unspecified order.
   */
  getAll(): U[] {
    return Object.keys(this._data).map((k) => this._data[k]);
  }
}

/**
 * Create a copy of the given array and sort its elements by their
 * addresses. The original array and its elements are not modified.
 */
export function sortedByAddress<T: string, U: Addressable<T>>(xs: U[]) {
  function cmp(x1: U, x2: U): -1 | 0 | 1 {
    // TODO(@wchargin): This can be replaced by three string-comparisons
    // to avoid stringifying.
    const a1 = JSON.stringify(x1.address);
    const a2 = JSON.stringify(x2.address);
    return a1 > a2 ? 1 : a1 < a2 ? -1 : 0;
  }
  return xs.slice().sort(cmp);
}
