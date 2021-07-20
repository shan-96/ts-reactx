import { createInput, createComputed, createCallback } from './react'

describe('React module', () => {
  it('input cells have a value', () => {
    const initialValue = 10
    const [input, _setInput] = createInput(initialValue)
    expect(input()).toEqual(initialValue)
  })

  it("an input cell's value can be set", () => {
    const newValue = 20
    const [input, setInput] = createInput(4)
    setInput(newValue)
    expect(input()).toEqual(newValue)
  })

  it('compute cells calculate initial value', () => {
    const [input] = createInput(1)
    const output = createComputed(() => input() + 1)
    expect(output()).toEqual(2)
  })

  it('compute cell takes inputs in correct order', () => {
    const [[one], [two]] = [createInput(1), createInput(2)]
    const output = createComputed(() => one() + two() * 10)
    expect(output()).toEqual(21)
  })

  it('compute cells update value when inputs are changed', () => {
    const [input, setInput] = createInput(1)
    const output = createComputed(() => input() + 1)
    setInput(3)
    expect(output()).toEqual(4)
  })

  it('compute cells can depend on other compute cells', () => {
    const [input, setInput] = createInput(1)
    const timesTwo = createComputed(() => input() * 2)
    const timesThirty = createComputed(() => input() * 30)
    const sum = createComputed(() => timesTwo() + timesThirty())
    expect(sum()).toEqual(32)
    setInput(3)
    expect(sum()).toEqual(96)
  })

  it('compute cells fire callbacks', () => {
    const [input, setInput] = createInput(1)
    const output = createComputed(() => input() + 1)
    let value = 0
    createCallback(() => (value = output()))
    setInput(3)
    expect(value).toEqual(4)
  })

  it('callbacks fire only when output values change', () => {
    const [input, setInput] = createInput(1)
    const output = createComputed(
      () => (input() < 3 ? 111 : 222),
      undefined,
      true
    )
    let value: number | undefined
    createCallback(() => (value = output()))
    value = undefined
    setInput(2)
    expect(value).toBeUndefined()
    setInput(4)
    expect(value).toEqual(222)
  })

  it('callbacks do not report already reported values', () => {
    const [input, setInput] = createInput(1)
    const output = createComputed(() => input() + 1)

    let value: number | undefined
    createCallback(() => (value = output()))

    setInput(2)
    expect(value).toEqual(3)

    setInput(3)
    expect(value).toEqual(4)
  })

  it('callbacks can fire from multiple cells', () => {
    const [input, setInput] = createInput(1)
    const plus_one = createComputed(() => input() + 1)
    const minus_one = createComputed(() => input() - 1)

    let value1 = 0
    createCallback(() => (value1 = plus_one()))
    let value2 = 0
    createCallback(() => (value2 = minus_one()))

    setInput(10)
    expect(value1).toEqual(11)
    expect(value2).toEqual(9)
  })

  it('static callbacks fire even if their own value has not changed', () => {
    const [input, setInput] = createInput(1)
    const output = createComputed(
      () => (input() < 3 ? 111 : 222),
      undefined,
      true
    )
    const values: string[] = []
    createCallback(() => {
      const _dontCare = output()
      values.push('cell changed')
    })
    values.pop()
    setInput(2)
    expect(values).toEqual([])
    setInput(4)
    setInput(2)
    setInput(4)
    expect(values).toEqual(['cell changed', 'cell changed', 'cell changed'])
  })

  it('callbacks can be added and removed', () => {
    const [input, setInput] = createInput(11)
    const output = createComputed(() => input() + 1)

    const values1: number[] = []
    const unsubscribe1 = createCallback(() => values1.push(output()))
    values1.pop()
    const values2: number[] = []
    createCallback(() => values2.push(output()))
    values2.pop()

    setInput(31)

    unsubscribe1()

    const values3: number[] = []
    createCallback(() => values3.push(output()))
    values3.pop()

    setInput(41)

    expect(values1).toEqual([32])
    expect(values2).toEqual([32, 42])
    expect(values3).toEqual([42])
  })

  it("removing a callback multiple times doesn't interfere with other callbacks", () => {
    const [input, setInput] = createInput(1)
    const output = createComputed(() => input() + 1)

    const values1: number[] = []
    const unsubscribe1 = createCallback(() => values1.push(output()))
    values1.pop()
    const values2: number[] = []
    createCallback(() => values2.push(output()))
    values2.pop()

    unsubscribe1()
    unsubscribe1()
    unsubscribe1()

    setInput(2)

    expect(values1).toEqual([])
    expect(values2).toEqual([3])
  })

  it('callbacks should only be called once, even if multiple dependencies change', () => {
    const [input, setInput] = createInput(1)
    const plusOne = createComputed(() => input() + 1)
    const minusOne1 = createComputed(() => input() - 1)
    const minusOne2 = createComputed(() => minusOne1() - 1)
    const output = createComputed(() => plusOne() * minusOne2())

    const values: number[] = []
    createCallback(() => values.push(output()))
    values.pop()

    setInput(4)

    expect(values).toEqual([10])
  })

  it("callbacks should not be called if dependencies change but output value doesn't change", () => {
    const [input, setInput] = createInput(1)
    const plusOne = createComputed(() => input() + 1)
    const minusOne = createComputed(() => input() - 1)
    const alwaysTwo = createComputed(
      () => plusOne() - minusOne(),
      undefined,
      true
    )

    const values: number[] = []
    createCallback(() => values.push(alwaysTwo()))
    values.pop()

    setInput(2)
    setInput(3)
    setInput(4)
    setInput(5)

    expect(values).toEqual([])
  })
})
