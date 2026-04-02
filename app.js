const STORAGE_KEY = "trackforge-prototype-v1";

const ui = {
  userSelect: document.querySelector("#user-select"),
  programSelect: document.querySelector("#program-select"),
  weightUnitSelect: document.querySelector("#weight-unit-select"),
  distanceUnitSelect: document.querySelector("#distance-unit-select"),
  metricsGrid: document.querySelector("#metrics-grid"),
  recommendationsList: document.querySelector("#recommendations-list"),
  trendBars: document.querySelector("#trend-bars"),
  templateList: document.querySelector("#template-list"),
  exerciseBuilder: document.querySelector("#exercise-builder"),
  templateHeading: document.querySelector("#template-heading"),
  templateNameInput: document.querySelector("#template-name-input"),
  templateFocusInput: document.querySelector("#template-focus-input"),
  templateLogModeInput: document.querySelector("#template-log-mode-input"),
  templateNotesInput: document.querySelector("#template-notes-input"),
  calendarDays: document.querySelector("#calendar-days"),
  calendarHeading: document.querySelector("#calendar-heading"),
  selectedDateLabel: document.querySelector("#selected-date-label"),
  selectedDayContent: document.querySelector("#selected-day-content"),
  mobileWorkoutName: document.querySelector("#mobile-workout-name"),
  mobileWorkoutSummary: document.querySelector("#mobile-workout-summary"),
  mobileProgressBar: document.querySelector("#mobile-progress-bar"),
  mobileStepLabel: document.querySelector("#mobile-step-label"),
  mobileStepCard: document.querySelector("#mobile-step-card"),
  sessionHistoryList: document.querySelector("#session-history-list"),
  viewTabs: Array.from(document.querySelectorAll(".view-tab")),
  viewPanels: Array.from(document.querySelectorAll(".view-panel")),
};

const todayIso = formatIsoDate(new Date());
let state = loadState();
ensureStateShape();
renderAll();
bindEvents();

function bindEvents() {
  ui.userSelect.addEventListener("change", (event) => {
    state.ui.activeUserId = event.target.value;
    state.ui.mobileExerciseIndex = 0;
    ensureStateShape();
    saveState();
    renderAll();
  });

  ui.programSelect.addEventListener("change", (event) => {
    const user = getActiveUser();
    user.selectedTemplateId = event.target.value;
    state.ui.mobileExerciseIndex = 0;
    saveState();
    renderAll();
  });

  ui.weightUnitSelect.addEventListener("change", (event) => {
    const user = getActiveUser();
    user.preferences.weightUnit = event.target.value;
    saveState();
    renderAll();
  });

  ui.distanceUnitSelect.addEventListener("change", (event) => {
    const user = getActiveUser();
    user.preferences.distanceUnit = event.target.value;
    saveState();
    renderAll();
  });

  document.querySelector("#seed-workout-btn").addEventListener("click", () => {
    startOrResumeDraft();
    setActiveView("mobile-panel");
    renderAll();
  });

  document.querySelector("#new-template-btn").addEventListener("click", () => {
    const user = getActiveUser();
    const template = createTemplate({
      name: `New Workout ${user.programs.length + 1}`,
      focus: "Custom block",
      logMode: "set-by-set",
      notes: "Add strength and cardio blocks from the forms below.",
      exercises: [],
    });
    user.programs.unshift(template);
    user.selectedTemplateId = template.id;
    saveState();
    renderAll();
  });

  document.querySelector("#duplicate-template-btn").addEventListener("click", () => {
    const user = getActiveUser();
    const template = getActiveTemplate();
    if (!template) {
      return;
    }

    const copy = deepClone(template);
    copy.id = createId("template");
    copy.name = `${template.name} Copy`;
    copy.exercises.forEach((exercise) => {
      exercise.id = createId("exercise");
    });
    user.programs.unshift(copy);
    user.selectedTemplateId = copy.id;
    saveState();
    renderAll();
  });

  ui.templateNameInput.addEventListener("input", (event) => {
    const template = getActiveTemplate();
    if (!template) {
      return;
    }
    template.name = event.target.value;
    saveState();
    renderAll();
  });

  ui.templateFocusInput.addEventListener("input", (event) => {
    const template = getActiveTemplate();
    if (!template) {
      return;
    }
    template.focus = event.target.value;
    saveState();
    renderAll();
  });

  ui.templateLogModeInput.addEventListener("change", (event) => {
    const template = getActiveTemplate();
    if (!template) {
      return;
    }
    template.logMode = event.target.value;
    saveState();
    renderAll();
  });

  ui.templateNotesInput.addEventListener("input", (event) => {
    const template = getActiveTemplate();
    if (!template) {
      return;
    }
    template.notes = event.target.value;
    saveState();
    renderAll();
  });

  document.querySelector("#strength-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const setCount = Number(formData.get("setCount"));
    const startWeight = convertWeightToCanonical(Number(formData.get("startWeight")));
    const targetReps = Number(formData.get("targetReps"));
    const targetRpe = Number(formData.get("targetRpe"));
    const rampIncrement = convertWeightToCanonical(getWeightUnit() === "kg" ? 2.5 : 5);
    const sets = Array.from({ length: setCount }, (_, index) => ({
      plannedWeight: startWeight + index * rampIncrement,
      plannedReps: targetReps,
      plannedRpe: targetRpe + Math.min(index * 0.5, 2),
    }));
    const exercise = createStrengthExercise({
      name: String(formData.get("exerciseName")).trim(),
      repRange: String(formData.get("repRange")).trim(),
      movementTag: String(formData.get("movementTag")),
      progressionStyle: String(formData.get("progressionStyle")),
      sets,
    });
    getActiveTemplate().exercises.push(exercise);
    event.currentTarget.reset();
    saveState();
    renderAll();
  });

  document.querySelector("#cardio-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const exercise = createCardioExercise({
      name: String(formData.get("cardioName")).trim(),
      targetTime: Number(formData.get("targetTime")),
      targetDistance: convertDistanceToCanonical(Number(formData.get("targetDistance"))),
      targetDifficulty: Number(formData.get("targetDifficulty")),
      notes: String(formData.get("cardioNotes")).trim(),
    });
    getActiveTemplate().exercises.push(exercise);
    event.currentTarget.reset();
    saveState();
    renderAll();
  });

  document.addEventListener("click", (event) => {
    const actionTrigger = event.target.closest("[data-action]");
    if (!actionTrigger) {
      return;
    }

    const action = actionTrigger.dataset.action;
    const exerciseId = actionTrigger.dataset.exerciseId;

    if (action === "select-template") {
      getActiveUser().selectedTemplateId = actionTrigger.dataset.templateId;
      state.ui.mobileExerciseIndex = 0;
      saveState();
      renderAll();
      return;
    }

    if (action === "calendar-date") {
      state.ui.selectedDate = actionTrigger.dataset.date;
      saveState();
      renderAll();
      return;
    }

    if (action === "move-up" || action === "move-down") {
      const template = getActiveTemplate();
      const index = template.exercises.findIndex((exercise) => exercise.id === exerciseId);
      if (index === -1) {
        return;
      }
      const targetIndex = action === "move-up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= template.exercises.length) {
        return;
      }
      const [exercise] = template.exercises.splice(index, 1);
      template.exercises.splice(targetIndex, 0, exercise);
      saveState();
      renderAll();
      return;
    }

    if (action === "delete-exercise") {
      const template = getActiveTemplate();
      template.exercises = template.exercises.filter((exercise) => exercise.id !== exerciseId);
      saveState();
      renderAll();
      return;
    }

    if (action === "add-set") {
      const exercise = getActiveTemplate().exercises.find((item) => item.id === exerciseId);
      if (!exercise || exercise.type !== "strength") {
        return;
      }
      const lastSet = exercise.sets[exercise.sets.length - 1] || {
        plannedWeight: 0,
        plannedReps: 0,
        plannedRpe: 6,
      };
      exercise.sets.push({
        plannedWeight: lastSet.plannedWeight,
        plannedReps: lastSet.plannedReps,
        plannedRpe: lastSet.plannedRpe,
      });
      saveState();
      renderAll();
      return;
    }

    if (action === "remove-set") {
      const exercise = getActiveTemplate().exercises.find((item) => item.id === exerciseId);
      const setIndex = Number(actionTrigger.dataset.setIndex);
      if (!exercise || exercise.type !== "strength" || exercise.sets.length === 1) {
        return;
      }
      exercise.sets.splice(setIndex, 1);
      saveState();
      renderAll();
      return;
    }
  });

  document.addEventListener("input", (event) => {
    const target = event.target;
    const exerciseId = target.dataset.exerciseId;
    if (!exerciseId) {
      return;
    }

    const exercise = getActiveTemplate().exercises.find((item) => item.id === exerciseId);
    if (!exercise) {
      return;
    }

    if (target.dataset.exerciseField) {
      const field = target.dataset.exerciseField;
      exercise[field] = target.value;
      saveState();
      renderAll();
      return;
    }

    if (target.dataset.cardioField) {
      const field = target.dataset.cardioField;
      if (field === "targetDistance") {
        exercise[field] = convertDistanceToCanonical(Number(target.value));
      } else {
        exercise[field] = isNumericField(field) ? Number(target.value) : target.value;
      }
      saveState();
      renderAll();
      return;
    }

    if (target.dataset.setField) {
      const setIndex = Number(target.dataset.setIndex);
      const field = target.dataset.setField;
      exercise.sets[setIndex][field] = field === "plannedWeight"
        ? convertWeightToCanonical(Number(target.value))
        : Number(target.value);
      saveState();
      renderAll();
    }
  });

  ui.viewTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      setActiveView(tab.dataset.viewTarget);
      saveState();
      renderAll();
    });
  });

  document.querySelector("#calendar-prev-btn").addEventListener("click", () => {
    state.ui.calendarAnchor = shiftMonth(state.ui.calendarAnchor, -1);
    saveState();
    renderAll();
  });

  document.querySelector("#calendar-next-btn").addEventListener("click", () => {
    state.ui.calendarAnchor = shiftMonth(state.ui.calendarAnchor, 1);
    saveState();
    renderAll();
  });

  document.querySelector("#mobile-prev-btn").addEventListener("click", () => {
    const template = getActiveTemplate();
    if (!template || !template.exercises.length) {
      return;
    }
    state.ui.mobileExerciseIndex = Math.max(0, state.ui.mobileExerciseIndex - 1);
    saveState();
    renderAll();
  });

  document.querySelector("#mobile-next-btn").addEventListener("click", () => {
    const template = getActiveTemplate();
    if (!template || !template.exercises.length) {
      return;
    }
    state.ui.mobileExerciseIndex = Math.min(template.exercises.length - 1, state.ui.mobileExerciseIndex + 1);
    saveState();
    renderAll();
  });

  document.querySelector("#mobile-log-btn").addEventListener("click", () => {
    logCurrentMobileStep();
    saveState();
    renderAll();
  });
}

