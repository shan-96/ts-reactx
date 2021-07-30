# ts-reactx

A basic reactive system in TypeScript.

Reactive programming is a programming paradigm that focuses on how values are computed in terms of each other to allow a change to one value to automatically propagate to other values, like in a spreadsheet.

This system implements a basic reactive system with cells with settable values ("input" cells) and cells with values computed in terms of other cells ("compute" cells). It has a provision for "updates" so that when an input value is changed, values propagate to reach a new stable system state.

In addition, compute cells allow for registering change notification callbacks. A cell’s callbacks is called when the cell’s value in a new stable state has changed from the previous stable state.

## References

- [How it Works](https://indepth.dev/posts/1269/finding-fine-grained-reactive-programming#how-it-works)
- [A blog on fine grained reactive programming](https://levelup.gitconnected.com/finding-fine-grained-reactive-programming-89741994ddee)
- [Computations](https://github.com/ryansolid/solid/blob/master/documentation/reactivity.md#user-content-computations)

## Disclaimer
- I got this idea by solving one of puzzles on https://exercism.io/my/tracks/typescript

## Usage
```ts
let cell: Cell<number> = new Cell(1); // set a cell with value 1
const output = cell.getComputedCellFn(() => cell.readFn() + 1); // add a compute function
let result = output(); // result = 2
```
More examples in [tests](https://github.com/shan-96/ts-reactx/blob/main/react.test.ts)
