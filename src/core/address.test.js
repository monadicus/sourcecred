// @flow

import type {Address} from "./address";
import {AddressMap, sortedByAddress} from "./address";

describe("address", () => {
  // Some test data using objects that have addresses, like houses.
  type HouseType = "HOUSETYPE";
  type House = {|
    +address: Address<HouseType>,
    +beds: number,
    +baths: number,
  |};
  function makeAddress(id: string): Address<HouseType> {
    return {
      repositoryName: "sourcecred/suburbia",
      pluginName: "houseville",
      id,
      type: "HOUSETYPE",
    };
  }
  const mansion = (): House => ({
    address: makeAddress("mansion"),
    beds: 10,
    baths: 5,
  });
  const fakeMansion = (): House => ({
    // Same address, different content.
    address: makeAddress("mansion"),
    beds: 33,
    baths: 88,
  });
  const mattressStore = (): House => ({
    address: makeAddress("mattressStore"),
    beds: 99,
    baths: 1,
  });

  describe("AddressMap", () => {
    const makeMap = (): AddressMap<HouseType, House> =>
      new AddressMap().add(mansion()).add(mattressStore());

    it("creates a simple map", () => {
      makeMap();
    });

    it("gets objects by key", () => {
      expect(makeMap().get(mansion().address)).toEqual(mansion());
      expect(makeMap().get(mattressStore().address)).toEqual(mattressStore());
    });

    it("gets all objects, in some order", () => {
      const actual = makeMap().getAll();
      const expected = [mansion(), mattressStore()];
      expect(sortedByAddress(actual)).toEqual(sortedByAddress(expected));
    });

    it("stringifies to JSON", () => {
      expect(makeMap().toJSON()).toMatchSnapshot();
    });

    it("stringifies elements sans addresses", () => {
      const json = makeMap().toJSON();
      Object.keys(json).forEach((k) => {
        const value = json[k];
        expect(Object.keys(value).sort()).toEqual(["baths", "beds"]);
      });
    });

    it("rehydrates elements with addresses", () => {
      const newMap: AddressMap<HouseType, House> = AddressMap.fromJSON(
        makeMap().toJSON()
      );
      newMap.getAll().forEach((house) => {
        expect(Object.keys(house).sort()).toEqual(["address", "baths", "beds"]);
      });
    });

    it("preserves equality over a JSON roundtrip", () => {
      const result = AddressMap.fromJSON(makeMap().toJSON());
      expect(result.equals(makeMap())).toBe(true);
    });

    it("recognizes reference equality", () => {
      const x = makeMap();
      expect(x.equals(x)).toBe(true);
    });

    it("recognizes deep equality", () => {
      expect(makeMap().equals(makeMap())).toBe(true);
    });

    it("recognizes equality invariant of construction order", () => {
      const m1 = new AddressMap().add(mansion()).add(mattressStore());
      const m2 = new AddressMap().add(mattressStore()).add(mansion());
      expect(m1.equals(m2)).toBe(true);
      expect(m2.equals(m1)).toBe(true);
    });

    it("recognizes disequality when element lists differ", () => {
      expect(makeMap().equals(new AddressMap())).toBe(false);
      expect(new AddressMap().equals(makeMap())).toBe(false);
    });

    it("recognizes disequality when contents differ", () => {
      const m1 = new AddressMap().add(mattressStore()).add(mansion());
      const m2 = new AddressMap().add(mattressStore()).add(fakeMansion());
      expect(m1.equals(m2)).toBe(false);
      expect(m2.equals(m1)).toBe(false);
    });

    describe("has nice error messages", () => {
      [null, undefined].forEach((bad) => {
        it(`when getting ${String(bad)} elements`, () => {
          const message = `address is ${String(bad)}`;
          expect(() => makeMap().get((bad: any))).toThrow(message);
        });
        it(`when adding elements with ${String(bad)} address`, () => {
          const message = `address is ${String(bad)}`;
          const element = {
            address: (bad: any),
            beds: 23,
            baths: 45,
          };
          expect(() => makeMap().add(element)).toThrow(message);
        });
      });
    });
  });

  describe("sortedByAddress", () => {
    it("sorts the empty array", () => {
      expect(sortedByAddress([])).toEqual([]);
    });
    it("sorts a sorted array", () => {
      const input = () => [mansion(), mattressStore()];
      const output = () => [mansion(), mattressStore()];
      expect(sortedByAddress(input())).toEqual(output());
    });
    it("sorts a reverse-sorted array", () => {
      const input = () => [mattressStore(), mansion()];
      const output = () => [mansion(), mattressStore()];
      expect(sortedByAddress(input())).toEqual(output());
    });
    it("sorts an array with duplicates", () => {
      const input = () => [mattressStore(), mansion(), mattressStore()];
      const output = () => [mansion(), mattressStore(), mattressStore()];
      expect(sortedByAddress(input())).toEqual(output());
    });
    it("doesn't mutate its input", () => {
      const input = () => [mattressStore(), mansion()];
      const x = input();
      expect(x).toEqual(input());
      expect(sortedByAddress(x)).not.toEqual(input());
      expect(x).toEqual(input());
    });
  });
});
