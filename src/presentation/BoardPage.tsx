import { useEffect, useState } from 'react';
import { useBoardController } from './useBoardController';
import { ConfirmationModal } from './ConfirmationModal';

type ThemeMode = 'dark' | 'light';
type EditorDrawerMode = 'meal' | 'item' | null;
type ConfirmAction = 'meal' | 'item' | 'participant' | null;

interface PendingDelete {
  action: ConfirmAction;
  id?: number;
  name?: string;
  title?: string;
}

export default function BoardPage() {
  const {
    mealDays,
    mealSlots,
    meals,
    items,
    participants,
    mealDraft,
    itemDraft,
    participantDraft,
    activeDay,
    setActiveDay,
    editingMealId,
    editingItemId,
    loading,
    syncError,
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
    removeMeal,
    removeItem,
    removeParticipant,
    resetMealDraft,
    resetItemDraft,
    refreshState,
  } = useBoardController();

  const [showParticipantsPanel, setShowParticipantsPanel] = useState(false);
  const [editorDrawerMode, setEditorDrawerMode] = useState<EditorDrawerMode>(null);
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
  const itemAssignees = selectableParticipants.includes(itemDraft.assignedTo)
    ? selectableParticipants
    : [...selectableParticipants, itemDraft.assignedTo];

  useEffect(() => {
    document.body.dataset.theme = theme;
    window.localStorage.setItem('foude-theme', theme);

    return () => {
      delete document.body.dataset.theme;
    };
  }, [theme]);

  const closeEditorDrawer = () => {
    if (editorDrawerMode === 'meal') {
      resetMealDraft();
    }

    if (editorDrawerMode === 'item') {
      resetItemDraft();
    }

    setEditorDrawerMode(null);
  };

  const openMealDrawer = () => {
    resetMealDraft();
    setShowParticipantsPanel(false);
    setEditorDrawerMode('meal');
  };

  const openItemDrawer = () => {
    resetItemDraft();
    setShowParticipantsPanel(false);
    setEditorDrawerMode('item');
  };

  const handleMealEdit = (id: number) => {
    updateMeal(id);
    setShowParticipantsPanel(false);
    setEditorDrawerMode('meal');
  };

  const handleItemEdit = (id: number) => {
    updateItem(id);
    setShowParticipantsPanel(false);
    setEditorDrawerMode('item');
  };

  const handleMealSubmit = async () => {
    if (!mealDraft.title.trim()) return;

    await submitMealForm();
    setEditorDrawerMode(null);
  };

  const handleItemSubmit = async () => {
    if (!itemDraft.label.trim()) return;

    await submitItemForm();
    setEditorDrawerMode(null);
  };

  // Confirmation handlers
  const handleConfirmDelete = async () => {
    switch (pendingDelete.action) {
      case 'meal':
        if (pendingDelete.id) {
          await removeMeal(pendingDelete.id);
        }
        break;
      case 'item':
        if (pendingDelete.id) {
          await removeItem(pendingDelete.id);
        }
        break;
      case 'participant':
        if (pendingDelete.name) {
          await removeParticipant(pendingDelete.name);
        }
        break;
    }
    setPendingDelete({ action: null });
  };

  const handleOpenDeleteMealModal = (mealId: number, mealTitle: string) => {
    setPendingDelete({ action: 'meal', id: mealId, title: mealTitle });
  };

  const handleOpenDeleteItemModal = (itemId: number, itemLabel: string) => {
    setPendingDelete({ action: 'item', id: itemId, title: itemLabel });
  };

  const handleOpenDeleteParticipantModal = (participantName: string) => {
    setPendingDelete({ action: 'participant', name: participantName, title: participantName });
  };

  return (
    <main className="app-shell">
      <div className="app-header">
        <div>
          <h1>Foude</h1>
          <p className="header-subtitle">Organiser des repas & courses</p>
        </div>
        <div className="header-actions">
          {/* <button
            className="theme-toggle"
            type="button"
            onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
          >
            {theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
          </button> */}
          <button
            className={showParticipantsPanel ? 'participants-cta participants-cta-active' : 'participants-cta'}
            type="button"
            onClick={() => {
              closeEditorDrawer();
              setShowParticipantsPanel((current) => !current);
            }}
          >
            <span className="participants-cta-label">Configurer les participants</span>
            <span className="participants-cta-meta">{participants.length} personnes</span>
          </button>

        </div>
      </div>

      {showParticipantsPanel || editorDrawerMode !== null ? (
        <button
          className="drawer-backdrop"
          type="button"
          aria-label="Fermer les panneaux"
          onClick={() => {
            setShowParticipantsPanel(false);
            closeEditorDrawer();
          }}
        />
      ) : null}

      <aside className={showParticipantsPanel ? 'participants-drawer participants-drawer-open' : 'participants-drawer'} aria-hidden={!showParticipantsPanel}>
        <div className="participants-drawer-panel">
          <div className="section-header section-header-compact">
            <div>
              <h2>Participants</h2>
              <p className="section-help">Liste utilisée dans les sélecteurs repas et courses</p>
            </div>
            <button className="btn-small" type="button" onClick={() => setShowParticipantsPanel(false)}>
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
                  <button className="btn-icon danger" type="button" onClick={() => handleOpenDeleteParticipantModal(person)} title={`Supprimer ${person}`}>
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>

      <aside className={editorDrawerMode !== null ? 'editor-drawer editor-drawer-open' : 'editor-drawer'} aria-hidden={editorDrawerMode === null}>
        <div className="editor-drawer-panel">
          {editorDrawerMode === 'meal' ? (
            <>
              <div className="section-header section-header-compact">
                <div>
                  <h2>{editingMealId === null ? 'Ajouter un repas' : 'Modifier le repas'}</h2>
                  <p className="section-help">Choisissez le créneau, le responsable et les détails utiles</p>
                </div>
                <button className="btn-small" type="button" onClick={closeEditorDrawer}>
                  Fermer
                </button>
              </div>
              <div className="compact-form">
                <div className="form-row">
                  <select value={mealDraft.day} onChange={(event) => setMealDraft((current) => ({ ...current, day: event.target.value }))} title="Jour">
                    {mealDays.map((day) => (
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
                  <button className="btn-secondary" type="button" onClick={closeEditorDrawer}>
                    Annuler
                  </button>
                </div>
              </div>
            </>
          ) : null}

          {editorDrawerMode === 'item' ? (
            <>
              <div className="section-header section-header-compact">
                <div>
                  <h2>{editingItemId === null ? 'Ajouter une course' : 'Modifier la course'}</h2>
                  <p className="section-help">Renseignez l’article, la quantité et la personne responsable</p>
                </div>
                <button className="btn-small" type="button" onClick={closeEditorDrawer}>
                  Fermer
                </button>
              </div>
              <div className="compact-form">
                <input
                  value={itemDraft.label}
                  onChange={(event) => setItemDraft((current) => ({ ...current, label: event.target.value }))}
                  placeholder="Article"
                  className="form-input-full"
                />
                <div className="form-row">
                  <input
                    value={itemDraft.quantity}
                    onChange={(event) => setItemDraft((current) => ({ ...current, quantity: event.target.value }))}
                    placeholder="Quantité"
                  />
                  <select value={itemDraft.assignedTo} onChange={(event) => setItemDraft((current) => ({ ...current, assignedTo: event.target.value }))} title="Responsable">
                    {itemAssignees.map((person) => (
                      <option key={person} value={person}>
                        {person}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-actions">
                  <button className="btn-primary" type="button" onClick={() => void handleItemSubmit()}>
                    {editingItemId === null ? 'Créer l’article' : 'Enregistrer'}
                  </button>
                  <button className="btn-secondary" type="button" onClick={closeEditorDrawer}>
                    Annuler
                  </button>
                </div>
              </div>
            </>
          ) : null}
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
              visibleMeals.map((meal) => (
                <div className="list-item" key={meal.id}>
                  <div className="item-main">
                    <div className="item-title">{meal.title}</div>
                    <div className="item-meta">{meal.day} · {meal.slot} · {meal.owner}</div>
                    {meal.note && meal.note !== 'À préciser' && <div className="item-note">{meal.note}</div>}
                  </div>
                  <div className="item-actions">
                    <button className="btn-icon" type="button" onClick={() => handleMealEdit(meal.id)} title="Modifier">
                      ✎
                    </button>
                    <button className="btn-icon danger" type="button" onClick={() => handleOpenDeleteMealModal(meal.id, meal.title)} title="Supprimer">
                      ✕
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>

        <div className="side-column">
          <article className="panel section-items">
          <div className="section-header">
            <h2>Courses</h2>
            <button className="btn-toggle" type="button" onClick={openItemDrawer}>
              + Ajouter
            </button>
          </div>

          <div className="items-list">
            {loading ? (
              <div className="empty-state">Chargement…</div>
            ) : items.length === 0 ? (
              <div className="empty-state">Aucun article</div>
            ) : (
              items.map((item) => (
                <div className="list-item" key={item.id}>
                  <div className="item-main">
                    <div className="item-title">{item.label}</div>
                    <div className="item-meta">{item.quantity} · {item.assignedTo}</div>
                  </div>
                  <div className="item-actions">
                    <button className="btn-icon" type="button" onClick={() => handleItemEdit(item.id)} title="Modifier">
                      ✎
                    </button>
                    <button className="btn-icon danger" type="button" onClick={() => handleOpenDeleteItemModal(item.id, item.label)} title="Supprimer">
                      ✕
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          </article>
        </div>
      </section>

      <ConfirmationModal
        isOpen={pendingDelete.action !== null}
        title={
          pendingDelete.action === 'meal' ? 'Supprimer le repas ?' :
          pendingDelete.action === 'item' ? 'Supprimer la course ?' :
          pendingDelete.action === 'participant' ? 'Supprimer le participant ?' :
          'Confirmer'
        }
        message={
          pendingDelete.action === 'meal' ? `Êtes-vous sûr de vouloir supprimer "${pendingDelete.title}" ? Cette action ne peut pas être annulée.` :
          pendingDelete.action === 'item' ? `Êtes-vous sûr de vouloir supprimer "${pendingDelete.title}" ? Cette action ne peut pas être annulée.` :
          pendingDelete.action === 'participant' ? `Êtes-vous sûr de vouloir supprimer ${pendingDelete.title} ? Cette action ne peut pas être annulée.` :
          ''
        }
        confirmText="Oui, supprimer"
        cancelText="Annuler"
        isDangerous
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete({ action: null })}
      />
    </main>
  );
}
