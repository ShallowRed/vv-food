import { useEffect, useMemo, useState } from 'react';
import {
  createEmptyBoardState,
  createEmptyIngredientDraft,
  createEmptyMealDraft,
  groupIngredientsByProvenance,
  compareMealsByMoment,
  type BoardState,
  type Ingredient,
  type IngredientDraftState,
  type MealDraftState,
  defaultParticipants,
  defaultProvenances,
  mealDays,
  mealDayOptions,
  mealSlots,
  stayDay,
} from '../domain/board';
import { createBoardService } from '../application/boardService';
import { createHttpBoardRepository } from '../infrastructure/httpBoardRepository';

export function useBoardController() {
  const repository = useMemo(() => createHttpBoardRepository('/api'), []);
  const service = useMemo(() => createBoardService(repository), [repository]);

  const [state, setState] = useState<BoardState>(createEmptyBoardState());
  const [mealDraft, setMealDraft] = useState<MealDraftState>(createEmptyMealDraft(defaultParticipants));
  const [ingredientDraft, setIngredientDraft] = useState<IngredientDraftState>(
    createEmptyIngredientDraft(defaultProvenances),
  );
  const [participantDraft, setParticipantDraft] = useState('');
  const [provenanceDraft, setProvenanceDraft] = useState('');
  const [activeDay, setActiveDay] = useState('Tous');
  const [editingMealId, setEditingMealId] = useState<number | null>(null);
  const [editingIngredientId, setEditingIngredientId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);

  const refreshState = async () => {
    const nextState = await service.loadState();
    setState(nextState);
  };

  useEffect(() => {
    let cancelled = false;

    const sync = async () => {
      setLoading(true);
      try {
        const nextState = await service.loadState();
        if (!cancelled) {
          setState(nextState);
          setSyncError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setSyncError(error instanceof Error ? error.message : 'Impossible de joindre l’API partagée.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void sync();

    return () => {
      cancelled = true;
    };
  }, [service]);

  const mealCount = state.meals.length;

  // Repas du séjour (ex: petit-déj global), affichés à part de la grille par jour.
  const stayMeals = useMemo(
    () => state.meals.filter((meal) => meal.day === stayDay).slice().sort(compareMealsByMoment),
    [state.meals],
  );

  const dayMeals = useMemo(() => state.meals.filter((meal) => meal.day !== stayDay), [state.meals]);

  const visibleMeals = useMemo(() => {
    const filtered = activeDay === 'Tous' ? dayMeals : dayMeals.filter((meal) => meal.day === activeDay);
    return filtered.slice().sort(compareMealsByMoment);
  }, [activeDay, dayMeals]);

  const provenanceGroups = useMemo(
    () => groupIngredientsByProvenance(state.meals, state.provenances),
    [state.meals, state.provenances],
  );

  // Total d'ingrédients et nombre restant à acheter (toutes provenances).
  const coursesSummary = useMemo(() => {
    let total = 0;
    let done = 0;
    state.meals.forEach((meal) => {
      meal.ingredients.forEach((ingredient) => {
        total += 1;
        if (ingredient.done) done += 1;
      });
    });
    return { total, done, remaining: total - done };
  }, [state.meals]);

  const resetMealDraft = () => {
    setMealDraft(createEmptyMealDraft(state.participants));
    setEditingMealId(null);
  };

  const resetIngredientDraft = () => {
    setIngredientDraft(createEmptyIngredientDraft(state.provenances));
    setEditingIngredientId(null);
  };

  const submitMealForm = async () => {
    if (!mealDraft.title.trim()) return;

    const nextState = await service.saveMeal(editingMealId, mealDraft);
    setState(nextState);
    resetMealDraft();
  };

  const updateMeal = (id: number) => {
    const meal = state.meals.find((entry) => entry.id === id);
    if (!meal) return;

    setEditingMealId(id);
    setMealDraft({
      day: meal.day,
      slot: meal.slot,
      title: meal.title,
      note: meal.note,
      owner: meal.owner,
    });
  };

  const removeMeal = async (id: number) => {
    const nextState = await service.deleteMeal(id);
    setState(nextState);

    if (editingMealId === id) {
      resetMealDraft();
    }
  };

  const submitIngredientForm = async (mealId: number) => {
    if (!ingredientDraft.label.trim()) return;

    const nextState = await service.saveIngredient(editingIngredientId, mealId, {
      ...ingredientDraft,
      mealId,
      done: editingIngredientId === null
        ? false
        : findIngredient(editingIngredientId)?.done ?? false,
    });
    setState(nextState);
    resetIngredientDraft();
  };

  const editIngredient = (ingredient: Ingredient) => {
    setEditingIngredientId(ingredient.id);
    setIngredientDraft({
      label: ingredient.label,
      quantity: ingredient.quantity,
      provenance: ingredient.provenance,
    });
  };

  const toggleIngredient = async (ingredient: Ingredient) => {
    const nextState = await service.toggleIngredient(ingredient);
    setState(nextState);
  };

  const removeIngredient = async (id: number) => {
    const nextState = await service.deleteIngredient(id);
    setState(nextState);

    if (editingIngredientId === id) {
      resetIngredientDraft();
    }
  };

  const findIngredient = (id: number): Ingredient | undefined => {
    for (const meal of state.meals) {
      const found = meal.ingredients.find((entry) => entry.id === id);
      if (found) return found;
    }
    return undefined;
  };

  const submitParticipantForm = async () => {
    const nextParticipant = participantDraft.trim();
    if (!nextParticipant) return;

    const nextState = await service.saveParticipants([...state.participants, nextParticipant]);
    setState(nextState);
    setParticipantDraft('');
  };

  const removeParticipant = async (name: string) => {
    const nextState = await service.saveParticipants(state.participants.filter((participant) => participant !== name));
    setState(nextState);
  };

  const submitProvenanceForm = async () => {
    const nextProvenance = provenanceDraft.trim();
    if (!nextProvenance) return;

    const nextState = await service.saveProvenances([...state.provenances, nextProvenance]);
    setState(nextState);
    setProvenanceDraft('');
  };

  const removeProvenance = async (name: string) => {
    const nextState = await service.saveProvenances(state.provenances.filter((provenance) => provenance !== name));
    setState(nextState);
  };

  return {
    meals: state.meals,
    participants: state.participants,
    provenances: state.provenances,
    mealDraft,
    ingredientDraft,
    participantDraft,
    provenanceDraft,
    activeDay,
    setActiveDay,
    editingMealId,
    editingIngredientId,
    loading,
    syncError,
    mealCount,
    stayMeals,
    visibleMeals,
    provenanceGroups,
    coursesSummary,
    setMealDraft,
    setIngredientDraft,
    setParticipantDraft,
    setProvenanceDraft,
    submitMealForm,
    submitIngredientForm,
    submitParticipantForm,
    submitProvenanceForm,
    updateMeal,
    editIngredient,
    toggleIngredient,
    removeMeal,
    removeIngredient,
    removeParticipant,
    removeProvenance,
    resetMealDraft,
    resetIngredientDraft,
    refreshState,
    mealDays,
    mealDayOptions,
    mealSlots,
    stayDay,
  };
}
