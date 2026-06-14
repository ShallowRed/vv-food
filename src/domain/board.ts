export type MealSlot = 'Petit-déj' | 'Déj' | 'Dîner';

export type Meal = {
  id: number;
  day: string;
  slot: MealSlot;
  title: string;
  note: string;
  owner: string;
};

export type GroceryItem = {
  id: number;
  label: string;
  quantity: string;
  assignedTo: string;
  done: boolean;
};

export type BoardState = {
  meals: Meal[];
  items: GroceryItem[];
  participants: string[];
};

export type MealInput = Omit<Meal, 'id'>;
export type GroceryItemInput = Omit<GroceryItem, 'id'>;

export type MealDraftState = {
  day: string;
  slot: MealSlot;
  title: string;
  note: string;
  owner: string;
};

export type GroceryDraftState = {
  label: string;
  quantity: string;
  assignedTo: string;
};

export const defaultParticipants = ['Marie', 'Louis', 'Agathe', 'Joffrey', 'Margaux'];
export const contributors = [...defaultParticipants];
export const mealDays = ['Vendredi', 'Samedi', 'Dimanche'];
export const mealSlots: MealSlot[] = ['Petit-déj', 'Déj', 'Dîner'];
export const fallbackMealNote = 'À préciser';

export function normalizeParticipantsInput(participants: string[]): string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();

  participants.forEach((participant) => {
    const name = participant.trim();
    if (!name || seen.has(name)) {
      return;
    }

    seen.add(name);
    normalized.push(name);
  });

  return normalized;
}

export function createEmptyMealDraft(participants: string[] = defaultParticipants): MealDraftState {
  return {
    day: mealDays[0],
    slot: mealSlots[0],
    title: '',
    note: '',
    owner: participants[0] ?? 'Personne',
  };
}

export function createEmptyGroceryDraft(): GroceryDraftState {
  return {
    label: '',
    quantity: '',
    assignedTo: contributors[0],
  };
}

export function createEmptyBoardState(): BoardState {
  return {
    meals: [],
    items: [],
    participants: defaultParticipants.slice(),
  };
}

export function normalizeMealInput(input: MealInput): MealInput {
  return {
    day: input.day.trim(),
    slot: input.slot,
    title: input.title.trim(),
    note: input.note.trim() || fallbackMealNote,
    owner: input.owner.trim(),
  };
}

export function normalizeGroceryInput(input: GroceryItemInput): GroceryItemInput {
  return {
    label: input.label.trim(),
    quantity: input.quantity.trim() || '1',
    assignedTo: input.assignedTo.trim(),
    done: input.done,
  };
}