function renderAll() {
  ensureStateShape();
  renderSelectors();
  renderActiveView();
  renderMetrics();
  renderRecommendations();
  renderTrendBars();
  renderTemplateList();
  renderBuilder();
  renderCalendar();
  renderSelectedDate();
  renderMobile();
  renderSessionHistory();
}

function renderSelectors() {
  const activeUser = getActiveUser();
  ui.userSelect.innerHTML = state.users
    .map((user) => `<option value="${user.id}" ${user.id === activeUser.id ? "selected" : ""}>${escapeHtml(user.name)}</option>`)
    .join("");

  ui.programSelect.innerHTML = activeUser.programs
    .map((program) => `<option value="${program.id}" ${program.id === activeUser.selectedTemplateId ? "selected" : ""}>${escapeHtml(program.name)}</option>`)
    .join("");

  ui.weightUnitSelect.value = getWeightUnit(activeUser);
  ui.distanceUnitSelect.value = getDistanceUnit(activeUser);
}

function renderActiveView() {
  ui.viewTabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.viewTarget === state.ui.activeView);
  });
  ui.viewPanels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.id === state.ui.activeView);
  });
}

function renderMetrics() {
  const user = getActiveUser();
  const strengthSets = user.sessions.flatMap((session) =>
    session.exerciseResults.flatMap((exercise) => (exercise.type === "strength" ? exercise.sets : []))
  );
  const totalVolume = strengthSets.reduce((sum, set) => sum + set.weight * set.reps, 0);
  const bestOneRm = strengthSets.reduce((best, set) => Math.max(best, estimateOneRm(set.weight, set.reps)), 0);
  const averageRpe = strengthSets.length ? strengthSets.reduce((sum, set) => sum + set.rpe, 0) / strengthSets.length : 0;
  const sessionCount = user.sessions.length;
  const measurementTrend = getLatestMeasurementDelta(user.measurements);
  const lastSevenSessions = [...user.sessions].sort(sortSessionsDesc).slice(0, 7);
  const workoutStreak = getRecentWorkoutStreak(lastSevenSessions);

  const cards = [
    {
      label: "Saved sessions",
      value: sessionCount,
      note: "Sessions available for long-term analysis",
    },
    {
      label: "Total volume",
      value: formatVolume(totalVolume, user),
      note: "Strength work combined across saved sessions",
    },
    {
      label: "Best est. 1RM",
      value: formatWeight(bestOneRm, user),
      note: "Calculated from your strongest logged top set",
    },
    {
      label: "Average RPE",
      value: averageRpe ? averageRpe.toFixed(1) : "0.0",
      note: "Useful for pacing fatigue and progression",
    },
    {
      label: "Recent trend",
      value: measurementTrend,
      note: `Workout streak: ${workoutStreak} ${workoutStreak === 1 ? "session" : "sessions"}`,
    },
  ];

  ui.metricsGrid.innerHTML = cards
    .map(
      (card) => `
        <article class="metric-card">
          <span>${escapeHtml(card.label)}</span>
          <strong>${escapeHtml(String(card.value))}</strong>
          <p>${escapeHtml(card.note)}</p>
        </article>
      `
    )
    .join("");
}

function renderRecommendations() {
  const template = getActiveTemplate();
  if (!template || !template.exercises.length) {
    ui.recommendationsList.innerHTML = `<p class="empty-copy">Add a workout template to generate progression ideas.</p>`;
    return;
  }

  const user = getActiveUser();
  const recommendations = template.exercises
    .filter((exercise) => exercise.type === "strength")
    .map((exercise) => createRecommendation(exercise, user.sessions))
    .filter(Boolean);

  if (!recommendations.length) {
    ui.recommendationsList.innerHTML = `<p class="empty-copy">Log more sessions for this template and progression calls will appear here.</p>`;
    return;
  }

  ui.recommendationsList.innerHTML = recommendations
    .map(
      (rec) => `
        <article class="recommendation-card">
          <header>
            <div>
              <h3>${escapeHtml(rec.exerciseName)}</h3>
              <p>${escapeHtml(rec.reason)}</p>
            </div>
            <span class="recommendation-chip ${escapeHtml(rec.type)}">${escapeHtml(rec.badge)}</span>
          </header>
          <div class="exercise-summary">
            <span class="summary-pill">Next target: ${escapeHtml(rec.target)}</span>
            <span class="summary-pill">Confidence: ${escapeHtml(rec.confidence)}</span>
          </div>
        </article>
      `
    )
    .join("");
}

