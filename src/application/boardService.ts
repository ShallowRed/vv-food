import {
  type BoardState,
  type GroceryItem,
  type GroceryItemInput,
  type Meal,
  type MealInput,
  normalizeParticipantsInput,
  normalizeGroceryInput,
  normalizeMealInput,
} from '../domain/board';

export interface BoardRepository {
  loadState(): Promise<BoardState>;
  createMeal(input: MealInput): Promise<BoardState>;
  updateMeal(id: number, input: MealInput): Promise<BoardState>;
  deleteMeal(id: number): Promise<BoardState>;
  createItem(input: GroceryItemInput): Promise<BoardState>;
  updateItem(id: number, input: GroceryItemInput): Promise<BoardState>;
  deleteItem(id: number): Promise<BoardState>;
  saveParticipants(participants: string[]): Promise<BoardState>;
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
    saveItem(id: number | null, input: GroceryItemInput) {
      const item = normalizeGroceryInput(input);
      return id === null ? repository.createItem(item) : repository.updateItem(id, item);
    },
    toggleItem(item: GroceryItem) {
      return repository.updateItem(item.id, normalizeGroceryInput({ ...item, done: !item.done }));
    },
    deleteMeal(id: number) {
      return repository.deleteMeal(id);
    },
    deleteItem(id: number) {
      return repository.deleteItem(id);
    },
    saveParticipants(participants: string[]) {
      return repository.saveParticipants(normalizeParticipantsInput(participants));
    },
    hydrateMeals(meals: Meal[]) {
      return meals;
    },
  };
}
