export interface Limiter {
  limit(key: string): Promise<{ success: boolean }>;
}

export function limiterFromBinding(binding: RateLimit): Limiter {
  return { limit: (key) => binding.limit({ key }) };
}

export const neverLimit: Limiter = {
  limit: async () => ({ success: true }),
};
