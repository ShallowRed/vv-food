import {
  type BoardState,
  type IngredientInput,
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
  const state = () => requestJson<BoardState>('/state', undefined, baseUrl);

  return {
    loadState() {
      return state();
    },
    async createMeal(input: MealInput) {
      await requestJson('/meals', {
        method: 'POST',
        body: JSON.stringify(input),
      }, baseUrl);
      return state();
    },
    async updateMeal(id: number, input: MealInput) {
      await requestJson(`/meals/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }, baseUrl);
      return state();
    },
    async deleteMeal(id: number) {
      await requestJson(`/meals/${id}`, { method: 'DELETE' }, baseUrl);
      return state();
    },
    async createIngredient(mealId: number, input: IngredientInput) {
      await requestJson(`/meals/${mealId}/ingredients`, {
        method: 'POST',
        body: JSON.stringify(input),
      }, baseUrl);
      return state();
    },
    async updateIngredient(id: number, input: IngredientInput) {
      await requestJson(`/ingredients/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }, baseUrl);
      return state();
    },
    async deleteIngredient(id: number) {
      await requestJson(`/ingredients/${id}`, { method: 'DELETE' }, baseUrl);
      return state();
    },
    async saveParticipants(participants: string[]) {
      await requestJson('/participants', {
        method: 'PUT',
        body: JSON.stringify(participants),
      }, baseUrl);
      return state();
    },
    async saveProvenances(provenances: string[]) {
      await requestJson('/provenances', {
        method: 'PUT',
        body: JSON.stringify(provenances),
      }, baseUrl);
      return state();
    },
  };
}
