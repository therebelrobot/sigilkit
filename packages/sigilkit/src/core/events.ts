export type Listener<T> = (value: T) => void;

/** Minimal typed event emitter. */
export class Emitter<Events extends Record<string, unknown>> {
  #listeners = new Map<keyof Events, Set<Listener<never>>>();

  on<K extends keyof Events>(event: K, fn: Listener<Events[K]>): () => void {
    let set = this.#listeners.get(event);
    if (!set) this.#listeners.set(event, (set = new Set()));
    set.add(fn as Listener<never>);
    return () => set.delete(fn as Listener<never>);
  }

  emit<K extends keyof Events>(event: K, value: Events[K]): void {
    for (const fn of this.#listeners.get(event) ?? []) (fn as Listener<Events[K]>)(value);
  }
}

/**
 * Snapshot store compatible with React's useSyncExternalStore.
 * set() replaces the snapshot so identity changes only when state does.
 */
export class Store<T extends object> {
  #state: T;
  #subs = new Set<() => void>();

  constructor(initial: T) {
    this.#state = initial;
  }

  get = (): T => this.#state;

  set(patch: Partial<T>): void {
    let changed = false;
    for (const key in patch) {
      if (!Object.is(patch[key], this.#state[key])) changed = true;
    }
    if (!changed) return;
    this.#state = { ...this.#state, ...patch };
    for (const fn of this.#subs) fn();
  }

  subscribe = (fn: () => void): (() => void) => {
    this.#subs.add(fn);
    return () => this.#subs.delete(fn);
  };
}