function renderTrendBars() {
  const user = getActiveUser();
  const sessions = [...user.sessions].sort((left, right) => new Date(left.date) - new Date(right.date)).slice(-6);
  if (!sessions.length) {
    ui.trendBars.innerHTML = `<p class="empty-copy">Once you log sessions, weekly load bars will build here.</p>`;
    return;
  }

  const series = sessions.map((session) => {
    const volume = session.exerciseResults.reduce((sum, exercise) => {
      if (exercise.type !== "strength") {
        return sum;
      }
      return sum + exercise.sets.reduce((inner, set) => inner + set.weight * set.reps, 0);
    }, 0);
    return {
      label: `${formatMonthDay(session.date)} · ${session.workoutName}`,
      volume,
      bestOneRm: Math.max(
        0,
        ...session.exerciseResults.flatMap((exercise) =>
          exercise.type === "strength" ? exercise.sets.map((set) => estimateOneRm(set.weight, set.reps)) : [0]
        )
      ),
    };
  });
  const maxVolume = Math.max(...series.map((item) => item.volume), 1);

  ui.trendBars.innerHTML = series
    .map(
      (item) => `
        <article class="trend-card">
          <header>
            <div>
              <h3>${escapeHtml(item.label)}</h3>
              <p>Estimated 1RM peak: ${formatWeight(item.bestOneRm, user)}</p>
            </div>
            <strong>${formatVolume(item.volume, user)}</strong>
          </header>
          <div class="trend-bar">
            <div class="bar-track">
              <span class="bar-fill" style="width: ${Math.max(8, (item.volume / maxVolume) * 100)}%"></span>
            </div>
          </div>
        </article>
      `
    )
    .join("");
}

function renderTemplateList() {
  const user = getActiveUser();
  ui.templateList.innerHTML = user.programs
    .map(
      (template) => `
        <button class="template-pill ${template.id === user.selectedTemplateId ? "is-active" : ""}" data-action="select-template" data-template-id="${template.id}" type="button">
          <strong>${escapeHtml(template.name)}</strong>
          <p>${escapeHtml(template.focus)}</p>
          <footer>
            <span class="template-tag">${template.logMode === "set-by-set" ? "Set by set" : "Workout level"}</span>
            <span class="template-tag">${template.exercises.length} blocks</span>
          </footer>
        </button>
      `
    )
    .join("");
}

function renderBuilder() {
  const template = getActiveTemplate();
  if (!template) {
    ui.exerciseBuilder.innerHTML = "";
    return;
  }

  ui.templateHeading.textContent = template.name;
  ui.templateNameInput.value = template.name;
  ui.templateFocusInput.value = template.focus;
  ui.templateLogModeInput.value = template.logMode;
  ui.templateNotesInput.value = template.notes;

  if (!template.exercises.length) {
    ui.exerciseBuilder.innerHTML = `<p class="empty-copy">This workout is empty right now. Add a strength block or cardio block to get started.</p>`;
    return;
  }

  ui.exerciseBuilder.innerHTML = template.exercises
    .map((exercise, index) => (exercise.type === "strength" ? renderStrengthCard(exercise, index, template) : renderCardioCard(exercise, index)))
    .join("");
}

