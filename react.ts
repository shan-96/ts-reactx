type ReadFn<T> = () => T;
type WriteFn<T> = (value: T) => void;
type CallbackFn = () => void;
type UpdateFn<T> = () => T;
type EqualFn<T> = (lhs: T, rhs: T) => boolean;
type UnsubscribeFn = () => void;

type InputPair<T> = [ReadFn<T>, WriteFn<T>];

type RefreshFn = () => boolean;
type InternalRefreshFn = () => void;

type Source<T> = {
  value: T | undefined;
  sinks: Set<Sink>;
};

type Sink = {
  sources: Set<Source<unknown>>;
  refresh: RefreshFn;
  isStale: boolean;
};

type Derived<T> = Source<T> & Sink;

const awaitRefresh: Set<RefreshFn> = new Set();
let refreshing: RefreshFn[] | undefined;
let activeSink: Sink | undefined;

function isSink(object: unknown): object is Sink {
  return typeof object === 'object' && (object as Sink).sources !== undefined;
}

const defaultEqual = <T>(lhs: T, rhs: T): boolean => lhs === rhs;
const neverEqual = <T>(_lhs: T, _rhs: T): boolean => false;
const refreshStub: RefreshFn = () => false;

function queueAsStale(sink: Sink): void {
  if (sink.isStale) return;
  sink.isStale = true;
  awaitRefresh.add(sink.refresh);
}

function markSubsStale(sinks: Set<Sink>): void {
  const subscriptions = Array.from(sinks);
  for (let i = 0; i < subscriptions.length; i++)
    queueAsStale(subscriptions[i]);
}

function isStale(sink: Source<unknown>): boolean {
  if (!isSink(sink)) return false;
  return sink.isStale;
}

const hasStaleSources: (s: Set<Source<unknown>>) => boolean = (sources) =>
  Array.from(sources).some(isStale);

function runRefresh(): void {
  if (refreshing) return;

  while (awaitRefresh.size > 0) {
    refreshing = Array.from(awaitRefresh);
    awaitRefresh.clear();

    for (let i = 0; i < refreshing.length; i++) {
      const refresh = refreshing[i];
      if (!refresh()) awaitRefresh.add(refresh);
    }

    refreshing = undefined;
  }
}

function subscribe(sink: Sink, source: Source<unknown>): void {
  source.sinks.add(sink);
  sink.sources.add(source);
}

function unsubscribe(sink: Sink): void {
  for (const source of sink.sources.values()) source.sinks.delete(sink);
  sink.sources.clear();
}

function makeReadFn<T>(source: Source<T>): ReadFn<T> {
  return (): T => {
    if (activeSink) subscribe(activeSink, source);
    return source.value!;
  };
}

function makeRefreshFn(sink: Sink, fn: InternalRefreshFn): RefreshFn {
  return (): boolean => {
    if (hasStaleSources(sink.sources)) return false;

    unsubscribe(sink);
    activeSink = sink;
    fn();
    activeSink = undefined;
    return true;
  };
}

/**
 * Creates an input closure. The value is accessed
 * via the accessor and changed via the
 * mutator returned as part an `InputPair<T>`.
 *
 * @typeParam T   - Type of the closure's value.
 *                By extension the type of the return
 *                value of the accessor and the type
 *                of the mutator's single argument.
 *
 * @param value   - Input closure's initial value.
 *                be useful during debugging.
 * @returns       - An `InputPair<T>`. The 1st
 *                element is the accessor (getter
 *                function), the 2nd element is
 *                the mutator (setter function).
 */
function createInput<T>(value: T): InputPair<T> {
  const source: Source<T> = {
    value,
    sinks: new Set(),
  };

  const write: WriteFn<T> = (nextValue) => {
    source.value = nextValue;
    markSubsStale(source.sinks);
    runRefresh();
  };

  return [makeReadFn(source), write];
}

/**
 * Creates a callback closure with the supplied
 * function which is expected to perform side effects.
 *
 * @privateRemarks
 * `observer` isn't mean't to be an empty object literal.
 * Replace it with something more appropriate to its
 * purpose.
 *
 * @typeParam T    - Type of the closure's value.
 *                 By extension the type of the value
 *                 returned by the callback function
 *                 and of the value accepted by the
 *                 function.
 * @param updateFn - Callback function. This function
 *                 references one or more accessors of
 *                 subjects. It may perform side effects.
 *                 It will also be passed the
 *                 value that it returned the last time it
 *                 was invoked.
 * @returns        - The `unsubscribe` function. Once
 *                 invoked the callback closure will
 *                 stop receiving updates from the
 *                 subjects it subscribed to.
 */
function createCallback(fn: CallbackFn): UnsubscribeFn {
  const sink: Sink = {
    sources: new Set(),
    refresh: refreshStub,
    isStale: false,
  };

  const refresh: InternalRefreshFn = () => {
    fn();
    sink.isStale = false;
  };
  sink.refresh = makeRefreshFn(sink, refresh);

  queueAsStale(sink);
  runRefresh();

  return unsubscribe.bind(null, sink);
}

