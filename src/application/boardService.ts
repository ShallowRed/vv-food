import {
  type BoardState,
  type Ingredient,
  type IngredientInput,
  type MealInput,
  normalizeParticipantsInput,
  normalizeProvenancesInput,
  normalizeIngredientInput,
  normalizeMealInput,
} from '../domain/board';

export interface BoardRepository {
  loadState(): Promise<BoardState>;
  createMeal(input: MealInput): Promise<BoardState>;
  updateMeal(id: number, input: MealInput): Promise<BoardState>;
  deleteMeal(id: number): Promise<BoardState>;
  createIngredient(mealId: number, input: IngredientInput): Promise<BoardState>;
  updateIngredient(id: number, input: IngredientInput): Promise<BoardState>;
  deleteIngredient(id: number): Promise<BoardState>;
  saveParticipants(participants: string[]): Promise<BoardState>;
  saveProvenances(provenances: string[]): Promise<BoardState>;
}

export function createBoardService(repository: BoardRepository) {
  return {
    loadState() {
      return repository.loadState();
    },
    saveMeal(id: number | null, input: MealInput) {
      const meal = normalizeMealInput(input);
      return id === null ? repository.createMeal(meal) : repository.updateMeal(id, meal);
    },
    deleteMeal(id: number) {
      return repository.deleteMeal(id);
    },
    saveIngredient(id: number | null, mealId: number, input: IngredientInput) {
      const ingredient = normalizeIngredientInput({ ...input, mealId });
      return id === null
        ? repository.createIngredient(mealId, ingredient)
        : repository.updateIngredient(id, ingredient);
    },
    toggleIngredient(ingredient: Ingredient) {
      return repository.updateIngredient(
        ingredient.id,
        normalizeIngredientInput({ ...ingredient, done: !ingredient.done }),
      );
    },
    deleteIngredient(id: number) {
      return repository.deleteIngredient(id);
    },
    saveParticipants(participants: string[]) {
      return repository.saveParticipants(normalizeParticipantsInput(participants));
    },
    saveProvenances(provenances: string[]) {
      return repository.saveProvenances(normalizeProvenancesInput(provenances));
    },
  };
}
