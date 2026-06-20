export type MealSlot = 'Petit-déj' | 'Déj' | 'Goûter' | 'Apéro' | 'Dîner';

/** Jour spécial pour les repas valables sur l'ensemble du séjour (ex: petit-déj). */
export const stayDay = 'Séjour';

export type Ingredient = {
  id: number;
  mealId: number;
  label: string;
  quantity: string;
  provenance: string;
  done: boolean;
};

export type Meal = {
  id: number;
  day: string;
  slot: MealSlot;
  title: string;
  note: string;
  owner: string;
  ingredients: Ingredient[];
};

export type BoardState = {
  meals: Meal[];
  provenances: string[];
  participants: string[];
};

export type MealInput = Omit<Meal, 'id' | 'ingredients'>;
export type IngredientInput = Omit<Ingredient, 'id'>;

export type MealDraftState = {
  day: string;
  slot: MealSlot;
  title: string;
  note: string;
  owner: string;
};

export type IngredientDraftState = {
  label: string;
  quantity: string;
  provenance: string;
};

export const defaultParticipants = ['Marie', 'Louis', 'Agathe', 'Joffrey', 'Margaux'];
export const contributors = [...defaultParticipants];
export const mealDays = ['Vendredi', 'Samedi', 'Dimanche'];
/** Jours sélectionnables dans l'éditeur, incluant le séjour entier. */
export const mealDayOptions = [stayDay, ...mealDays];
export const mealSlots: MealSlot[] = ['Petit-déj', 'Déj', 'Goûter', 'Apéro', 'Dîner'];
export const defaultProvenances = ['Grande surface', 'Marché sur place', 'Ramené de Paris'];
export const fallbackMealNote = 'À préciser';

/** Ordre d'affichage des créneaux dans une journée. */
const slotOrder: Record<string, number> = {
  'Petit-déj': 0,
  Déj: 1,
  Goûter: 2,
  Apéro: 3,
  Dîner: 4,
};

export function compareMealsByMoment(a: Meal, b: Meal): number {
  return (slotOrder[a.slot] ?? 99) - (slotOrder[b.slot] ?? 99);
}

export function normalizeParticipantsInput(participants: string[]): string[] {
  return dedupeTrimmed(participants);
}

export function normalizeProvenancesInput(provenances: string[]): string[] {
  return dedupeTrimmed(provenances);
}

function dedupeTrimmed(values: string[]): string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();

  values.forEach((value) => {
    const name = value.trim();
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

export function createEmptyIngredientDraft(provenances: string[] = defaultProvenances): IngredientDraftState {
  return {
    label: '',
    quantity: '',
    provenance: provenances[0] ?? defaultProvenances[0],
  };
}

export function createEmptyBoardState(): BoardState {
  return {
    meals: [],
    provenances: defaultProvenances.slice(),
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

export function normalizeIngredientInput(input: IngredientInput): IngredientInput {
  return {
    mealId: input.mealId,
    label: input.label.trim(),
    quantity: input.quantity.trim() || '1',
    provenance: input.provenance.trim(),
    done: input.done,
  };
}

/** Regroupe tous les ingrédients de tous les repas par provenance (vue courses). */
export type ProvenanceGroup = {
  provenance: string;
  ingredients: Array<Ingredient & { mealTitle: string }>;
};

export function groupIngredientsByProvenance(meals: Meal[], provenances: string[]): ProvenanceGroup[] {
  const groups = new Map<string, ProvenanceGroup>();

  // Ordre stable : on amorce avec les provenances connues.
  provenances.forEach((provenance) => {
    groups.set(provenance, { provenance, ingredients: [] });
  });

  meals.forEach((meal) => {
    meal.ingredients.forEach((ingredient) => {
      const key = ingredient.provenance || 'Sans provenance';
      if (!groups.has(key)) {
        groups.set(key, { provenance: key, ingredients: [] });
      }
      groups.get(key)!.ingredients.push({ ...ingredient, mealTitle: meal.title });
    });
  });

  return [...groups.values()].filter((group) => group.ingredients.length > 0);
}
