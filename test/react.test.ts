import Cell from '../src/react';

describe('React module', () => {
  it('input cells have a value', () => {
    const initialValue = 10
    let cell: Cell<number> = new Cell(initialValue);
    expect(cell.readFn()).toEqual(initialValue);
  })

  it("an input cell's value can be set", () => {
    const newValue = 20
    let cell: Cell<number> = new Cell(newValue);
    cell.writeFn(newValue);
    expect(cell.readFn()).toEqual(newValue);
  })

  it('compute cells calculate initial value', () => {
    let cell: Cell<number> = new Cell(1);
    const output = cell.getComputedCellFn(() => cell.readFn() + 1);
    expect(output()).toEqual(2);
  })

  it('compute cell takes inputs in correct order', () => {
    const [cell1, cell2] = [new Cell(1), new Cell(2)];
    const output1 = cell1.getComputedCellFn(() => cell1.readFn() + cell2.readFn() * 10);
    expect(output1()).toEqual(21);
    const output2 = cell2.getComputedCellFn(() => cell1.readFn() + cell2.readFn() * 10);
    expect(output2()).toEqual(21);
  })

  it('compute cells update value when inputs are changed', () => {
    const cell: Cell<number> = new Cell(1);
    const output = cell.getComputedCellFn(() => cell.readFn() + 1);
    cell.writeFn(3);
    expect(output()).toEqual(4);
  })

  it('compute cells can depend on other compute cells', () => {
    const cell: Cell<number> = new Cell(1);
    const timesTwo = cell.getComputedCellFn(() => cell.readFn() * 2);
    const timesThirty = cell.getComputedCellFn(() => cell.readFn() * 30);
    const sum = cell.getComputedCellFn(() => timesTwo() + timesThirty());
    expect(sum()).toEqual(32);
    cell.writeFn(3);
    expect(sum()).toEqual(96);
  })

  it('compute cells fire callbacks', () => {
    const cell: Cell<number> = new Cell(1);
    const output = cell.getComputedCellFn(() => cell.readFn() + 1);
    let value = 0;
    cell.getCallbackCellFn(() => (value = output()));
    cell.writeFn(3);
    expect(value).toEqual(4);
  })

  it('callbacks fire only when output values change', () => {
    const cell: Cell<number> = new Cell(1);
    const output = cell.getComputedCellFn(
      () => (cell.readFn() < 3 ? 111 : 222),
      undefined,
      true
    );
    let value: number | undefined;
    cell.getCallbackCellFn(() => (value = output()));
    value = undefined;
    cell.writeFn(2);
    expect(value).toBeUndefined();
    cell.writeFn(4);
    expect(value).toEqual(222);
  })

  it('callbacks do not report already reported values', () => {
    const cell: Cell<number> = new Cell(1);
    const output = cell.getComputedCellFn(() => cell.readFn() + 1);

    let value: number | undefined;
    cell.getCallbackCellFn(() => (value = output()));

    cell.writeFn(2);
    expect(value).toEqual(3);

    cell.writeFn(3);
    expect(value).toEqual(4);
  })

  it('callbacks can fire from multiple cells', () => {
    const cell: Cell<number> = new Cell(1);
    const plus_one = cell.getComputedCellFn(() => cell.readFn() + 1);
    const minus_one = cell.getComputedCellFn(() => cell.readFn() - 1);

    let value1 = 0
    cell.getCallbackCellFn(() => (value1 = plus_one()));
    let value2 = 0;
    cell.getCallbackCellFn(() => (value2 = minus_one()));

    cell.writeFn(10);
    expect(value1).toEqual(11);
    expect(value2).toEqual(9);
  })

  it('static callbacks fire even if their own value has not changed', () => {
    const cell: Cell<number> = new Cell(1);
    const output = cell.getComputedCellFn(
      () => (cell.readFn() < 3 ? 111 : 222),
      undefined,
      true
    );
    const values: string[] = []
    cell.getCallbackCellFn(() => {
      const _dontCare = output()
      expect(_dontCare).toEqual(111)
      values.push('cell changed')
    });
    values.pop();
    cell.writeFn(2);
    expect(values).toEqual([]);
    cell.writeFn(4);
    cell.writeFn(2);
    cell.writeFn(4);
    expect(values).toEqual(['cell changed', 'cell changed', 'cell changed']);
  })

  it('callbacks can be added and removed', () => {
    const cell: Cell<number> = new Cell(1);
    const output = cell.getComputedCellFn(() => cell.readFn() + 1);

    const values1: number[] = [];
    const unsubscribe1 = cell.getCallbackCellFn(() => values1.push(output()));
    values1.pop();
    const values2: number[] = [];
    cell.getCallbackCellFn(() => values2.push(output()));
    values2.pop();

    cell.writeFn(31);

    unsubscribe1();

    const values3: number[] = [];
    cell.getCallbackCellFn(() => values3.push(output()));
    values3.pop();

    cell.writeFn(41);

    expect(values1).toEqual([32]);
    expect(values2).toEqual([32, 42]);
    expect(values3).toEqual([42]);
  })

  it("removing a callback multiple times doesn't interfere with other callbacks", () => {
    const cell: Cell<number> = new Cell(1);
    const output = cell.getComputedCellFn(() => cell.readFn() + 1);

    const values1: number[] = [];
    const unsubscribe1 = cell.getCallbackCellFn(() => values1.push(output()));
    values1.pop();
    const values2: number[] = [];
    cell.getCallbackCellFn(() => values2.push(output()));
    values2.pop();
    unsubscribe1();
    unsubscribe1();
    unsubscribe1();

    cell.writeFn(2);

    expect(values1).toEqual([]);
    expect(values2).toEqual([3]);
  })

  it('callbacks should only be called once, even if multiple dependencies change', () => {
    const cell: Cell<number> = new Cell(1);
    const plusOne = cell.getComputedCellFn(() => cell.readFn() + 1);
    const minusOne1 = cell.getComputedCellFn(() => cell.readFn() - 1);
    const minusOne2 = cell.getComputedCellFn(() => minusOne1() - 1);
    const output = cell.getComputedCellFn(() => plusOne() * minusOne2());

    const values: number[] = [];
    cell.getCallbackCellFn(() => values.push(output()));
    values.pop();

    cell.writeFn(4);

    expect(values).toEqual([10]);
  })

  it("callbacks should not be called if dependencies change but output value doesn't change", () => {
    const cell: Cell<number> = new Cell(1);
    const plusOne = cell.getComputedCellFn(() => cell.readFn() + 1);
    const minusOne = cell.getComputedCellFn(() => cell.readFn() - 1);
    const alwaysTwo = cell.getComputedCellFn(
      () => plusOne() - minusOne(),
      undefined,
      true
    );

    const values: number[] = [];
    cell.getCallbackCellFn(() => values.push(alwaysTwo()));
    values.pop();

    cell.writeFn(2);
    cell.writeFn(3);
    cell.writeFn(4);
    cell.writeFn(5);

    expect(values).toEqual([]);
  })
})
