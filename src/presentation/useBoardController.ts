import { useEffect, useMemo, useState } from 'react';
import {
  createEmptyBoardState,
  createEmptyGroceryDraft,
  createEmptyMealDraft,
  type BoardState,
  type GroceryDraftState,
  type GroceryItem,
  type MealDraftState,
  defaultParticipants,
  mealDays,
  mealSlots,
} from '../domain/board';
import { createBoardService } from '../application/boardService';
import { createHttpBoardRepository } from '../infrastructure/httpBoardRepository';

export function useBoardController() {
  const repository = useMemo(() => createHttpBoardRepository('/api'), []);
  const service = useMemo(() => createBoardService(repository), [repository]);

  const [state, setState] = useState<BoardState>(createEmptyBoardState());
  const [mealDraft, setMealDraft] = useState<MealDraftState>(createEmptyMealDraft(defaultParticipants));
  const [itemDraft, setItemDraft] = useState<GroceryDraftState>(createEmptyGroceryDraft());
  const [participantDraft, setParticipantDraft] = useState('');
  const [activeDay, setActiveDay] = useState('Tous');
  const [editingMealId, setEditingMealId] = useState<number | null>(null);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
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

  const doneCount = useMemo(() => state.items.filter((item) => item.done).length, [state.items]);
  const mealCount = state.meals.length;
  const visibleMeals = useMemo(
    () => (activeDay === 'Tous' ? state.meals : state.meals.filter((meal) => meal.day === activeDay)),
    [activeDay, state.meals],
  );

  const resetMealDraft = () => {
    setMealDraft(createEmptyMealDraft(state.participants));
    setEditingMealId(null);
  };

  const resetItemDraft = () => {
    setItemDraft(createEmptyGroceryDraft());
    setEditingItemId(null);
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

  const submitItemForm = async () => {
    if (!itemDraft.label.trim()) return;

    const nextState = await service.saveItem(editingItemId, {
      ...itemDraft,
      done: editingItemId === null ? false : state.items.find((entry) => entry.id === editingItemId)?.done ?? false,
    });
    setState(nextState);
    resetItemDraft();
  };

  const updateItem = (id: number) => {
    const item = state.items.find((entry) => entry.id === id);
    if (!item) return;

    setEditingItemId(id);
    setItemDraft({
      label: item.label,
      quantity: item.quantity,
      assignedTo: item.assignedTo,
    });
  };

  const toggleItem = async (id: number) => {
    const item = state.items.find((entry) => entry.id === id);
    if (!item) return;

    const nextState = await service.toggleItem(item);
    setState(nextState);
  };

  const removeMeal = async (id: number) => {
    const nextState = await service.deleteMeal(id);
    setState(nextState);

    if (editingMealId === id) {
      resetMealDraft();
    }
  };

  const removeItem = async (id: number) => {
    const nextState = await service.deleteItem(id);
    setState(nextState);

    if (editingItemId === id) {
      resetItemDraft();
    }
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

  return {
    meals: state.meals,
    items: state.items,
    participants: state.participants,
    mealDraft,
    itemDraft,
    participantDraft,
    activeDay,
    setActiveDay,
    editingMealId,
    editingItemId,
    loading,
    syncError,
    doneCount,
    mealCount,
    visibleMeals,
    setMealDraft,
    setItemDraft,
    setParticipantDraft,
    submitMealForm,
    submitItemForm,
    submitParticipantForm,
    updateMeal,
    updateItem,
    toggleItem,
    removeMeal,
    removeItem,
    removeParticipant,
    resetMealDraft,
    resetItemDraft,
    refreshState,
    mealDays,
    mealSlots,
  };
}
