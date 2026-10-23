export interface WatchState {
  reposEtag: string | null;
  pushedSince: string | null;
  pullsUpdatedSince: string | null;
  pending: string[];
  lastDispatchAt: string | null;
}

export const EMPTY_STATE: WatchState = {
  reposEtag: null,
  pushedSince: null,
  pullsUpdatedSince: null,
  pending: [],
  lastDispatchAt: null,
};

export interface StateBucket {
  get(key: string): Promise<{ text(): Promise<string> } | null>;
  put(key: string, value: string): Promise<unknown>;
}

export interface StateStore {
  load(): Promise<WatchState>;
  save(state: WatchState): Promise<void>;
}

export const STATE_KEY = "state.json";

export function stateStore(bucket: StateBucket, key: string = STATE_KEY): StateStore {
  return {
    async load() {
      const object = await bucket.get(key);
      if (object === null) return EMPTY_STATE;
      return { ...EMPTY_STATE, ...(JSON.parse(await object.text()) as Partial<WatchState>) };
    },
    async save(state) {
      await bucket.put(key, JSON.stringify(state));
    },
  };
}