function renderStrengthCard(exercise, index, template) {
  const user = getActiveUser();
  const summary = summarizeStrengthExercise(exercise.sets, "planned");
  return `
    <article class="exercise-card strength">
      <div class="exercise-top">
        <div>
          <p class="eyebrow">Strength Block ${index + 1}</p>
          <h3>${escapeHtml(exercise.name)}</h3>
        </div>
        <div class="exercise-actions">
          <button class="mini-button" data-action="move-up" data-exercise-id="${exercise.id}" type="button">Up</button>
          <button class="mini-button" data-action="move-down" data-exercise-id="${exercise.id}" type="button">Down</button>
          <button class="mini-button danger-button" data-action="delete-exercise" data-exercise-id="${exercise.id}" type="button">Delete</button>
        </div>
      </div>

      <div class="exercise-meta">
        <label class="field">
          <span>Name</span>
          <input data-exercise-id="${exercise.id}" data-exercise-field="name" type="text" value="${escapeHtml(exercise.name)}">
        </label>
        <label class="field">
          <span>Rep range</span>
          <input data-exercise-id="${exercise.id}" data-exercise-field="repRange" type="text" value="${escapeHtml(exercise.repRange)}">
        </label>
        <label class="field">
          <span>Movement tag</span>
          <input data-exercise-id="${exercise.id}" data-exercise-field="movementTag" type="text" value="${escapeHtml(exercise.movementTag)}">
        </label>
        <label class="field">
          <span>Progression style</span>
          <select data-exercise-id="${exercise.id}" data-exercise-field="progressionStyle">
            <option value="weight-first" ${exercise.progressionStyle === "weight-first" ? "selected" : ""}>Increase load first</option>
            <option value="rep-first" ${exercise.progressionStyle === "rep-first" ? "selected" : ""}>Increase reps first</option>
            <option value="hold" ${exercise.progressionStyle === "hold" ? "selected" : ""}>Hold until technique improves</option>
          </select>
        </label>
      </div>

      <div class="table-shell">
        <table class="exercise-table">
          <thead>
            <tr>
              <th class="col-set">Set</th>
              <th class="col-weight">Weight (${getWeightUnit(user)})</th>
              <th class="col-reps">Reps</th>
              <th class="col-rpe">RPE</th>
              <th class="col-volume">Volume</th>
              <th>Remove</th>
            </tr>
          </thead>
          <tbody>
            ${exercise.sets
              .map(
                (set, setIndex) => `
                  <tr>
                    <td>${setIndex + 1}</td>
                    <td><input class="table-input" data-exercise-id="${exercise.id}" data-set-field="plannedWeight" data-set-index="${setIndex}" type="number" min="0" step="0.5" value="${formatEditableWeight(set.plannedWeight, user)}"></td>
                    <td><input class="table-input" data-exercise-id="${exercise.id}" data-set-field="plannedReps" data-set-index="${setIndex}" type="number" min="0" step="0.5" value="${set.plannedReps}"></td>
                    <td><input class="table-input" data-exercise-id="${exercise.id}" data-set-field="plannedRpe" data-set-index="${setIndex}" type="number" min="1" max="10" step="0.5" value="${set.plannedRpe}"></td>
                    <td>${formatVolume(set.plannedWeight * set.plannedReps, user)}</td>
                    <td><button class="mini-button danger-button" data-action="remove-set" data-exercise-id="${exercise.id}" data-set-index="${setIndex}" type="button">X</button></td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>

      <div class="exercise-summary">
        <span class="summary-pill">Top set: ${formatWeightValue(summary.topSet.weight, user)} x ${formatNumber(summary.topSet.reps)}</span>
        <span class="summary-pill">Estimated 1RM: ${formatWeight(summary.estimatedOneRm, user)}</span>
        <span class="summary-pill">Total volume: ${formatVolume(summary.volume, user)}</span>
        <span class="summary-pill">${template.logMode === "set-by-set" ? "Phone logs each set" : "Phone logs block completion"}</span>
      </div>

      <label class="field">
        <span>Exercise notes</span>
        <textarea data-exercise-id="${exercise.id}" data-exercise-field="notes" rows="2">${escapeHtml(exercise.notes || "")}</textarea>
      </label>

      <button class="mini-button" data-action="add-set" data-exercise-id="${exercise.id}" type="button">Add another set</button>
    </article>
  `;
}

function renderCardioCard(exercise, index) {
  const user = getActiveUser();
  return `
    <article class="exercise-card cardio">
      <div class="exercise-top">
        <div>
          <p class="eyebrow">Cardio Block ${index + 1}</p>
          <h3>${escapeHtml(exercise.name)}</h3>
        </div>
        <div class="exercise-actions">
          <button class="mini-button" data-action="move-up" data-exercise-id="${exercise.id}" type="button">Up</button>
          <button class="mini-button" data-action="move-down" data-exercise-id="${exercise.id}" type="button">Down</button>
          <button class="mini-button danger-button" data-action="delete-exercise" data-exercise-id="${exercise.id}" type="button">Delete</button>
        </div>
      </div>

      <div class="exercise-meta">
        <label class="field">
          <span>Name</span>
          <input data-exercise-id="${exercise.id}" data-cardio-field="name" type="text" value="${escapeHtml(exercise.name)}">
        </label>
        <label class="field">
          <span>Time (minutes)</span>
          <input data-exercise-id="${exercise.id}" data-cardio-field="targetTime" type="number" min="0" step="1" value="${exercise.targetTime}">
        </label>
        <label class="field">
          <span>Distance (${getDistanceUnit(user)})</span>
          <input data-exercise-id="${exercise.id}" data-cardio-field="targetDistance" type="number" min="0" step="0.1" value="${formatEditableDistance(exercise.targetDistance, user)}">
        </label>
        <label class="field">
          <span>Difficulty</span>
          <input data-exercise-id="${exercise.id}" data-cardio-field="targetDifficulty" type="number" min="1" max="10" step="0.5" value="${exercise.targetDifficulty}">
        </label>
      </div>

      <div class="exercise-summary">
        <span class="summary-pill">${exercise.targetTime} min</span>
        <span class="summary-pill">${formatDistance(exercise.targetDistance, user)}</span>
        <span class="summary-pill">Difficulty ${exercise.targetDifficulty}/10</span>
      </div>

      <label class="field">
        <span>Cardio notes</span>
        <textarea data-exercise-id="${exercise.id}" data-cardio-field="notes" rows="2">${escapeHtml(exercise.notes || "")}</textarea>
      </label>
    </article>
  `;
}

function renderCalendar() {
  const anchor = parseIsoDate(state.ui.calendarAnchor);
  const currentMonth = anchor.getMonth();
  const currentYear = anchor.getFullYear();
  const monthName = anchor.toLocaleString(undefined, { month: "long", year: "numeric" });
  const sessionsByDate = getSessionsByDate(getActiveUser().sessions);
  const firstVisible = new Date(currentYear, currentMonth, 1 - new Date(currentYear, currentMonth, 1).getDay());

  ui.calendarHeading.textContent = monthName;
  ui.calendarDays.innerHTML = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstVisible);
    date.setDate(firstVisible.getDate() + index);
    const iso = formatIsoDate(date);
    const isCurrentMonth = date.getMonth() === currentMonth;
    const sessions = sessionsByDate.get(iso) || [];
    const isSelected = iso === state.ui.selectedDate;
    return `
      <button class="calendar-day ${isCurrentMonth ? "" : "is-muted"} ${sessions.length ? "has-session" : ""} ${isSelected ? "is-selected" : ""}" data-action="calendar-date" data-date="${iso}" type="button">
        <div class="calendar-topline">
          <span>${date.getDate()}</span>
          ${sessions.length ? `<span class="calendar-count">${sessions.length}</span>` : ""}
        </div>
        <div class="calendar-session-list">
          ${sessions
            .slice(0, 2)
            .map((session) => `<span class="calendar-label">${escapeHtml(session.workoutName)}</span>`)
            .join("")}
        </div>
      </button>
    `;
  }).join("");
}

function renderSelectedDate() {
  const user = getActiveUser();
  ui.selectedDateLabel.textContent = formatLongDate(state.ui.selectedDate);
  const sessions = user.sessions.filter((session) => session.date === state.ui.selectedDate).sort(sortSessionsDesc);

  if (!sessions.length) {
    ui.selectedDayContent.innerHTML = `<p class="empty-copy">No training logged on this date yet. Once you save a session from the phone flow, the workout details will appear here.</p>`;
    return;
  }

  ui.selectedDayContent.innerHTML = sessions
    .map((session) => {
      const totalVolume = session.exerciseResults.reduce((sum, exercise) => {
        if (exercise.type !== "strength") {
          return sum;
        }
        return sum + exercise.sets.reduce((inner, set) => inner + set.weight * set.reps, 0);
      }, 0);
      return `
        <article class="day-session-card">
          <header>
            <div>
              <h3>${escapeHtml(session.workoutName)}</h3>
              <p>${escapeHtml(session.startedAt)} to ${escapeHtml(session.completedAt)}</p>
            </div>
            <span class="summary-pill">${formatVolume(totalVolume, user)} total volume</span>
          </header>
          <div class="session-blocks">
            ${session.exerciseResults
              .map((exercise) => {
                if (exercise.type === "strength") {
                  const summary = summarizeStrengthExercise(exercise.sets, "actual");
                  return `
                    <div class="session-block">
                      <strong>${escapeHtml(exercise.name)}</strong>
                      <p>Top set ${formatWeightValue(summary.topSet.weight, user)} x ${formatNumber(summary.topSet.reps)} at RPE ${summary.topSet.rpe}</p>
                      <p>Estimated 1RM ${formatWeight(summary.estimatedOneRm, user)} · Volume ${formatVolume(summary.volume, user)}</p>
                    </div>
                  `;
                }
                return `
                  <div class="session-block">
                    <strong>${escapeHtml(exercise.name)}</strong>
                    <p>${exercise.loggedTime} min · ${formatDistance(exercise.loggedDistance, user)} · Difficulty ${exercise.loggedDifficulty}/10</p>
                    <p>${escapeHtml(exercise.notes || "Cardio block completed.")}</p>
                  </div>
                `;
              })
              .join("")}
          </div>
        </article>
      `;
    })
    .join("");
}

function renderMobile() {
  const user = getActiveUser();
  const template = getActiveTemplate();

  if (!template) {
    ui.mobileWorkoutName.textContent = "No workout selected";
    ui.mobileWorkoutSummary.textContent = "Create a template on desktop first, then the iPhone flow will guide you through it.";
    ui.mobileStepLabel.textContent = "No active session yet.";
    ui.mobileProgressBar.style.width = "0%";
    ui.mobileStepCard.className = "mobile-step-card empty-state";
    ui.mobileStepCard.innerHTML = `<p class="empty-copy">The phone interface stays intentionally simple. Build the workout up above, then tap "Start or resume today's workout".</p>`;
    return;
  }

  const draft = getDraftForUser(user);
  const totalBlocks = template.exercises.length;
  const completedBlocks = draft ? getCompletedBlockCount(template, draft) : 0;
  const activeExerciseIndex = Math.min(state.ui.mobileExerciseIndex, Math.max(totalBlocks - 1, 0));
  state.ui.mobileExerciseIndex = activeExerciseIndex;
  const exercise = template.exercises[activeExerciseIndex];
  const progress = totalBlocks ? (completedBlocks / totalBlocks) * 100 : 0;

  ui.mobileWorkoutName.textContent = template.name;
  ui.mobileWorkoutSummary.textContent = template.notes || "Simple logging flow for training day execution.";
  ui.mobileProgressBar.style.width = `${Math.max(progress, draft ? 8 : 0)}%`;
  ui.mobileStepLabel.textContent = draft
    ? `Step ${activeExerciseIndex + 1} of ${totalBlocks} · ${completedBlocks} completed`
    : "Tap the button above to start a session for today.";

  if (!draft) {
    ui.mobileStepCard.className = "mobile-step-card empty-state";
    ui.mobileStepCard.innerHTML = `
      <div>
        <h3>${escapeHtml(template.name)}</h3>
        <p class="section-note">Phone mode only shows the next block to do, not the whole spreadsheet. That keeps logging fast during the workout.</p>
      </div>
    `;
    return;
  }

  ui.mobileStepCard.className = "mobile-step-card";
  ui.mobileStepCard.innerHTML = exercise.type === "strength"
    ? renderMobileStrengthCard(exercise, draft, template)
    : renderMobileCardioCard(exercise, draft);
}

function renderMobileStrengthCard(exercise, draft, template) {
  const user = getActiveUser();
  const result = draft.exerciseResults.find((item) => item.exerciseId === exercise.id);
  const loggedSetCount = result ? result.sets.length : 0;
  const nextSet = exercise.sets[Math.min(loggedSetCount, exercise.sets.length - 1)];
  const isComplete = loggedSetCount >= exercise.sets.length || (template.logMode === "workout-complete" && result && result.completed);

  if (isComplete) {
    return `
      <div>
        <p class="eyebrow">Completed block</p>
        <h3>${escapeHtml(exercise.name)}</h3>
        <p class="section-note">This exercise is already logged in the current session. Use Next to move on or save the whole workout once all blocks are done.</p>
      </div>
      <div class="mobile-metrics">
        <span class="phone-chip">${exercise.repRange} reps</span>
        <span class="phone-chip">${loggedSetCount} sets logged</span>
      </div>
    `;
  }

  if (template.logMode === "workout-complete") {
    return `
      <div>
        <p class="eyebrow">Workout-level block</p>
        <h3>${escapeHtml(exercise.name)}</h3>
        <p class="section-note">This template only asks the athlete to mark the block complete instead of entering every set.</p>
      </div>
      <div class="mobile-metrics">
        <span class="phone-chip">${exercise.repRange} target range</span>
        <span class="phone-chip">${exercise.sets.length} planned sets</span>
        <span class="phone-chip">${exercise.progressionStyle}</span>
      </div>
      <div class="field">
        <span>Quick note</span>
        <textarea id="mobile-notes-input" rows="3" placeholder="How did the block feel?"></textarea>
      </div>
    `;
  }

  return `
    <div>
      <p class="eyebrow">Current block</p>
      <h3>${escapeHtml(exercise.name)}</h3>
      <p class="section-note">Planned set ${loggedSetCount + 1} of ${exercise.sets.length}. Adjust the numbers if the athlete actually did something different.</p>
    </div>
    <div class="mobile-metrics">
      <span class="phone-chip">${exercise.repRange} range</span>
      <span class="phone-chip">Logged ${loggedSetCount}/${exercise.sets.length} sets</span>
      <span class="phone-chip">${exercise.progressionStyle}</span>
    </div>
    <div class="inline-fields">
      <label class="field">
        <span>Weight (${getWeightUnit(user)})</span>
        <input id="mobile-weight-input" type="number" min="0" step="0.5" value="${formatEditableWeight(nextSet.plannedWeight, user)}">
      </label>
      <label class="field">
        <span>Reps</span>
        <input id="mobile-reps-input" type="number" min="0" step="0.5" value="${nextSet.plannedReps}">
      </label>
      <label class="field">
        <span>RPE</span>
        <input id="mobile-rpe-input" type="number" min="1" max="10" step="0.5" value="${nextSet.plannedRpe}">
      </label>
    </div>
  `;
}

function renderMobileCardioCard(exercise, draft) {
  const user = getActiveUser();
  const existing = draft.exerciseResults.find((item) => item.exerciseId === exercise.id);
  if (existing && existing.completed) {
    return `
      <div>
        <p class="eyebrow">Completed block</p>
        <h3>${escapeHtml(exercise.name)}</h3>
        <p class="section-note">Cardio is logged for this workout. Move to the next block or finish the session.</p>
      </div>
      <div class="mobile-metrics">
        <span class="phone-chip">${existing.loggedTime} min</span>
        <span class="phone-chip">${formatDistance(existing.loggedDistance, user)}</span>
        <span class="phone-chip">Difficulty ${existing.loggedDifficulty}/10</span>
      </div>
    `;
  }

  return `
    <div>
      <p class="eyebrow">Cardio block</p>
      <h3>${escapeHtml(exercise.name)}</h3>
      <p class="section-note">Time, distance, and difficulty can all be tracked on the phone with quick edits before saving.</p>
    </div>
    <div class="mobile-metrics">
      <span class="phone-chip">${exercise.targetTime} min target</span>
      <span class="phone-chip">${formatDistance(exercise.targetDistance, user)} target</span>
      <span class="phone-chip">Difficulty ${exercise.targetDifficulty}/10</span>
    </div>
    <div class="inline-fields">
      <label class="field">
        <span>Time</span>
        <input id="mobile-time-input" type="number" min="0" step="1" value="${exercise.targetTime}">
      </label>
      <label class="field">
        <span>Distance (${getDistanceUnit(user)})</span>
        <input id="mobile-distance-input" type="number" min="0" step="0.1" value="${formatEditableDistance(exercise.targetDistance, user)}">
      </label>
      <label class="field">
        <span>Difficulty</span>
        <input id="mobile-difficulty-input" type="number" min="1" max="10" step="0.5" value="${exercise.targetDifficulty}">
      </label>
    </div>
    <label class="field">
      <span>Notes</span>
      <textarea id="mobile-notes-input" rows="3" placeholder="Pace notes or cardio feel">${escapeHtml(exercise.notes || "")}</textarea>
    </label>
  `;
}

function renderSessionHistory() {
  const user = getActiveUser();
  const sessions = [...user.sessions].sort(sortSessionsDesc).slice(0, 5);
  if (!sessions.length) {
    ui.sessionHistoryList.innerHTML = `<p class="empty-copy">No session history yet.</p>`;
    return;
  }

  ui.sessionHistoryList.innerHTML = sessions
    .map((session) => {
      const totalVolume = session.exerciseResults.reduce((sum, exercise) => {
        if (exercise.type !== "strength") {
          return sum;
        }
        return sum + exercise.sets.reduce((inner, set) => inner + set.weight * set.reps, 0);
      }, 0);
      return `
        <article class="history-card">
          <strong>${escapeHtml(session.workoutName)}</strong>
          <p>${formatLongDate(session.date)} · ${escapeHtml(session.startedAt)}</p>
          <span class="history-tag">${formatVolume(totalVolume, user)} volume</span>
        </article>
      `;
    })
    .join("");
}

function logCurrentMobileStep() {
  const user = getActiveUser();
  const template = getActiveTemplate();
  if (!template || !template.exercises.length) {
    return;
  }

  const draft = getDraftForUser(user) || createDraft(user, template.id);
  const exercise = template.exercises[state.ui.mobileExerciseIndex];
  if (!exercise) {
    return;
  }

  let result = draft.exerciseResults.find((item) => item.exerciseId === exercise.id);
  if (!result) {
    result = {
      exerciseId: exercise.id,
      name: exercise.name,
      type: exercise.type,
      repRange: exercise.repRange || "",
      sets: [],
      completed: false,
      notes: "",
    };
    draft.exerciseResults.push(result);
  }

  if (exercise.type === "strength") {
    if (template.logMode === "workout-complete") {
      result.sets = exercise.sets.map((set) => ({
        weight: set.plannedWeight,
        reps: set.plannedReps,
        rpe: set.plannedRpe,
      }));
      result.completed = true;
      result.notes = document.querySelector("#mobile-notes-input")?.value.trim() || "";
      advanceMobileExercise(template);
    } else {
      const nextSetIndex = result.sets.length;
      if (nextSetIndex >= exercise.sets.length) {
        advanceMobileExercise(template);
        completeSessionIfReady(user, template, draft);
        return;
      }
      const weightInput = document.querySelector("#mobile-weight-input");
      const weight = Number(weightInput?.value ?? formatEditableWeight(exercise.sets[nextSetIndex].plannedWeight));
      const canonicalWeight = convertWeightToCanonical(weight);
      const reps = Number(document.querySelector("#mobile-reps-input")?.value || exercise.sets[nextSetIndex].plannedReps);
      const rpe = Number(document.querySelector("#mobile-rpe-input")?.value || exercise.sets[nextSetIndex].plannedRpe);
      result.sets.push({ weight: canonicalWeight, reps, rpe });
      result.completed = result.sets.length >= exercise.sets.length;
      if (result.completed) {
        advanceMobileExercise(template);
      }
    }
  } else {
    result.loggedTime = Number(document.querySelector("#mobile-time-input")?.value || exercise.targetTime);
    const distanceInput = document.querySelector("#mobile-distance-input");
    result.loggedDistance = convertDistanceToCanonical(
      Number(distanceInput?.value ?? formatEditableDistance(exercise.targetDistance))
    );
    result.loggedDifficulty = Number(document.querySelector("#mobile-difficulty-input")?.value || exercise.targetDifficulty);
    result.notes = document.querySelector("#mobile-notes-input")?.value.trim() || exercise.notes || "";
    result.completed = true;
    advanceMobileExercise(template);
  }

  completeSessionIfReady(user, template, draft);
}

function startOrResumeDraft() {
  const user = getActiveUser();
  const template = getActiveTemplate();
  if (!template) {
    return;
  }
  const draft = getDraftForUser(user);
  if (draft && draft.templateId === template.id && draft.date === todayIso) {
    return;
  }
  createDraft(user, template.id);
  state.ui.mobileExerciseIndex = 0;
}

function createDraft(user, templateId) {
  user.draft = {
    id: createId("draft"),
    templateId,
    date: todayIso,
    startedAt: formatTime(new Date()),
    exerciseResults: [],
  };
  return user.draft;
}

function completeSessionIfReady(user, template, draft) {
  const allComplete = template.exercises.every((exercise) => {
    const result = draft.exerciseResults.find((item) => item.exerciseId === exercise.id);
    return result && result.completed;
  });

  if (!allComplete) {
    return;
  }

  const session = {
    id: createId("session"),
    templateId: template.id,
    workoutName: template.name,
    date: draft.date,
    startedAt: draft.startedAt,
    completedAt: formatTime(new Date()),
    logMode: template.logMode,
    notes: template.notes || "",
    exerciseResults: draft.exerciseResults.map((result) => deepClone(result)),
  };

  user.sessions.unshift(session);
  user.draft = null;
  state.ui.selectedDate = session.date;
  state.ui.mobileExerciseIndex = 0;
}

function advanceMobileExercise(template) {
  state.ui.mobileExerciseIndex = Math.min(template.exercises.length - 1, state.ui.mobileExerciseIndex + 1);
}

function createRecommendation(exercise, sessions) {
  const user = getActiveUser();
  const latest = [...sessions]
    .sort(sortSessionsDesc)
    .flatMap((session) => session.exerciseResults)
    .find((result) => result.exerciseId === exercise.id && result.type === "strength");

  if (!latest || !latest.sets.length) {
    return {
      exerciseName: exercise.name,
      reason: "No saved session yet for this lift. Once it is logged, the next progression call can use top set, reps hit, and RPE drift.",
      badge: "Waiting",
      type: "hold",
      target: formatWeight(exercise.sets[0]?.plannedWeight || 0, user),
      confidence: "Low",
    };
  }

  const plannedTopSet = summarizeStrengthExercise(exercise.sets, "planned").topSet;
  const actualTopSet = summarizeStrengthExercise(latest.sets, "actual").topSet;
  const averageRpe = latest.sets.reduce((sum, set) => sum + set.rpe, 0) / latest.sets.length;
  const targetRepsMet = actualTopSet.reps >= plannedTopSet.reps;
  const baseIncrement = getDynamicWeightIncrement(actualTopSet.weight, user);

  if (exercise.progressionStyle === "rep-first" && targetRepsMet && averageRpe <= plannedTopSet.rpe + 0.5) {
    return {
      exerciseName: exercise.name,
      reason: "Reps were met with manageable effort, so the next progression should chase one more rep before adding load.",
      badge: "+1 rep",
      type: "reps",
      target: `${formatWeightValue(actualTopSet.weight, user)} x ${actualTopSet.reps + 1}`,
      confidence: "Medium",
    };
  }

  if (targetRepsMet && averageRpe <= plannedTopSet.rpe) {
    return {
      exerciseName: exercise.name,
      reason: "The top set hit the goal reps at or below target RPE, which usually means the next session can add weight safely.",
      badge: `+${formatWeightValue(baseIncrement, user)}`,
      type: "weight-first",
      target: `${formatWeightValue(actualTopSet.weight + baseIncrement, user)} x ${plannedTopSet.reps}`,
      confidence: "High",
    };
  }

  if (averageRpe >= 9.5) {
    return {
      exerciseName: exercise.name,
      reason: "The last session was already close to an all-out effort, so the best call is to hold or slightly back off before pushing load again.",
      badge: "Hold",
      type: "hold",
      target: `${formatWeightValue(actualTopSet.weight, user)} and cleaner reps`,
      confidence: "High",
    };
  }

  return {
    exerciseName: exercise.name,
    reason: "The lift is close to progressing, but the log suggests repeating the load and smoothing out execution before adding weight.",
    badge: "Repeat",
    type: "weight-first",
    target: `${formatWeightValue(actualTopSet.weight, user)} x ${plannedTopSet.reps + 1}`,
    confidence: "Medium",
  };
}

function getCompletedBlockCount(template, draft) {
  return template.exercises.reduce((count, exercise) => {
    const result = draft.exerciseResults.find((item) => item.exerciseId === exercise.id);
    return count + (result && result.completed ? 1 : 0);
  }, 0);
}

function getDraftForUser(user) {
  if (!user.draft) {
    return null;
  }
  return user.draft.templateId === user.selectedTemplateId ? user.draft : null;
}

function getSessionsByDate(sessions) {
  const map = new Map();
  sessions.forEach((session) => {
    if (!map.has(session.date)) {
      map.set(session.date, []);
    }
    map.get(session.date).push(session);
  });
  return map;
}

function getRecentWorkoutStreak(sessions) {
  if (!sessions.length) {
    return 0;
  }
  let streak = 1;
  for (let index = 1; index < sessions.length; index += 1) {
    const previous = parseIsoDate(sessions[index - 1].date);
    const current = parseIsoDate(sessions[index].date);
    const difference = Math.abs(previous - current) / (1000 * 60 * 60 * 24);
    if (difference <= 4) {
      streak += 1;
      continue;
    }
    break;
  }
  return streak;
}

function getLatestMeasurementDelta(measurements, user = getActiveUser()) {
  if (measurements.length < 2) {
    return "Steady";
  }
  const sorted = [...measurements].sort((left, right) => new Date(left.date) - new Date(right.date));
  const latest = sorted[sorted.length - 1];
  const previous = sorted[sorted.length - 2];
  const change = latest.bodyWeight - previous.bodyWeight;
  if (Math.abs(change) < 0.01) {
    return "Weight stable";
  }
  const converted = convertWeightForDisplay(Math.abs(change), user);
  return `${change > 0 ? "+" : "-"}${formatNumberWithPrecision(converted, 1)} ${getWeightUnit(user)}`;
}

function summarizeStrengthExercise(sets, mode) {
  const mapped = sets.map((set) => ({
    weight: mode === "planned" ? set.plannedWeight : set.weight,
    reps: mode === "planned" ? set.plannedReps : set.reps,
    rpe: mode === "planned" ? set.plannedRpe : set.rpe,
  }));
  const volume = mapped.reduce((sum, set) => sum + set.weight * set.reps, 0);
  const topSet = mapped.reduce((best, set) => {
    const currentOneRm = estimateOneRm(set.weight, set.reps);
    const bestOneRm = estimateOneRm(best.weight, best.reps);
    return currentOneRm > bestOneRm ? set : best;
  }, mapped[0] || { weight: 0, reps: 0, rpe: 0 });
  const estimatedOneRm = estimateOneRm(topSet.weight, topSet.reps);
  return { volume, topSet, estimatedOneRm };
}

function estimateOneRm(weight, reps) {
  if (!weight || !reps) {
    return 0;
  }
  return weight * (1 + reps / 30);
}

function getDynamicWeightIncrement(weight, user = getActiveUser()) {
  const unit = getWeightUnit(user);
  const displayWeight = convertWeightForDisplay(weight, user);
  const floor = unit === "kg" ? 0.5 : 1;
  const step = unit === "kg" ? 0.5 : 2.5;
  const suggestedDisplayIncrement = Math.max(floor, displayWeight * 0.025);
  const roundedDisplayIncrement = roundToStep(suggestedDisplayIncrement, step);
  return convertWeightToCanonical(roundedDisplayIncrement, user);
}

function getActiveUser() {
  return state.users.find((user) => user.id === state.ui.activeUserId);
}

function getActiveTemplate() {
  const user = getActiveUser();
  return user.programs.find((program) => program.id === user.selectedTemplateId);
}

function ensureStateShape() {
  if (!state.ui) {
    state.ui = {};
  }
  state.ui.activeUserId = state.ui.activeUserId || state.users[0].id;
  state.ui.selectedDate = state.ui.selectedDate || todayIso;
  state.ui.activeView = state.ui.activeView || (window.matchMedia("(max-width: 860px)").matches ? "mobile-panel" : "overview-panel");
  state.ui.mobileExerciseIndex = Number.isFinite(state.ui.mobileExerciseIndex) ? state.ui.mobileExerciseIndex : 0;
  state.ui.calendarAnchor = state.ui.calendarAnchor || todayIso;

  state.users.forEach((user) => {
    user.selectedTemplateId = user.selectedTemplateId || user.programs[0]?.id || "";
    user.programs = user.programs || [];
    user.sessions = user.sessions || [];
    user.measurements = user.measurements || [];
    user.preferences = user.preferences || { weightUnit: "lb", distanceUnit: "mi" };
  });
}

function setActiveView(viewId) {
  state.ui.activeView = viewId;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createSeedState();
    }
    return JSON.parse(raw);
  } catch (error) {
    return createSeedState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function createSeedState() {
  const upperPush = createTemplate({
    id: "template-upper-push",
    name: "Upper Push A",
    focus: "Barbell pressing with hypertrophy accessories",
    logMode: "set-by-set",
    notes: "Pause the first rep on incline bench. Keep the phone flow simple and hit Save after each set.",
    exercises: [
      createStrengthExercise({
        id: "exercise-incline-bench",
        name: "Incline Barbell Bench",
        repRange: "6-8",
        movementTag: "upper-barbell",
        progressionStyle: "weight-first",
        notes: "Use the screenshot table logic for top set and volume tracking.",
        sets: [
          { plannedWeight: 135, plannedReps: 8, plannedRpe: 5 },
          { plannedWeight: 155, plannedReps: 8, plannedRpe: 7 },
          { plannedWeight: 185, plannedReps: 5, plannedRpe: 9 },
          { plannedWeight: 185, plannedReps: 4, plannedRpe: 8 },
        ],
      }),
      createStrengthExercise({
        id: "exercise-flat-db-bench",
        name: "Flat Dumbbell Bench Press",
        repRange: "8-10",
        movementTag: "upper-dumbbell",
        progressionStyle: "rep-first",
        sets: [
          { plannedWeight: 80, plannedReps: 10, plannedRpe: 8 },
          { plannedWeight: 80, plannedReps: 10, plannedRpe: 7 },
          { plannedWeight: 80, plannedReps: 10, plannedRpe: 9 },
        ],
      }),
      createStrengthExercise({
        id: "exercise-db-shoulder",
        name: "DB Shoulder Press",
        repRange: "8-10",
        movementTag: "upper-dumbbell",
        progressionStyle: "weight-first",
        sets: [
          { plannedWeight: 50, plannedReps: 10, plannedRpe: 8 },
          { plannedWeight: 50, plannedReps: 10, plannedRpe: 8 },
          { plannedWeight: 55, plannedReps: 7, plannedRpe: 10 },
        ],
      }),
      createCardioExercise({
        id: "exercise-row-finisher",
        name: "Row Erg Finisher",
        targetTime: 12,
        targetDistance: 2.4,
        targetDifficulty: 6,
        notes: "Stay smooth and breathe through the nose for the first six minutes.",
      }),
    ],
  });

  const lowerPull = createTemplate({
    id: "template-lower-pull",
    name: "Lower Pull B",
    focus: "Posterior chain and aerobic conditioning",
    logMode: "workout-complete",
    notes: "This block is built for faster phone logging on lower-body days.",
    exercises: [
      createStrengthExercise({
        id: "exercise-rdl",
        name: "Romanian Deadlift",
        repRange: "6-8",
        movementTag: "lower-barbell",
        progressionStyle: "weight-first",
        sets: [
          { plannedWeight: 225, plannedReps: 8, plannedRpe: 7 },
          { plannedWeight: 245, plannedReps: 8, plannedRpe: 8 },
          { plannedWeight: 265, plannedReps: 6, plannedRpe: 9 },
        ],
      }),
      createStrengthExercise({
        id: "exercise-leg-curl",
        name: "Seated Leg Curl",
        repRange: "10-12",
        movementTag: "machine",
        progressionStyle: "rep-first",
        sets: [
          { plannedWeight: 95, plannedReps: 12, plannedRpe: 7 },
          { plannedWeight: 95, plannedReps: 12, plannedRpe: 8 },
          { plannedWeight: 100, plannedReps: 10, plannedRpe: 9 },
        ],
      }),
      createCardioExercise({
        id: "exercise-assault-bike",
        name: "Assault Bike Intervals",
        targetTime: 15,
        targetDistance: 4.2,
        targetDifficulty: 8,
        notes: "Five hard pushes with easy spin between efforts.",
      }),
    ],
  });

  const friendPush = createTemplate({
    id: "template-friend-push",
    name: "Maya Push Day",
    focus: "Beginner-friendly upper body with simple progression",
    logMode: "set-by-set",
    notes: "Keep movements easy to pick from the phone and let the desktop do the planning.",
    exercises: [
      createStrengthExercise({
        id: "exercise-maya-bench",
        name: "Machine Chest Press",
        repRange: "8-12",
        movementTag: "machine",
        progressionStyle: "rep-first",
        sets: [
          { plannedWeight: 60, plannedReps: 12, plannedRpe: 6 },
          { plannedWeight: 70, plannedReps: 10, plannedRpe: 7 },
          { plannedWeight: 70, plannedReps: 10, plannedRpe: 8 },
        ],
      }),
      createStrengthExercise({
        id: "exercise-maya-row",
        name: "Chest Supported Row",
        repRange: "10-12",
        movementTag: "machine",
        progressionStyle: "weight-first",
        sets: [
          { plannedWeight: 55, plannedReps: 12, plannedRpe: 7 },
          { plannedWeight: 60, plannedReps: 12, plannedRpe: 8 },
          { plannedWeight: 65, plannedReps: 10, plannedRpe: 9 },
        ],
      }),
      createCardioExercise({
        id: "exercise-maya-treadmill",
        name: "Treadmill Walk",
        targetTime: 20,
        targetDistance: 1.6,
        targetDifficulty: 5,
        notes: "Incline walk after lifting.",
      }),
    ],
  });

  const threeDaysAgo = addDays(todayIso, -3);
  const oneDayAgo = addDays(todayIso, -1);
  const sixDaysAgo = addDays(todayIso, -6);
  const nineDaysAgo = addDays(todayIso, -9);

  return {
    ui: {
      activeUserId: "jack",
      selectedDate: todayIso,
      activeView: window.matchMedia("(max-width: 860px)").matches ? "mobile-panel" : "overview-panel",
      mobileExerciseIndex: 0,
      calendarAnchor: todayIso,
    },
    users: [
      {
        id: "jack",
        name: "Jack",
        selectedTemplateId: upperPush.id,
        preferences: {
          weightUnit: "lb",
          distanceUnit: "mi",
        },
        programs: [upperPush, lowerPull],
        draft: null,
        measurements: [
          { date: nineDaysAgo, bodyWeight: 201.4 },
          { date: threeDaysAgo, bodyWeight: 200.8 },
        ],
        sessions: [
          {
            id: "session-upper-seed",
            templateId: upperPush.id,
            workoutName: upperPush.name,
            date: oneDayAgo,
            startedAt: "7:05 AM",
            completedAt: "8:02 AM",
            logMode: upperPush.logMode,
            notes: upperPush.notes,
            exerciseResults: [
              {
                exerciseId: "exercise-incline-bench",
                name: "Incline Barbell Bench",
                type: "strength",
                repRange: "6-8",
                sets: [
                  { weight: 135, reps: 8, rpe: 5 },
                  { weight: 155, reps: 8, rpe: 7 },
                  { weight: 185, reps: 5, rpe: 9 },
                  { weight: 185, reps: 4, rpe: 8 },
                ],
                completed: true,
              },
              {
                exerciseId: "exercise-flat-db-bench",
                name: "Flat Dumbbell Bench Press",
                type: "strength",
                repRange: "8-10",
                sets: [
                  { weight: 80, reps: 10, rpe: 8 },
                  { weight: 80, reps: 10, rpe: 7 },
                  { weight: 80, reps: 10, rpe: 9 },
                ],
                completed: true,
              },
              {
                exerciseId: "exercise-db-shoulder",
                name: "DB Shoulder Press",
                type: "strength",
                repRange: "8-10",
                sets: [
                  { weight: 50, reps: 10, rpe: 8 },
                  { weight: 50, reps: 10, rpe: 8 },
                  { weight: 55, reps: 7, rpe: 10 },
                ],
                completed: true,
              },
              {
                exerciseId: "exercise-row-finisher",
                name: "Row Erg Finisher",
                type: "cardio",
                loggedTime: 12,
                loggedDistance: 2.5,
                loggedDifficulty: 6,
                notes: "Easy start, stronger second half.",
                completed: true,
              },
            ],
          },
          {
            id: "session-lower-seed",
            templateId: lowerPull.id,
            workoutName: lowerPull.name,
            date: sixDaysAgo,
            startedAt: "6:40 AM",
            completedAt: "7:32 AM",
            logMode: lowerPull.logMode,
            notes: lowerPull.notes,
            exerciseResults: [
              {
                exerciseId: "exercise-rdl",
                name: "Romanian Deadlift",
                type: "strength",
                repRange: "6-8",
                sets: [
                  { weight: 225, reps: 8, rpe: 7 },
                  { weight: 245, reps: 8, rpe: 8 },
                  { weight: 265, reps: 6, rpe: 9 },
                ],
                completed: true,
              },
              {
                exerciseId: "exercise-leg-curl",
                name: "Seated Leg Curl",
                type: "strength",
                repRange: "10-12",
                sets: [
                  { weight: 95, reps: 12, rpe: 7 },
                  { weight: 95, reps: 12, rpe: 8 },
                  { weight: 100, reps: 10, rpe: 9 },
                ],
                completed: true,
              },
              {
                exerciseId: "exercise-assault-bike",
                name: "Assault Bike Intervals",
                type: "cardio",
                loggedTime: 15,
                loggedDistance: 4.1,
                loggedDifficulty: 8,
                notes: "Last interval slowed off target.",
                completed: true,
              },
            ],
          },
        ],
      },
      {
        id: "maya",
        name: "Maya",
        selectedTemplateId: friendPush.id,
        preferences: {
          weightUnit: "kg",
          distanceUnit: "km",
        },
        programs: [friendPush],
        draft: null,
        measurements: [
          { date: nineDaysAgo, bodyWeight: 144.6 },
          { date: threeDaysAgo, bodyWeight: 145.1 },
        ],
        sessions: [
          {
            id: "session-maya-seed",
            templateId: friendPush.id,
            workoutName: friendPush.name,
            date: threeDaysAgo,
            startedAt: "5:30 PM",
            completedAt: "6:12 PM",
            logMode: friendPush.logMode,
            notes: friendPush.notes,
            exerciseResults: [
              {
                exerciseId: "exercise-maya-bench",
                name: "Machine Chest Press",
                type: "strength",
                repRange: "8-12",
                sets: [
                  { weight: 60, reps: 12, rpe: 6 },
                  { weight: 70, reps: 10, rpe: 7 },
                  { weight: 70, reps: 10, rpe: 8 },
                ],
                completed: true,
              },
              {
                exerciseId: "exercise-maya-row",
                name: "Chest Supported Row",
                type: "strength",
                repRange: "10-12",
                sets: [
                  { weight: 55, reps: 12, rpe: 7 },
                  { weight: 60, reps: 12, rpe: 8 },
                  { weight: 65, reps: 10, rpe: 9 },
                ],
                completed: true,
              },
              {
                exerciseId: "exercise-maya-treadmill",
                name: "Treadmill Walk",
                type: "cardio",
                loggedTime: 20,
                loggedDistance: 1.7,
                loggedDifficulty: 5,
                notes: "Felt easy. Could raise incline next week.",
                completed: true,
              },
            ],
          },
        ],
      },
    ],
  };
}

function createTemplate(overrides) {
  return {
    id: overrides.id || createId("template"),
    name: overrides.name,
    focus: overrides.focus,
    logMode: overrides.logMode,
    notes: overrides.notes || "",
    exercises: overrides.exercises || [],
  };
}

function createStrengthExercise(overrides) {
  return {
    id: overrides.id || createId("exercise"),
    type: "strength",
    name: overrides.name,
    repRange: overrides.repRange,
    movementTag: overrides.movementTag,
    progressionStyle: overrides.progressionStyle,
    sets: overrides.sets || [],
    notes: overrides.notes || "",
  };
}

function createCardioExercise(overrides) {
  return {
    id: overrides.id || createId("exercise"),
    type: "cardio",
    name: overrides.name,
    targetTime: overrides.targetTime,
    targetDistance: overrides.targetDistance,
    targetDifficulty: overrides.targetDifficulty,
    notes: overrides.notes || "",
  };
}

function createId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function addDays(isoDate, dayOffset) {
  const date = parseIsoDate(isoDate);
  date.setDate(date.getDate() + dayOffset);
  return formatIsoDate(date);
}

function shiftMonth(isoDate, monthOffset) {
  const date = parseIsoDate(isoDate);
  date.setMonth(date.getMonth() + monthOffset);
  return formatIsoDate(date);
}

function parseIsoDate(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatLongDate(isoDate) {
  return parseIsoDate(isoDate).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatMonthDay(isoDate) {
  return parseIsoDate(isoDate).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatTime(date) {
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function sortSessionsDesc(left, right) {
  const leftValue = `${left.date} ${left.startedAt}`;
  const rightValue = `${right.date} ${right.startedAt}`;
  return rightValue.localeCompare(leftValue);
}

function formatNumber(value) {
  return Number(value.toFixed(1)).toLocaleString();
}

function formatNumberWithPrecision(value, decimals = 1) {
  return Number(value.toFixed(decimals)).toLocaleString();
}

function getWeightUnit(user = getActiveUser()) {
  return user.preferences?.weightUnit || "lb";
}

function getDistanceUnit(user = getActiveUser()) {
  return user.preferences?.distanceUnit || "mi";
}

function convertWeightForDisplay(value, user = getActiveUser()) {
  return getWeightUnit(user) === "kg" ? value * 0.45359237 : value;
}

function convertWeightToCanonical(value, user = getActiveUser()) {
  return getWeightUnit(user) === "kg" ? value / 0.45359237 : value;
}

function convertDistanceForDisplay(value, user = getActiveUser()) {
  return getDistanceUnit(user) === "km" ? value * 1.609344 : value;
}

function convertDistanceToCanonical(value, user = getActiveUser()) {
  return getDistanceUnit(user) === "km" ? value / 1.609344 : value;
}

function formatWeight(value, user = getActiveUser(), decimals = 1) {
  return `${formatNumberWithPrecision(convertWeightForDisplay(value, user), decimals)} ${getWeightUnit(user)}`;
}

function formatWeightValue(value, user = getActiveUser(), decimals = 1) {
  return `${formatNumberWithPrecision(convertWeightForDisplay(value, user), decimals)} ${getWeightUnit(user)}`;
}

function formatEditableWeight(value, user = getActiveUser()) {
  return formatNumberWithPrecision(convertWeightForDisplay(value, user), 1);
}

function formatDistance(value, user = getActiveUser(), decimals = 1) {
  return `${formatNumberWithPrecision(convertDistanceForDisplay(value, user), decimals)} ${getDistanceUnit(user)}`;
}

function formatEditableDistance(value, user = getActiveUser()) {
  return formatNumberWithPrecision(convertDistanceForDisplay(value, user), 1);
}

function formatVolume(value, user = getActiveUser()) {
  return `${formatNumberWithPrecision(convertWeightForDisplay(value, user), 0)} ${getWeightUnit(user)}`;
}

function roundToStep(value, step) {
  return Math.round(value / step) * step;
}

function isNumericField(field) {
  return ["targetTime", "targetDistance", "targetDifficulty"].includes(field);
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
