// Utilities for compile-time type checks in tests.
export type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

// Call at usage sites so TS actually evaluates the constraint.
// Usage: expectType<Equal<T, U>>();
export function expectType<T extends true>(value?: T): void {
  void value;
}
