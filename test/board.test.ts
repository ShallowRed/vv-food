import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  compareMealsByMoment,
  createEmptyBoardState,
  groupIngredientsByProvenance,
  mealSlots,
  normalizeIngredientInput,
  normalizeMealInput,
  normalizeParticipantsInput,
  normalizeProvenancesInput,
  stayDay,
  type Ingredient,
  type Meal,
} from '../src/domain/board.ts';

function meal(partial: Partial<Meal> & { id: number }): Meal {
  return {
    id: partial.id,
    day: partial.day ?? 'Samedi',
    slot: partial.slot ?? 'Déj',
    title: partial.title ?? `Repas ${partial.id}`,
    note: partial.note ?? '',
    owner: partial.owner ?? 'Groupe',
    ingredients: partial.ingredients ?? [],
  };
}

function ing(partial: Partial<Ingredient> & { id: number }): Ingredient {
  return {
    id: partial.id,
    mealId: partial.mealId ?? 1,
    label: partial.label ?? `Ingrédient ${partial.id}`,
    quantity: partial.quantity ?? '1',
    provenance: partial.provenance ?? 'Grande surface',
    done: partial.done ?? false,
  };
}

test('mealSlots inclut les nouveaux créneaux Goûter et Apéro', () => {
  assert.deepEqual(mealSlots, ['Petit-déj', 'Déj', 'Goûter', 'Apéro', 'Dîner']);
});

test('compareMealsByMoment ordonne les créneaux chronologiquement', () => {
  const unordered = [
    meal({ id: 1, slot: 'Dîner' }),
    meal({ id: 2, slot: 'Petit-déj' }),
    meal({ id: 3, slot: 'Apéro' }),
    meal({ id: 4, slot: 'Déj' }),
    meal({ id: 5, slot: 'Goûter' }),
  ];
  const ordered = unordered.slice().sort(compareMealsByMoment).map((m) => m.slot);
  assert.deepEqual(ordered, ['Petit-déj', 'Déj', 'Goûter', 'Apéro', 'Dîner']);
});

test('normalizeMealInput trim et applique la note par défaut', () => {
  const out = normalizeMealInput({ day: ' Samedi ', slot: 'Déj', title: '  BBQ ', note: '   ', owner: ' Louis ' });
  assert.equal(out.day, 'Samedi');
  assert.equal(out.title, 'BBQ');
  assert.equal(out.note, 'À préciser');
  assert.equal(out.owner, 'Louis');
});

test('normalizeIngredientInput trim, quantité par défaut, conserve mealId/done', () => {
  const out = normalizeIngredientInput({ mealId: 7, label: ' Pain ', quantity: '  ', provenance: ' Marché ', done: true });
  assert.equal(out.mealId, 7);
  assert.equal(out.label, 'Pain');
  assert.equal(out.quantity, '1');
  assert.equal(out.provenance, 'Marché');
  assert.equal(out.done, true);
});

test('normalizeParticipantsInput / normalizeProvenancesInput dédupent et trim', () => {
  assert.deepEqual(normalizeParticipantsInput([' Marie ', 'Marie', '', 'Louis']), ['Marie', 'Louis']);
  assert.deepEqual(normalizeProvenancesInput(['Marché', 'Marché ', ' ']), ['Marché']);
});

test('groupIngredientsByProvenance regroupe par provenance et garde l\'ordre des provenances connues', () => {
  const meals = [
    meal({ id: 1, title: 'BBQ', ingredients: [ing({ id: 10, provenance: 'Marché sur place', label: 'Tomates' })] }),
    meal({ id: 2, title: 'Apéro', ingredients: [
      ing({ id: 11, provenance: 'Grande surface', label: 'Chips' }),
      ing({ id: 12, provenance: 'Marché sur place', label: 'Olives' }),
    ] }),
  ];
  const groups = groupIngredientsByProvenance(meals, ['Grande surface', 'Marché sur place', 'Ramené de Paris']);

  // "Ramené de Paris" n'a aucun ingrédient -> exclu
  assert.deepEqual(groups.map((g) => g.provenance), ['Grande surface', 'Marché sur place']);
  assert.deepEqual(groups[0].ingredients.map((i) => i.label), ['Chips']);
  assert.deepEqual(groups[1].ingredients.map((i) => i.label), ['Tomates', 'Olives']);
  // chaque ingrédient agrégé porte le titre de son repas
  assert.equal(groups[1].ingredients[0].mealTitle, 'BBQ');
  assert.equal(groups[1].ingredients[1].mealTitle, 'Apéro');
});

test('groupIngredientsByProvenance gère une provenance inconnue (non listée)', () => {
  const meals = [meal({ id: 1, ingredients: [ing({ id: 1, provenance: 'Cave perso' })] })];
  const groups = groupIngredientsByProvenance(meals, ['Grande surface']);
  assert.deepEqual(groups.map((g) => g.provenance), ['Cave perso']);
});

test('groupIngredientsByProvenance retombe sur "Sans provenance" si vide', () => {
  const meals = [meal({ id: 1, ingredients: [ing({ id: 1, provenance: '' })] })];
  const groups = groupIngredientsByProvenance(meals, []);
  assert.deepEqual(groups.map((g) => g.provenance), ['Sans provenance']);
});

test('createEmptyBoardState fournit des provenances et participants par défaut', () => {
  const state = createEmptyBoardState();
  assert.ok(state.provenances.length > 0);
  assert.ok(state.participants.length > 0);
  assert.deepEqual(state.meals, []);
});

test('stayDay est la valeur attendue', () => {
  assert.equal(stayDay, 'Séjour');
});