/**
 * Creates a computed (derived) closure with the
 * supplied function which computes the current value
 * of the closure.
 *
 * @privateRemarks
 * `Observer<T>` may be good enough to get through
 * the enabled test case but more is needed to
 * get further ...
 *
 * @typeParam T   - Type of the closure's value.
 *                By extension the type of the value
 *                returned by the update function and
 *                of the value
 *                accepted by the function.
 *
 * @param updateFn - Update function. This function
 *                 references one or more accessors of
 *                 other subjects. It **should not**
 *                 perform side effects. It is expected
 *                 to return a value which will be the
 *                 value of the closure until the next
 *                 update. The closure's value is
 *                 supplied to this update function
 *                 on the next update.
 * @param value    - Initial value that is passed to
 *                 `updateFn` when it executes for the
 *                 first time.
 * @param equal    - By default the current and previous
 *                 values are not compared so updates
 *                 will be triggered even if the value
 *                 doesn't _change_. When `true` is
 *                 specified the
 *                 {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Strict_equality | strict equality operator}
 *                 is used to compare values and updates
 *                 with identical values **are**
 *                 suppressed. When `T` is a structural
 *                 type it is necessary to provide a
 *                 `(a: T, b: T) => boolean` comparison
 *                 predicate instead.
 * @param options  - Holder object for relevant options.
 *                 Assigning a `name` to a subject can
 *                 be useful during debugging.
 * @returns        - The accessor to the closure's
 *                 value (getter function). Retrieves
 *                 the closure's current value. Used by
 *                 observers (or more accurately their
 *                 update function) to obtain the
 *                 value (and to subscribe for
 *                 updates).
 */
function createComputed<T>(
  fn: UpdateFn<T>,
  _value?: T,
  equal?: boolean | EqualFn<T>
): ReadFn<T> {
  const equalFn =
    typeof equal === 'function'
      ? equal
      : equal === true
        ? defaultEqual
        : neverEqual;

  const derived: Derived<T> = {
    value: undefined,
    sinks: new Set(),
    sources: new Set(),
    refresh: refreshStub,
    isStale: false,
  };

  const refresh: InternalRefreshFn = () => {
    const nextValue = fn();
    derived.isStale = false;
    if (derived.value !== undefined && equalFn(derived.value, nextValue))
      return;

    derived.value = nextValue;
    markSubsStale(derived.sinks);
  };
  derived.refresh = makeRefreshFn(derived, refresh);

  queueAsStale(derived);
  runRefresh();

  return makeReadFn(derived);
}

export default class Cell<T> {

  /**
   * [Private Member] initial cell value to create the cell object.
   */
  private initialValue: T;

  /**
   * [Member] accessor (getter function) for the cell's value.
   */
  readonly readFn: ReadFn<T>;

  /**
   * [Member] mutator (setter function) for the cell's value.
   */
  readonly writeFn: WriteFn<T>;

  /**
   * Contructor to create a `Cell` instance with desired initial value.
   * The value is accessed via the accessor and changed via the
   * mutator returned as part an `InputPair<T>`.
   *
   * @typeParam T   - Type of the closure's value.
   *                By extension the type of the return
   *                value of the accessor and the type
   *                of the mutator's single argument.
   *
   * @param value   - Input closure's initial value.
   * @returns       - An `InputPair<T>`. The 1st
   *                element is the accessor (getter
   *                function), the 2nd element is
   *                the mutator (setter function).
   */
  constructor(value: T) {
    this.initialValue = value;
    [this.readFn, this.writeFn] = createInput(value);
  }

  /**
   * [Method] Creates a computed (derived) closure with the
   * supplied function which computes the current value
   * of the closure.
   *
   * @privateRemarks
   * `Observer<T>` may be good enough to get through
   * the enabled test case but more is needed to
   * get further ...
   *
   * @typeParam T   - Type of the closure's value.
   *                By extension the type of the value
   *                returned by the update function and
   *                of the value
   *                accepted by the function.
   *
   * @param updateFn - Update function. This function
   *                 references one or more accessors of
   *                 other subjects. It **should not**
   *                 perform side effects. It is expected
   *                 to return a value which will be the
   *                 value of the closure until the next
   *                 update. The closure's value is
   *                 supplied to this update function
   *                 on the next update.
   * @param value    - Initial value that is passed to
   *                 `updateFn` when it executes for the
   *                 first time.
   * @param equal    - By default the current and previous
   *                 values are not compared so updates
   *                 will be triggered even if the value
   *                 doesn't _change_. When `true` is
   *                 specified the
   *                 {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Strict_equality | strict equality operator}
   *                 is used to compare values and updates
   *                 with identical values **are**
   *                 suppressed. When `T` is a structural
   *                 type it is necessary to provide a
   *                 `(a: T, b: T) => boolean` comparison
   *                 predicate instead.
   * @returns        - The accessor to the closure's
   *                 value (getter function). Retrieves
   *                 the closure's current value. Used by
   *                 observers (or more accurately their
   *                 update function) to obtain the
   *                 value (and to subscribe for
   *                 updates).
   */
  getComputedCellFn<T>(
    fn: UpdateFn<T>,
    _value?: T,
    equal?: boolean | EqualFn<T>
  ): ReadFn<T> {
    return createComputed(fn, _value, equal);
  }

  /**
   * [Method] Creates a callback closure with the supplied
   * function which is expected to perform side effects.
   *
   * @privateRemarks
   * `observer` isn't mean't to be an empty object literal.
   * Replace it with something more appropriate to its
   * purpose.
   *
   * @typeParam T    - Type of the closure's value.
   *                 By extension the type of the value
   *                 returned by the callback function
   *                 and of the value accepted by the
   *                 function.
   *
   * @param updateFn - Callback function. This function
   *                 references one or more accessors of
   *                 subjects. It may perform side effects.
   *                 It will also be passed the
   *                 value that it returned the last time it
   *                 was invoked.
   * @returns        - The `unsubscribe` function. Once
   *                 invoked the callback closure will
   *                 stop receiving updates from the
   *                 subjects it subscribed to.
   */
  getCallbackCellFn(fn: CallbackFn): UnsubscribeFn {
    return createCallback(fn);
  }
}
