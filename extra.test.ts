import Cell from './react'

describe('Some more tests', () => {
    it('Observable and Computeds can have different types', () => {
        let x1: Cell<string> = new Cell('Hello');
        let output = x1.getComputedCellFn(() => {
            return x1.readFn().startsWith('H');
        })
        let x2 = output();
        expect(x2).toBe(true);
        x1.writeFn('World');
        x2 = output();
        expect(x2).toBe(false);
    });
});