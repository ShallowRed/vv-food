import { useEffect, useState } from 'react';
import { useBoardController } from './useBoardController';
import { ConfirmationModal } from './ConfirmationModal';
import type { Ingredient, Meal } from '../domain/board';

type ThemeMode = 'dark' | 'light';
type ConfirmAction = 'meal' | 'ingredient' | 'participant' | 'provenance' | null;

interface PendingDelete {
  action: ConfirmAction;
  id?: number;
  name?: string;
  title?: string;
}

export default function BoardPage() {
  const {
    mealDayOptions,
    mealSlots,
    participants,
    provenances,
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
  } = useBoardController();

  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [showMealDrawer, setShowMealDrawer] = useState(false);
  // Repas dont la sous-liste d'ingrédients est dépliée.
  const [expandedMealId, setExpandedMealId] = useState<number | null>(null);
  // Masquer les ingrédients déjà achetés/ramenés dans la vue courses.
  const [hideBought, setHideBought] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') {
      return 'dark';
    }

    const storedTheme = window.localStorage.getItem('foude-theme');
    return storedTheme === 'light' ? 'light' : 'dark';
  });

  const [pendingDelete, setPendingDelete] = useState<PendingDelete>({ action: null });
  const selectableParticipants = [...participants];
  const mealOwners = selectableParticipants.includes(mealDraft.owner)
    ? selectableParticipants
    : [...selectableParticipants, mealDraft.owner];
  const ingredientProvenances = provenances.includes(ingredientDraft.provenance)
    ? provenances
    : [...provenances, ingredientDraft.provenance];

  useEffect(() => {
    document.body.dataset.theme = theme;
    window.localStorage.setItem('foude-theme', theme);

    return () => {
      delete document.body.dataset.theme;
    };
  }, [theme]);

  const closeMealDrawer = () => {
    resetMealDraft();
    setShowMealDrawer(false);
  };

  const openMealDrawer = () => {
    resetMealDraft();
    setShowSettingsPanel(false);
    setShowMealDrawer(true);
  };

  const handleMealEdit = (id: number) => {
    updateMeal(id);
    setShowSettingsPanel(false);
    setShowMealDrawer(true);
  };

  const handleMealSubmit = async () => {
    if (!mealDraft.title.trim()) return;

    await submitMealForm();
    setShowMealDrawer(false);
  };

  const toggleExpanded = (mealId: number) => {
    resetIngredientDraft();
    setExpandedMealId((current) => (current === mealId ? null : mealId));
  };

  const handleIngredientSubmit = async (mealId: number) => {
    if (!ingredientDraft.label.trim()) return;
    await submitIngredientForm(mealId);
  };

  // Confirmation handlers
  const handleConfirmDelete = async () => {
    switch (pendingDelete.action) {
      case 'meal':
        if (pendingDelete.id) await removeMeal(pendingDelete.id);
        break;
      case 'ingredient':
        if (pendingDelete.id) await removeIngredient(pendingDelete.id);
        break;
      case 'participant':
        if (pendingDelete.name) await removeParticipant(pendingDelete.name);
        break;
      case 'provenance':
        if (pendingDelete.name) await removeProvenance(pendingDelete.name);
        break;
    }
    setPendingDelete({ action: null });
  };

  const renderMealCard = (meal: Meal) => {
    const isExpanded = expandedMealId === meal.id;
    return (
      <div className="list-item meal-card" key={meal.id}>
        <div className="meal-card-head">
          <div className="item-main">
            <div className="item-title">{meal.title}</div>
            <div className="item-meta">{meal.day} · {meal.slot} · {meal.owner}</div>
            {meal.note && meal.note !== 'À préciser' && <div className="item-note">{meal.note}</div>}
          </div>
          <div className="item-actions">
            <button
              className="btn-icon"
              type="button"
              onClick={() => toggleExpanded(meal.id)}
              title="Ingrédients"
            >
              {meal.ingredients.length > 0 ? `🛒 ${meal.ingredients.length}` : '🛒'}
            </button>
            <button className="btn-icon" type="button" onClick={() => handleMealEdit(meal.id)} title="Modifier">
              ✎
            </button>
            <button
              className="btn-icon danger"
              type="button"
              onClick={() => setPendingDelete({ action: 'meal', id: meal.id, title: meal.title })}
              title="Supprimer"
            >
              ✕
            </button>
          </div>
        </div>

        {isExpanded ? (
          <div className="ingredient-section">
            {meal.ingredients.length === 0 ? (
              <div className="empty-state empty-state-compact">Aucun ingrédient</div>
            ) : (
              <div className="ingredient-list">
                {meal.ingredients.map((ingredient) => (
                  <div className={ingredient.done ? 'ingredient-row done' : 'ingredient-row'} key={ingredient.id}>
                    <input
                      type="checkbox"
                      checked={ingredient.done}
                      onChange={() => void toggleIngredient(ingredient)}
                      title="Acheté / ramené"
                    />
                    <span className="ingredient-label">{ingredient.label}</span>
                    <span className="ingredient-meta">{ingredient.quantity}</span>
                    <span className="provenance-tag">{ingredient.provenance}</span>
                    <button
                      className="btn-icon"
                      type="button"
                      onClick={() => editIngredient(ingredient)}
                      title="Modifier"
                    >
                      ✎
                    </button>
                    <button
                      className="btn-icon danger"
                      type="button"
                      onClick={() => setPendingDelete({ action: 'ingredient', id: ingredient.id, title: ingredient.label })}
                      title="Supprimer"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="ingredient-form">
              <input
                value={ingredientDraft.label}
                onChange={(event) => setIngredientDraft((current) => ({ ...current, label: event.target.value }))}
                placeholder="Ingrédient"
              />
              <input
                className="ingredient-qty"
                value={ingredientDraft.quantity}
                onChange={(event) => setIngredientDraft((current) => ({ ...current, quantity: event.target.value }))}
                placeholder="Qté"
              />
              <select
                value={ingredientDraft.provenance}
                onChange={(event) => setIngredientDraft((current) => ({ ...current, provenance: event.target.value }))}
                title="Provenance"
              >
                {ingredientProvenances.map((provenance) => (
                  <option key={provenance} value={provenance}>
                    {provenance}
                  </option>
                ))}
              </select>
              <button className="btn-primary" type="button" onClick={() => void handleIngredientSubmit(meal.id)}>
                {editingIngredientId === null ? 'Ajouter' : 'Enregistrer'}
              </button>
              {editingIngredientId !== null ? (
                <button className="btn-secondary" type="button" onClick={resetIngredientDraft}>
                  Annuler
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <main className="app-shell">
      <div className="app-header">
        <div>
          <h1>Foude</h1>
          <p className="header-subtitle">Organiser des repas & courses</p>
        </div>
        <div className="header-actions">
          <button
            className={showSettingsPanel ? 'participants-cta participants-cta-active' : 'participants-cta'}
            type="button"
            onClick={() => {
              closeMealDrawer();
              setShowSettingsPanel((current) => !current);
            }}
          >
            <span className="participants-cta-label">Participants & provenances</span>
            <span className="participants-cta-meta">{participants.length} pers · {provenances.length} prov.</span>
          </button>
        </div>
      </div>

      {showSettingsPanel || showMealDrawer ? (
        <button
          className="drawer-backdrop"
          type="button"
          aria-label="Fermer les panneaux"
          onClick={() => {
            setShowSettingsPanel(false);
            closeMealDrawer();
          }}
        />
      ) : null}

      <aside className={showSettingsPanel ? 'participants-drawer participants-drawer-open' : 'participants-drawer'} aria-hidden={!showSettingsPanel}>
        <div className="participants-drawer-panel">
          <div className="section-header section-header-compact">
            <div>
              <h2>Participants</h2>
              <p className="section-help">Utilisés dans les sélecteurs de responsable</p>
            </div>
            <button className="btn-small" type="button" onClick={() => setShowSettingsPanel(false)}>
              Fermer
            </button>
          </div>
          <div className="participant-form">
            <input
              value={participantDraft}
              onChange={(event) => setParticipantDraft(event.target.value)}
              placeholder="Ajouter un prénom"
            />
            <button className="btn-primary" type="button" onClick={() => void submitParticipantForm()}>
              Ajouter
            </button>
          </div>
          <div className="participant-list participant-list-panel">
            {participants.length === 0 ? (
              <div className="empty-state">Aucun participant enregistré</div>
            ) : (
              participants.map((person) => (
                <div className="participant-pill" key={person}>
                  <span>{person}</span>
                  <button className="btn-icon danger" type="button" onClick={() => setPendingDelete({ action: 'participant', name: person, title: person })} title={`Supprimer ${person}`}>
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="section-header section-header-compact settings-divider">
            <div>
              <h2>Provenances</h2>
              <p className="section-help">D'où viennent les ingrédients (grande surface, marché…)</p>
            </div>
          </div>
          <div className="participant-form">
            <input
              value={provenanceDraft}
              onChange={(event) => setProvenanceDraft(event.target.value)}
              placeholder="Ajouter une provenance"
            />
            <button className="btn-primary" type="button" onClick={() => void submitProvenanceForm()}>
              Ajouter
            </button>
          </div>
          <div className="participant-list participant-list-panel">
            {provenances.length === 0 ? (
              <div className="empty-state">Aucune provenance enregistrée</div>
            ) : (
              provenances.map((provenance) => (
                <div className="participant-pill" key={provenance}>
                  <span>{provenance}</span>
                  <button className="btn-icon danger" type="button" onClick={() => setPendingDelete({ action: 'provenance', name: provenance, title: provenance })} title={`Supprimer ${provenance}`}>
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>

      <aside className={showMealDrawer ? 'editor-drawer editor-drawer-open' : 'editor-drawer'} aria-hidden={!showMealDrawer}>
        <div className="editor-drawer-panel">
          <div className="section-header section-header-compact">
            <div>
              <h2>{editingMealId === null ? 'Ajouter un repas' : 'Modifier le repas'}</h2>
              <p className="section-help">Choisissez le jour (ou le séjour entier), le créneau et le responsable</p>
            </div>
            <button className="btn-small" type="button" onClick={closeMealDrawer}>
              Fermer
            </button>
          </div>
          <div className="compact-form">
            <div className="form-row">
              <select value={mealDraft.day} onChange={(event) => setMealDraft((current) => ({ ...current, day: event.target.value }))} title="Jour">
                {mealDayOptions.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
              <select value={mealDraft.slot} onChange={(event) => setMealDraft((current) => ({ ...current, slot: event.target.value as typeof mealSlots[number] }))} title="Créneau">
                {mealSlots.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
            </div>
            <input
              value={mealDraft.title}
              onChange={(event) => setMealDraft((current) => ({ ...current, title: event.target.value }))}
              placeholder="Intitulé du repas"
              className="form-input-full"
            />
            <input
              value={mealDraft.note}
              onChange={(event) => setMealDraft((current) => ({ ...current, note: event.target.value }))}
              placeholder="Note optionnelle"
              className="form-input-full"
            />
            <select value={mealDraft.owner} onChange={(event) => setMealDraft((current) => ({ ...current, owner: event.target.value }))} title="Responsable">
              {mealOwners.map((person) => (
                <option key={person} value={person}>
                  {person}
                </option>
              ))}
            </select>
            <div className="form-actions">
              <button className="btn-primary" type="button" onClick={() => void handleMealSubmit()}>
                {editingMealId === null ? 'Créer le repas' : 'Enregistrer'}
              </button>
              <button className="btn-secondary" type="button" onClick={closeMealDrawer}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      </aside>

      {syncError ? (
        <div className="error-alert">
          <div className="error-content">
            <strong>Impossible de se connecter</strong>
            <p>{syncError}</p>
          </div>
          <button className="btn-small" type="button" onClick={() => void refreshState()}>
            Réessayer
          </button>
        </div>
      ) : null}

      <section className="board-grid">
        <article className="panel section-meals">
          <div className="section-header">
            <h2>Repas</h2>
            <button className="btn-toggle" type="button" onClick={openMealDrawer}>
              + Ajouter
            </button>
          </div>

          {stayMeals.length > 0 ? (
            <div className="stay-meals">
              <div className="stay-meals-label">Pour tout le séjour</div>
              {stayMeals.map((meal) => renderMealCard(meal))}
            </div>
          ) : null}

          <div className="day-filter">
            {['Tous', ...mealDays].map((day) => (
              <button
                key={day}
                className={day === activeDay ? 'filter-chip active' : 'filter-chip'}
                onClick={() => setActiveDay(day)}
                type="button"
              >
                {day}
              </button>
            ))}
          </div>
          <div className="items-list">
            {loading ? (
              <div className="empty-state">Chargement…</div>
            ) : visibleMeals.length === 0 ? (
              <div className="empty-state">Aucun repas</div>
            ) : (
              visibleMeals.map((meal) => renderMealCard(meal))
            )}
          </div>
        </article>

        <div className="side-column">
          <article className="panel section-items">
            <div className="section-header">
              <h2>Courses</h2>
              {coursesSummary.total > 0 ? (
                <span className="section-help">
                  {coursesSummary.remaining === 0
                    ? 'Tout est prêt 🎉'
                    : `${coursesSummary.remaining} restant${coursesSummary.remaining > 1 ? 's' : ''} sur ${coursesSummary.total}`}
                </span>
              ) : (
                <span className="section-help">Agrégées par provenance</span>
              )}
            </div>

            {coursesSummary.done > 0 ? (
              <label className="courses-toggle">
                <input
                  type="checkbox"
                  checked={hideBought}
                  onChange={(event) => setHideBought(event.target.checked)}
                />
                Masquer les achetés
              </label>
            ) : null}

            <div className="items-list">
              {loading ? (
                <div className="empty-state">Chargement…</div>
              ) : provenanceGroups.length === 0 ? (
                <div className="empty-state">Aucun ingrédient. Ajoutez-en depuis un repas.</div>
              ) : (
                (() => {
                  const groups = provenanceGroups
                    .map((group) => ({
                      ...group,
                      ingredients: hideBought ? group.ingredients.filter((i) => !i.done) : group.ingredients,
                    }))
                    .filter((group) => group.ingredients.length > 0);

                  if (groups.length === 0) {
                    return <div className="empty-state">Tout est acheté 🎉</div>;
                  }

                  return groups.map((group) => (
                    <div className="provenance-group" key={group.provenance}>
                      <div className="provenance-group-head">
                        <span className="provenance-group-title">{group.provenance}</span>
                        <span className="provenance-group-count">
                          {group.ingredients.filter((i) => i.done).length}/{group.ingredients.length}
                        </span>
                      </div>
                      {group.ingredients.map((ingredient) => (
                        <div className={ingredient.done ? 'ingredient-row done' : 'ingredient-row'} key={ingredient.id}>
                          <input
                            type="checkbox"
                            checked={ingredient.done}
                            onChange={() => void toggleIngredient(ingredient as Ingredient)}
                            title="Acheté / ramené"
                          />
                          <span className="ingredient-label">{ingredient.label}</span>
                          <span className="ingredient-meta">{ingredient.quantity}</span>
                          <span className="ingredient-source">{ingredient.mealTitle}</span>
                        </div>
                      ))}
                    </div>
                  ));
                })()
              )}
            </div>
          </article>
        </div>
      </section>

      <ConfirmationModal
        isOpen={pendingDelete.action !== null}
        title={
          pendingDelete.action === 'meal' ? 'Supprimer le repas ?' :
          pendingDelete.action === 'ingredient' ? 'Supprimer l’ingrédient ?' :
          pendingDelete.action === 'participant' ? 'Supprimer le participant ?' :
          pendingDelete.action === 'provenance' ? 'Supprimer la provenance ?' :
          'Confirmer'
        }
        message={`Êtes-vous sûr de vouloir supprimer "${pendingDelete.title}" ? Cette action ne peut pas être annulée.`}
        confirmText="Oui, supprimer"
        cancelText="Annuler"
        isDangerous
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete({ action: null })}
      />
    </main>
  );
}
