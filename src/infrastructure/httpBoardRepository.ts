import {
  type BoardState,
  type GroceryItemInput,
  type MealInput,
} from '../domain/board';

async function requestJson<T>(path: string, init?: RequestInit, baseUrl = '/api'): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Requête échouée (${response.status})`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function createHttpBoardRepository(baseUrl = '/api') {
  return {
    loadState() {
      return requestJson<BoardState>('/state', undefined, baseUrl);
    },
    async createMeal(input: MealInput) {
      await requestJson('/meals', {
        method: 'POST',
        body: JSON.stringify(input),
      }, baseUrl);
      return requestJson<BoardState>('/state', undefined, baseUrl);
    },
    async updateMeal(id: number, input: MealInput) {
      await requestJson(`/meals/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }, baseUrl);
      return requestJson<BoardState>('/state', undefined, baseUrl);
    },
    async deleteMeal(id: number) {
      await requestJson(`/meals/${id}`, { method: 'DELETE' }, baseUrl);
      return requestJson<BoardState>('/state', undefined, baseUrl);
    },
    async createItem(input: GroceryItemInput) {
      await requestJson('/items', {
        method: 'POST',
        body: JSON.stringify(input),
      }, baseUrl);
      return requestJson<BoardState>('/state', undefined, baseUrl);
    },
    async updateItem(id: number, input: GroceryItemInput) {
      await requestJson(`/items/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }, baseUrl);
      return requestJson<BoardState>('/state', undefined, baseUrl);
    },
    async deleteItem(id: number) {
      await requestJson(`/items/${id}`, { method: 'DELETE' }, baseUrl);
      return requestJson<BoardState>('/state', undefined, baseUrl);
    },
    async saveParticipants(participants: string[]) {
      await requestJson('/participants', {
        method: 'PUT',
        body: JSON.stringify(participants),
      }, baseUrl);
      return requestJson<BoardState>('/state', undefined, baseUrl);
    },
  };
}
