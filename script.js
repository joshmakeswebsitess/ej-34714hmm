// ---------- Saving and loading ----------

let storageWarningShown = false;

// Reads something the app saved earlier. Gives back null if the browser won't let it.
function readItem(key) {
  try {
    return localStorage.getItem(key);
  } catch (err) {
    return null;
  }
}

// Reads a saved list. If it's missing or damaged, you get the fallback instead of a blank page.
function loadList(key, fallback = []) {
  try {
    const value = JSON.parse(readItem(key));
    return Array.isArray(value) ? value : fallback;
  } catch (err) {
    return fallback;
  }
}

// Reads something saved as a single object, like a workout in progress.
function loadObject(key) {
  try {
    const value = JSON.parse(readItem(key));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch (err) {
    return null;
  }
}

function warnStorageFull() {
  if (storageWarningShown) return;

  storageWarningShown = true;
  alert('Your browser storage is full, so your latest change could not be saved. Try removing a few photos or images.');
  setTimeout(() => { storageWarningShown = false; }, 10000);
}

// Saves something. Warns (once in a while) instead of crashing when there's no room.
function storeItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    warnStorageFull();
    return false;
  }
}

const drawer = document.getElementById('side-drawer');
const drawerToggle = document.getElementById('drawer-toggle');

drawerToggle.addEventListener('click', () => {
  drawer.classList.toggle('open');
  document.querySelector('.top-bar').classList.toggle('shifted');
});

function closeDrawer() {
  drawer.classList.remove('open');
  document.querySelector('.top-bar').classList.remove('shifted');
}

// Touching anywhere outside the menu closes it
// (a touch event is used because iPhones don't report plain taps on empty areas as clicks)
document.addEventListener('pointerdown', (e) => {
  if (drawer.classList.contains('open') && !e.target.closest('.side-drawer')) closeDrawer();
});

function dateToKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// "Today" follows the time zone of whatever device you're using
function getTodayKey() {
  return dateToKey(new Date());
}

function getCurrentHour() {
  return new Date().getHours();
}

function showView(viewName) {
  document.querySelectorAll('.view').forEach((view) => {
    view.classList.remove('active');
  });

  const target = document.getElementById(`view-${viewName}`);
  if (target) {
    target.classList.add('active');
  }

  if (viewName === 'home') {
    renderHomeSummary();
  }
}

document.querySelectorAll('.nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    showView(btn.dataset.view);
    closeDrawer();
  });
});

document.getElementById('home-link').addEventListener('click', () => {
  showView('home');
  closeDrawer();
  window.scrollTo(0, 0);
});

document.getElementById('back-to-journals').addEventListener('click', () => {
  showView('journal');
});

const newJournalBtn = document.getElementById('add-journal-btn');
const modalOverlay = document.getElementById('modal-overlay');
const modalClose = document.getElementById('modal-close');

newJournalBtn.addEventListener('click', () => {
  editingIndex = null;
  createJournalBtn.textContent = 'Create Journal';
  modalOverlay.classList.add('open');
});

modalClose.addEventListener('click', () => {
  modalOverlay.classList.remove('open');
});

modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) {
    modalOverlay.classList.remove('open');
  }
});

const goalsList = document.getElementById('goals-list');
const addGoalBtn = document.getElementById('add-goal-btn');

addGoalBtn.addEventListener('click', () => {
  const goalRow = document.createElement('div');
  goalRow.className = 'goal-row';

  // A new goal starts as a checkbox goal, so it can't get lost by forgetting to pick a type
  goalRow.dataset.goalType = 'check';

  goalRow.innerHTML = `
    <input type="text" class="goal-input" placeholder="Enter your goal...">
    <button class="goal-type-btn check-type selected">✓</button>
    <button class="goal-type-btn write-type">✎</button>
  `;

  goalsList.appendChild(goalRow);

  const checkBtn = goalRow.querySelector('.check-type');
  const writeBtn = goalRow.querySelector('.write-type');

  checkBtn.addEventListener('click', () => {
    checkBtn.classList.add('selected');
    writeBtn.classList.remove('selected');
    goalRow.dataset.goalType = 'check';
  });

  writeBtn.addEventListener('click', () => {
    writeBtn.classList.add('selected');
    checkBtn.classList.remove('selected');
    goalRow.dataset.goalType = 'write';
  });
});

const removeGoalBtn = document.getElementById('remove-goal-btn');

removeGoalBtn.addEventListener('click', () => {
  const rows = goalsList.querySelectorAll('.goal-row');
  if (rows.length > 0) {
    rows[rows.length - 1].remove();
  }
});

const journalNameInput = document.getElementById('journal-name');
const createJournalBtn = document.getElementById('create-journal-btn');
const journalView = document.getElementById('journal-view');

let journals = loadList('ezjournal-journals');
let currentViewDate = getTodayKey();
let editingIndex = null;
let currentJournal = null;


// ---------- Goal IDs ----------
// Every goal has its own permanent ID, and each day's answers are saved under that ID.
// That way deleting, renaming, or adding a goal never moves another goal's history.

let goalIdCounter = 0;

function makeGoalId() {
  goalIdCounter += 1;
  return `g${Date.now().toString(36)}${goalIdCounter}${Math.random().toString(36).slice(2, 5)}`;
}

// Gives older journals their goal IDs and moves each day's saved answers over to them.
// Before changing anything, the old version is kept as a backup in the browser.
function giveGoalsIds() {
  const needsIds = journals.some((journal) => (
    Array.isArray(journal.goals) && journal.goals.some((goal) => !goal.id)
  ));
  if (!needsIds) return;

  if (readItem('ezjournal-journals-backup-before-ids') === null) {
    storeItem('ezjournal-journals-backup-before-ids', readItem('ezjournal-journals') || JSON.stringify(journals));
  }

  journals.forEach((journal) => {
    if (!Array.isArray(journal.goals)) journal.goals = [];
    if (!journal.entries || typeof journal.entries !== 'object') journal.entries = {};

    const idAtPosition = journal.goals.map((goal) => {
      if (!goal.id) goal.id = makeGoalId();
      return goal.id;
    });

    Object.values(journal.entries).forEach((entry) => {
      if (!entry || typeof entry !== 'object') return;

      Object.keys(entry).forEach((key) => {
        if (!/^\d+$/.test(key)) return; // calories and water keep their own names

        // An answer with no goal at that position is kept, but set aside
        const newKey = idAtPosition[Number(key)] || `old-${key}`;
        entry[newKey] = entry[key];
        delete entry[key];
      });
    });
  });

  storeItem('ezjournal-journals', JSON.stringify(journals));
}

giveGoalsIds();

const themes = {
  sage:       { bg: '#DDD5D0', accent: '#7F9183', neutral: '#B8B8AA', text: '#333333' },
  blush:      { bg: '#fddaeb', accent: '#8d4569', neutral: '#D9B8C2', text: '#333333' },
  crimson:    { bg: '#d6d5d5', accent: '#5f0a18', neutral: '#646464', text: '#333333' },
  ember:      { bg: '#dac0a8', accent: '#963e24', neutral: '#350a00', text: '#333333' },
  amethyst:   { bg: '#D8B4E2', accent: '#4f2b64', neutral: '#8a52a3', text: '#2A0A33' },
  forest:     { bg: '#e4e4e4', accent: '#002511', neutral: '#154631', text: '#1A3A24' },
  lagoon:     { bg: '#e1e2c6', accent: '#028090', neutral: '#1A5E63', text: '#1A3A3D' },
  navy:       { bg: '#e0e5f0', accent: '#003366', neutral: '#001233', text: '#333333' },
  monochrome: { bg: '#eeeeee', accent: '#1a1818', neutral: '#808080', text: '#333333' }
};

document.querySelectorAll('.theme-swatch').forEach((swatch) => {
  swatch.addEventListener('click', () => {
    applyTheme(swatch.dataset.theme);
    document.querySelectorAll('.theme-swatch').forEach((s) => s.classList.remove('active'));
    swatch.classList.add('active');

    if (currentJournal) {
      renderJournal(currentJournal);
    }
  });
});

function hexToRgb(hex) {
  const num = parseInt(hex.replace('#', ''), 16);
  return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
}

function darkenColor(hex, amount) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (num >> 16) - amount);
  const g = Math.max(0, ((num >> 8) & 0x00FF) - amount);
  const b = Math.max(0, (num & 0x0000FF) - amount);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function applyTheme(themeName) {
  const theme = themes[themeName] || themes.sage;
  const root = document.documentElement;

  root.style.setProperty('--color-bg', theme.bg);
  root.style.setProperty('--color-accent', theme.accent);
  root.style.setProperty('--color-accent-dark', darkenColor(theme.accent, 30));
  root.style.setProperty('--color-neutral', theme.neutral);
  root.style.setProperty('--color-text', theme.text);
  root.style.setProperty('--color-accent-rgb', hexToRgb(theme.accent));

  storeItem('ezjournal-theme', themeName);
}

function getThemeColors() {
  const root = getComputedStyle(document.documentElement);
  return {
    accent: root.getPropertyValue('--color-accent').trim(),
    neutral: root.getPropertyValue('--color-neutral').trim(),
    bg: root.getPropertyValue('--color-bg').trim()
  };
}

function saveJournals() {
  storeItem('ezjournal-journals', JSON.stringify(journals));
  renderJournalGrid();
  renderHomeSummary();
  updateEmptyState();
  refreshTrackerCharts();
}

function formatDateLabel(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function updateEmptyState() {
  const homeEmpty = document.getElementById('home-empty');
  const homeSummary = document.getElementById('home-summary');
  const hasJournals = journals.length > 0;

  homeEmpty.style.display = hasJournals ? 'none' : 'block';
  homeSummary.style.display = hasJournals ? 'block' : 'none';
}

createJournalBtn.addEventListener('click', () => {
  const name = journalNameInput.value.trim();
  if (!name) {
    alert('Please name your journal.');
    return;
  }

  const trackers = {
    calorie: document.getElementById('calorie-tracker').checked,
    water: document.getElementById('water-tracker').checked,
    weekly: document.getElementById('weekly-tracker').checked,
    monthly: document.getElementById('monthly-tracker').checked
  };

  const goalRows = document.querySelectorAll('.goal-row');
  const goals = [];

  goalRows.forEach((row) => {
    const text = row.querySelector('.goal-input').value.trim();
    const type = row.dataset.goalType;
    if (text && type) {
      // A goal that already existed keeps its ID, so its history stays with it
      goals.push({ id: row.dataset.goalId || makeGoalId(), text, type });
    }
  });

  if (editingIndex !== null) {
    const journal = journals[editingIndex];
    journal.name = name;
    journal.trackers = trackers;
    journal.goals = goals;
    saveJournals();

    if (currentJournal === journal) {
      renderJournal(journal);
    }

    editingIndex = null;
    createJournalBtn.textContent = 'Create Journal';
  } else {
    const journal = { name, trackers, goals, entries: {}, calorieGoal: null };
    journals.push(journal);
    saveJournals();

    currentViewDate = getTodayKey();
    renderJournal(journal);
    showView('journal-detail');
  }

  modalOverlay.classList.remove('open');
  journalNameInput.value = '';
  goalsList.innerHTML = '';
  document.getElementById('calorie-tracker').checked = false;
  document.getElementById('water-tracker').checked = false;
  document.getElementById('weekly-tracker').checked = false;
  document.getElementById('monthly-tracker').checked = false;
});

// ---------- Changing days ----------

let calendarMonth = null;     // the month the calendar is showing (null means the selected day's month)
let calendarWasOpen = false;  // lets the calendar close smoothly after you pick a day

// "Today", "Yesterday", "3 days ago", "In 2 weeks"...
function relativeDayLabel(dateKey) {
  const today = new Date(getTodayKey() + 'T00:00:00');
  const day = new Date(dateKey + 'T00:00:00');
  const diff = Math.round((day - today) / 86400000);

  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  if (diff === 1) return 'Tomorrow';

  const away = Math.abs(diff);
  let text;

  if (away < 14) {
    text = `${away} days`;
  } else if (away < 60) {
    text = `${Math.round(away / 7)} weeks`;
  } else {
    text = `${Math.round(away / 30)} months`;
  }

  return diff < 0 ? `${text} ago` : `In ${text}`;
}

// Changes the day. Earlier days slide in from the left, later days from the right.
function goToDay(journal, dateKey) {
  if (dateKey === currentViewDate) return;

  const direction = dateKey > currentViewDate ? 'forward' : 'back';
  const collapse = document.getElementById('calendar-collapse');

  calendarWasOpen = !!collapse && collapse.classList.contains('open');
  currentViewDate = dateKey;
  renderJournal(journal, direction);
}

function renderJournal(journal, direction) {
  currentJournal = journal;

  // Changing days slides that day's content. Anything else, like opening a journal, fades.
  const sliding = direction === 'forward' || direction === 'back';
  const outClass = direction === 'forward' ? 'slide-out-left' : 'slide-out-right';
  const enterClass = direction === 'forward' ? 'enter-from-right' : 'enter-from-left';

  if (sliding) {
    journalView.querySelectorAll('.day-content, .date-label-wrap').forEach((el) => {
      el.classList.add(outClass);
    });
  } else {
    journalView.classList.add('fading');
  }

  setTimeout(() => {
    const todayKey = getTodayKey();
    journalView.innerHTML = '';

    const title = document.createElement('h2');
    title.textContent = journal.name;
    journalView.appendChild(title);

    // The date, with its tag underneath
    const labelClass = sliding ? `date-label-wrap ${enterClass}` : 'date-label-wrap';

    const dateControls = document.createElement('div');
    dateControls.className = 'date-controls';
    dateControls.innerHTML = `
      <div class="${labelClass}">
        <span class="current-date-label" id="current-date-label"></span>
        <span class="date-tag" id="date-tag"></span>
      </div>
      <button class="calendar-toggle-btn" id="calendar-toggle-btn" title="Pick a day">📅</button>
    `;
    journalView.appendChild(dateControls);

    document.getElementById('current-date-label').textContent = formatDateLabel(currentViewDate);

    const dateTag = document.getElementById('date-tag');
    dateTag.textContent = relativeDayLabel(currentViewDate);
    dateTag.classList.toggle('today', currentViewDate === todayKey);

    // The calendar slides open and closed
    const calendarCollapse = document.createElement('div');
    calendarCollapse.className = 'calendar-collapse';
    calendarCollapse.id = 'calendar-collapse';
    calendarCollapse.innerHTML = '<div class="calendar-slot"><div class="calendar-container" id="calendar-container"></div></div>';
    journalView.appendChild(calendarCollapse);

    document.getElementById('calendar-toggle-btn').addEventListener('click', () => {
      const opening = !calendarCollapse.classList.contains('open');

      calendarCollapse.classList.toggle('open', opening);

      if (opening) {
        calendarMonth = null;
        renderCalendar(journal);
      }
    });

    // After you pick a day, the calendar stays up through the slide, then closes smoothly
    if (calendarWasOpen) {
      calendarWasOpen = false;
      calendarMonth = null;
      calendarCollapse.classList.add('open');
      renderCalendar(journal);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => calendarCollapse.classList.remove('open'));
      });
    }

    // The trackers
    const trackerSection = document.createElement('div');
    trackerSection.className = 'tracker-section';

    if (journal.trackers.calorie) {
      if (journal.calorieGoal === undefined) {
        journal.calorieGoal = null;
      }
      const box = document.createElement('div');
      box.className = 'tracker-box calorie-tracker-box';
      box.id = 'calorie-tracker-box';
      trackerSection.appendChild(box);
      renderCalorieTracker(journal, box);
    }
    if (journal.trackers.water) {
      const box = document.createElement('div');
      box.className = 'tracker-box calorie-tracker-box water-tracker-box';
      trackerSection.appendChild(box);
      renderWaterTracker(journal, box);
    }
    if (journal.trackers.weekly) {
      const box = document.createElement('div');
      box.className = 'tracker-box weekly-tracker-box';
      trackerSection.appendChild(box);
      renderWeeklyTracker(journal, box);
    }
    if (journal.trackers.monthly) {
      const box = document.createElement('div');
      box.className = 'tracker-box monthly-tracker-box';
      trackerSection.appendChild(box);
      renderMonthlyTracker(journal, box);
    }

    // The daily goals
    const goalsSection = document.createElement('div');
    goalsSection.className = 'journal-goals-section';

    const goalsTitle = document.createElement('h3');
    goalsTitle.textContent = 'Daily Goals';
    goalsSection.appendChild(goalsTitle);

    if (!journal.entries[currentViewDate]) {
      journal.entries[currentViewDate] = {};
    }
    const todayEntry = journal.entries[currentViewDate];

    if (journal.goals.length === 0) {
      const emptyMsg = document.createElement('p');
      emptyMsg.className = 'empty-goals-msg';
      emptyMsg.textContent = 'No goals yet — add some by editing this journal in Settings.';
      goalsSection.appendChild(emptyMsg);
    }

    // Goal names and answers are put in as plain text, so quotes and symbols can't break the page
    journal.goals.forEach((goal) => {
      const goalItem = document.createElement('div');
      goalItem.className = 'journal-goal-item';

      if (goal.type === 'check') {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = todayEntry[goal.id] === true;
        checkbox.addEventListener('change', () => {
          todayEntry[goal.id] = checkbox.checked;
          saveJournals();
        });

        goalItem.append(checkbox, makeEl('span', '', goal.text));
      } else {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'goal-fill-input';
        input.value = typeof todayEntry[goal.id] === 'string' ? todayEntry[goal.id] : '';
        input.addEventListener('input', () => {
          todayEntry[goal.id] = input.value;
          saveJournals();
        });

        goalItem.append(makeEl('span', '', `${goal.text}:`), input);
      }

      goalsSection.appendChild(goalItem);
    });

    // Everything that belongs to the day goes in one piece, so it can slide together
    const dayContent = document.createElement('div');
    dayContent.className = sliding ? `day-content ${enterClass}` : 'day-content';

    // A reminder when you're looking at any day other than today
    if (currentViewDate !== todayKey) {
      const isPast = currentViewDate < todayKey;

      const banner = document.createElement('div');
      banner.className = 'day-banner';
      banner.innerHTML = `
        <span>${isPast ? 'Viewing a past day' : 'Viewing a future day'}</span>
        <button class="day-banner-btn" type="button">Back to today ›</button>
      `;
      banner.querySelector('button').addEventListener('click', () => goToDay(journal, todayKey));
      dayContent.appendChild(banner);
    }

    dayContent.appendChild(trackerSection);
    dayContent.appendChild(goalsSection);
    journalView.appendChild(dayContent);

    journalView.classList.remove('fading');
  }, 200);
}

// ---------- Calorie tracker ----------

const BURN_FULL = 500; // calories burned that make the flame full size

// Remembers what was on screen, so the visuals glide from the old numbers to the new ones.
let lastCalorieView = { journal: null, date: '', eatenFrac: 0, burnFrac: 0, barFrac: 1 };

function renderCalorieTracker(journal, box) {
  box.innerHTML = '';

  // First time: set a daily goal
  if (journal.calorieGoal === null) {
    box.innerHTML = `
      <span>Set a daily calorie goal</span>
      <input type="number" id="calorie-goal-input" placeholder="e.g. 2000">
      <button id="set-calorie-goal-btn">Set</button>
    `;

    box.querySelector('#set-calorie-goal-btn').addEventListener('click', () => {
      const input = box.querySelector('#calorie-goal-input');
      const value = parseInt(input.value);
      if (!value || value <= 0) {
        alert('Please enter a valid calorie goal.');
        return;
      }
      journal.calorieGoal = value;
      saveJournals();
      renderCalorieTracker(journal, box);
    });

    return;
  }

  if (!journal.entries[currentViewDate]) {
    journal.entries[currentViewDate] = {};
  }
  const entry = journal.entries[currentViewDate];
  if (entry.calories === undefined) {
    entry.calories = { consumed: 0, burned: 0 };
  }
  if (!Array.isArray(entry.calories.log)) entry.calories.log = [];

  const cal = entry.calories;
  const goal = journal.calorieGoal;
  const eaten = cal.consumed;
  const burned = cal.burned;
  const remaining = goal - eaten + burned;
  const budget = goal + burned; // burning calories gives you more to eat

  // How full each object should be, from 0 to 1
  const eatenFrac = Math.min(eaten / goal, 1);
  const burnFrac = Math.min(burned / BURN_FULL, 1);
  const barFrac = Math.min(Math.max(remaining / budget, 0), 1);

  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const fireSize = (f) => 30 + 40 * f;
  const fireOpacity = (f) => 0.45 + 0.55 * f;
  const barWidth = (f) => Math.max(f * 100, 4);
  const barColor = `hsl(${Math.round(barFrac * 120)}, 72%, 46%)`; // green, yellow, then red as it empties
  const C = 2 * Math.PI * 50; // distance around the donut

  const sameView = lastCalorieView.journal === journal && lastCalorieView.date === currentViewDate;
  const from = sameView ? lastCalorieView : { eatenFrac: 0, burnFrac: 0, barFrac: 1 };

  const remainingText = remaining < 0 ? `Over by ${fmt(-remaining)}` : `${fmt(remaining)} left`;

  box.innerHTML = `
    <div class="cal-visuals">
      <div class="cal-donut">
        <svg viewBox="0 0 120 120" width="120" height="120">
          <circle class="cal-donut-track" cx="60" cy="60" r="50"></circle>
          <circle class="cal-donut-fill${remaining < 0 ? ' over' : ''}" cx="60" cy="60" r="50"
            transform="rotate(-90 60 60)"
            style="stroke-dasharray: ${C}; stroke-dashoffset: ${C * (1 - from.eatenFrac)};"></circle>
        </svg>
        <div class="cal-donut-center">
          <div class="cal-num">${fmt(eaten)}</div>
          <div class="cal-caption">eaten</div>
        </div>
      </div>

      <div class="cal-fire">
        <div class="cal-fire-stage">
          <span class="cal-fire-icon${burned > 0 ? ' lit' : ''}"
            style="font-size: ${fireSize(from.burnFrac)}px; opacity: ${fireOpacity(from.burnFrac)};">🔥</span>
        </div>
        <div class="cal-num">${fmt(burned)}</div>
        <div class="cal-caption">burned</div>
      </div>
    </div>

    <div class="cal-remaining">
      <div class="cal-bar" title="Goal ${fmt(goal)} + ${fmt(burned)} burned − ${fmt(eaten)} eaten">
        <div class="cal-bar-fill" style="width: ${barWidth(from.barFrac)}%; background-color: ${barColor};"></div>
      </div>
      <div class="cal-remaining-label">${remainingText}</div>
      <div class="cal-caption">Daily goal: ${fmt(goal)}</div>
    </div>

    <div class="calorie-inputs">
      <input type="number" id="calorie-consumed-input" min="0" placeholder="Calories eaten">
      <button id="add-consumed-btn">Add</button>
    </div>
    <div class="calorie-inputs">
      <input type="number" id="calorie-burned-input" min="0" placeholder="Calories burned">
      <button id="add-burned-btn">Add</button>
    </div>

    <div class="water-links">
      <button id="cal-undo-btn">↶ Undo last</button>
      <button id="cal-goal-btn">✎ Change goal</button>
    </div>
  `;

  // Let the first frame show the old numbers, then move to the new ones
  const donutFill = box.querySelector('.cal-donut-fill');
  const fireIcon = box.querySelector('.cal-fire-icon');
  const barFill = box.querySelector('.cal-bar-fill');

  function showNewValues() {
    donutFill.style.strokeDashoffset = C * (1 - eatenFrac);
    fireIcon.style.fontSize = `${fireSize(burnFrac)}px`;
    fireIcon.style.opacity = fireOpacity(burnFrac);
    barFill.style.width = `${barWidth(barFrac)}%`;
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    showNewValues();
  } else {
    requestAnimationFrame(() => requestAnimationFrame(showNewValues));
  }

  lastCalorieView = { journal, date: currentViewDate, eatenFrac, burnFrac, barFrac };

  // Adding calories
  function logCalories(type, amount) {
    if (type === 'eaten') {
      cal.consumed += amount;
    } else {
      cal.burned += amount;
    }

    cal.log.push({ type, amount });
    saveJournals();
    renderCalorieTracker(journal, box);
  }

  function addFrom(inputSelector, type) {
    const value = parseInt(box.querySelector(inputSelector).value);
    if (value > 0) logCalories(type, value);
  }

  box.querySelector('#add-consumed-btn').addEventListener('click', () => addFrom('#calorie-consumed-input', 'eaten'));
  box.querySelector('#add-burned-btn').addEventListener('click', () => addFrom('#calorie-burned-input', 'burned'));

  box.querySelector('#calorie-consumed-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addFrom('#calorie-consumed-input', 'eaten');
  });
  box.querySelector('#calorie-burned-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addFrom('#calorie-burned-input', 'burned');
  });

  // Undo takes back your most recent entry, eaten or burned
  const undoBtn = box.querySelector('#cal-undo-btn');
  const lastEntry = cal.log[cal.log.length - 1];

  undoBtn.disabled = !lastEntry;
  undoBtn.title = lastEntry ? `Undo +${fmt(lastEntry.amount)} ${lastEntry.type}` : 'Nothing to undo yet';

  undoBtn.addEventListener('click', () => {
    const last = cal.log.pop();
    if (!last) return;

    if (last.type === 'eaten') {
      cal.consumed = Math.max(0, cal.consumed - last.amount);
    } else {
      cal.burned = Math.max(0, cal.burned - last.amount);
    }

    saveJournals();
    renderCalorieTracker(journal, box);
  });

  box.querySelector('#cal-goal-btn').addEventListener('click', () => {
    const value = parseInt(prompt('Enter new daily calorie goal:', goal));

    if (value > 0) {
      journal.calorieGoal = value;
      saveJournals();
      renderCalorieTracker(journal, box);
    }
  });
}

function renderCalendar(journal) {
  const calendarContainer = document.getElementById('calendar-container');

  // The calendar keeps its own month, so paging through months doesn't change your day
  if (!calendarMonth) {
    const viewDate = new Date(currentViewDate + 'T00:00:00');
    calendarMonth = { year: viewDate.getFullYear(), month: viewDate.getMonth() };
  }

  const { year, month } = calendarMonth;
  const todayKey = getTodayKey();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startWeekday = firstDay.getDay();
  const totalDays = lastDay.getDate();

  const monthLabel = firstDay.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  let html = `
    <div class="calendar-header">
      <button class="cal-nav-btn" id="cal-prev-month">‹</button>
      <span>${monthLabel}</span>
      <button class="cal-nav-btn" id="cal-next-month">›</button>
    </div>
    <div class="calendar-grid">
  `;

  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  dayLabels.forEach((d) => {
    html += `<div class="calendar-day-label">${d}</div>`;
  });

  for (let i = 0; i < startWeekday; i++) {
    html += `<div class="calendar-day empty"></div>`;
  }

  for (let day = 1; day <= totalDays; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isSelected = dateStr === currentViewDate;
    const isToday = dateStr === todayKey;
    const entry = journal.entries[dateStr];
    const hasRealData = entry && (
      journal.goals.some((goal) => entry[goal.id] !== undefined && entry[goal.id] !== '' && entry[goal.id] !== false) ||
      (entry.calories && (entry.calories.consumed > 0 || entry.calories.burned > 0)) ||
      (Array.isArray(entry.water) && entry.water.length > 0)
    );
    const hasEntry = hasRealData ? 'has-entry' : '';
    html += `<div class="calendar-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''} ${hasEntry}" data-date="${dateStr}">${day}</div>`;
  }

  html += `</div>`;
  calendarContainer.innerHTML = html;

  calendarContainer.querySelectorAll('.calendar-day:not(.empty)').forEach((dayEl) => {
    dayEl.addEventListener('click', () => {
      const date = dayEl.dataset.date;

      // Picking the day you're already on just closes the calendar
      if (date === currentViewDate) {
        document.getElementById('calendar-collapse').classList.remove('open');
        return;
      }

      // Light up the new day right away, while the page slides
      calendarContainer.querySelectorAll('.calendar-day.selected').forEach((el) => {
        el.classList.remove('selected');
      });
      dayEl.classList.add('selected');

      goToDay(journal, date);
    });
  });

  document.getElementById('cal-prev-month').addEventListener('click', () => {
    const prev = new Date(year, month - 1, 1);
    calendarMonth = { year: prev.getFullYear(), month: prev.getMonth() };
    renderCalendar(journal);
  });

  document.getElementById('cal-next-month').addEventListener('click', () => {
    const next = new Date(year, month + 1, 1);
    calendarMonth = { year: next.getFullYear(), month: next.getMonth() };
    renderCalendar(journal);
  });
}

const settingsBtn = document.getElementById('settings-btn');
const settingsOverlay = document.getElementById('settings-overlay');
const settingsClose = document.getElementById('settings-close');
const deleteJournalList = document.getElementById('delete-journal-list');

settingsBtn.addEventListener('click', () => {
  renderDeleteList();
  settingsOverlay.classList.add('open');
  closeDrawer();
});

settingsClose.addEventListener('click', () => {
  settingsOverlay.classList.remove('open');
});

settingsOverlay.addEventListener('click', (e) => {
  if (e.target === settingsOverlay) {
    settingsOverlay.classList.remove('open');
  }
});

function renderDeleteList() {
  deleteJournalList.innerHTML = '';

  if (journals.length === 0) {
    deleteJournalList.innerHTML = '<p>No journals yet.</p>';
    return;
  }

  journals.forEach((journal, index) => {
    const row = document.createElement('div');
    row.className = 'delete-journal-row';

    const name = document.createElement('span');
    name.textContent = journal.name;

    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => {
      openEditModal(index);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => {
      const confirmed = confirm(`Are you sure you want to delete "${journal.name}"? This cannot be undone.`);
      if (confirmed) {
        deleteJournal(index);
      }
    });

    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'delete-row-buttons';
    buttonGroup.appendChild(editBtn);
    buttonGroup.appendChild(deleteBtn);

    row.appendChild(name);
    row.appendChild(buttonGroup);
    deleteJournalList.appendChild(row);
  });
}

function openEditModal(index) {
  editingIndex = index;
  const journal = journals[index];

  journalNameInput.value = journal.name;
  document.getElementById('calorie-tracker').checked = journal.trackers.calorie;
  document.getElementById('water-tracker').checked = !!journal.trackers.water;
  document.getElementById('weekly-tracker').checked = journal.trackers.weekly;
  document.getElementById('monthly-tracker').checked = journal.trackers.monthly;

  goalsList.innerHTML = '';
  journal.goals.forEach((goal) => {
    const goalRow = document.createElement('div');
    goalRow.className = 'goal-row';
    goalRow.dataset.goalType = goal.type;
    goalRow.dataset.goalId = goal.id;

    // The goal's name goes in as plain text, so quotes and symbols can't cut it short
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'goal-input';
    input.value = goal.text;

    const checkBtn = makeEl('button', `goal-type-btn check-type${goal.type === 'check' ? ' selected' : ''}`, '✓');
    const writeBtn = makeEl('button', `goal-type-btn write-type${goal.type === 'write' ? ' selected' : ''}`, '✎');

    goalRow.append(input, checkBtn, writeBtn);
    goalsList.appendChild(goalRow);

    checkBtn.addEventListener('click', () => {
      checkBtn.classList.add('selected');
      writeBtn.classList.remove('selected');
      goalRow.dataset.goalType = 'check';
    });

    writeBtn.addEventListener('click', () => {
      writeBtn.classList.add('selected');
      checkBtn.classList.remove('selected');
      goalRow.dataset.goalType = 'write';
    });
  });

  createJournalBtn.textContent = 'Save Changes';
  settingsOverlay.classList.remove('open');
  modalOverlay.classList.add('open');
}

function deleteJournal(index) {
  const deletedJournal = journals[index];
  journals.splice(index, 1);
  saveJournals();

  if (currentJournal === deletedJournal) {
    currentJournal = null;
    journalView.innerHTML = '';
    showView('journal');
  }

  renderDeleteList();
}

function getDayCompletion(journal, dateStr) {
  if (journal.goals.length === 0) return 0;

  const entry = journal.entries[dateStr];
  if (!entry) return 0;

  let completed = 0;
  journal.goals.forEach((goal) => {
    const value = entry[goal.id];

    // A goal that was changed from a checkbox to a written answer can still hold an old true/false,
    // so only real text counts as an answer
    if (goal.type === 'check' && value === true) {
      completed++;
    } else if (goal.type === 'write' && typeof value === 'string' && value.trim() !== '') {
      completed++;
    }
  });

  return completed / journal.goals.length;
}

function renderJournalGrid() {
  const grid = document.getElementById('journal-grid');
  grid.innerHTML = '';

  if (journals.length === 0) {
    grid.innerHTML = '<p class="empty-goals-msg">No journals yet. Click the + to create one.</p>';
    return;
  }

  const todayKey = getTodayKey();

  journals.forEach((journal) => {
    const card = document.createElement('div');
    card.className = 'journal-card';

    const trackerNames = [];
    if (journal.trackers.calorie) trackerNames.push('Calories');
    if (journal.trackers.water) trackerNames.push('Water');
    if (journal.trackers.weekly) trackerNames.push('Weekly');
    if (journal.trackers.monthly) trackerNames.push('Monthly');

    const todayPercent = Math.round(getDayCompletion(journal, todayKey) * 100);
    const goalCount = journal.goals.length;

    card.innerHTML = `
      <div class="journal-card-preview">
        <span class="preview-percent">${todayPercent}%</span>
        <span class="preview-label">done today</span>
        <span class="preview-line">${goalCount} goal${goalCount === 1 ? '' : 's'}</span>
        <span class="preview-line">${trackerNames.length ? trackerNames.join(' · ') : 'No trackers'}</span>
      </div>
      <div class="journal-card-title"></div>
    `;

    card.querySelector('.journal-card-title').textContent = journal.name;

    card.addEventListener('click', () => {
      currentViewDate = getTodayKey();
      renderJournal(journal);
      showView('journal-detail');
    });

    grid.appendChild(card);
  });
}

function renderHomeSummary() {
  const summary = document.getElementById('home-summary');
  summary.innerHTML = '';

  if (journals.length === 0) return;

  const todayKey = getTodayKey();

  let totalGoals = 0;
  let totalDone = 0;
  journals.forEach((journal) => {
    const goals = journal.goals.length;
    totalGoals += goals;
    totalDone += Math.round(getDayCompletion(journal, todayKey) * goals);
  });
  const overall = totalGoals ? Math.round((totalDone / totalGoals) * 100) : 0;

  const hour = getCurrentHour();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  summary.innerHTML = `
    <h2>${greeting}</h2>
    <p class="home-date">${formatDateLabel(todayKey)}</p>
    <div class="home-overall">
      <span class="home-overall-percent">${overall}%</span>
      <span class="home-overall-label">of today's goals done (${totalDone} of ${totalGoals})</span>
    </div>
    <h3 class="home-section-title">Your journals</h3>
    <div class="home-journal-list"></div>
  `;

  const list = summary.querySelector('.home-journal-list');

  journals.forEach((journal) => {
    const percent = Math.round(getDayCompletion(journal, todayKey) * 100);

    const row = document.createElement('div');
    row.className = 'home-journal-row';
    row.innerHTML = `
      <span class="home-journal-name"></span>
      <div class="home-bar"><div class="home-bar-fill" style="width: ${percent}%"></div></div>
      <span class="home-journal-percent">${percent}%</span>
    `;
    row.querySelector('.home-journal-name').textContent = journal.name;

    row.addEventListener('click', () => {
      currentViewDate = todayKey;
      renderJournal(journal);
      showView('journal-detail');
    });

    list.appendChild(row);
  });
}

// ---------- Weekly tracker ----------

// Remembers what was on screen, so the bars glide from the old heights to the new ones.
let weeklyView = { journal: null, date: '', offset: 0, values: [0, 0, 0, 0, 0, 0, 0] };

function formatWeekRange(monday, sunday) {
  const startMonth = monday.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = sunday.toLocaleDateString('en-US', { month: 'short' });

  return startMonth === endMonth
    ? `${startMonth} ${monday.getDate()} – ${sunday.getDate()}`
    : `${startMonth} ${monday.getDate()} – ${endMonth} ${sunday.getDate()}`;
}

function renderWeeklyTracker(journal, box) {
  // A different journal or day starts back on its own week
  const sameView = weeklyView.journal === journal && weeklyView.date === currentViewDate;
  if (!sameView) weeklyView.offset = 0;

  const from = sameView ? weeklyView.values : [0, 0, 0, 0, 0, 0, 0];

  const anchor = new Date(currentViewDate + 'T00:00:00');
  const dayOfWeek = anchor.getDay();
  const offsetToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() - offsetToMonday + weeklyView.offset * 7);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const todayKey = getTodayKey();
  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const values = [];
  let columns = '';

  for (let d = 0; d < 7; d++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + d);

    const key = dateToKey(day);
    const value = getDayCompletion(journal, key);
    values.push(value);

    const label = day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    columns += `
      <div class="week-col${key === todayKey ? ' today' : ''}" title="${label}: ${Math.round(value * 100)}%">
        <div class="week-track">
          <div class="week-fill" style="height: ${from[d] * 100}%;"></div>
        </div>
        <div class="week-day">${dayLabels[d]}</div>
      </div>
    `;
  }

  const away = weeklyView.offset !== 0;

  box.innerHTML = `
    <div class="week-nav">
      <button class="week-arrow" id="week-prev" title="Previous week">‹</button>
      <button class="week-label${away ? ' away' : ''}" id="week-label" title="${away ? 'Back to this week' : ''}">${formatWeekRange(monday, sunday)}</button>
      <button class="week-arrow" id="week-next" title="Next week">›</button>
    </div>
    <div class="week-bars">${columns}</div>
  `;

  // Show the old heights for one frame, then move to the new ones
  const fills = box.querySelectorAll('.week-fill');
  const fresh = !sameView;

  function fillBars() {
    fills.forEach((fill, i) => {
      fill.style.transitionDelay = fresh ? `${i * 60}ms` : '0ms';
      fill.style.height = `${values[i] * 100}%`;
    });
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    fillBars();
  } else {
    requestAnimationFrame(() => requestAnimationFrame(fillBars));
  }

  weeklyView = { journal, date: currentViewDate, offset: weeklyView.offset, values };

  box.querySelector('#week-prev').addEventListener('click', () => {
    weeklyView.offset -= 1;
    renderWeeklyTracker(journal, box);
  });

  box.querySelector('#week-next').addEventListener('click', () => {
    weeklyView.offset += 1;
    renderWeeklyTracker(journal, box);
  });

  box.querySelector('#week-label').addEventListener('click', () => {
    if (weeklyView.offset === 0) return;

    weeklyView.offset = 0;
    renderWeeklyTracker(journal, box);
  });
}

// Redraws the weekly and monthly charts when your goals change.
function refreshTrackerCharts() {
  if (!currentJournal) return;

  const weekly = document.querySelector('.weekly-tracker-box');
  if (weekly) renderWeeklyTracker(currentJournal, weekly);

  const monthly = document.querySelector('.monthly-tracker-box');
  if (monthly) renderMonthlyTracker(currentJournal, monthly);
}

// ---------- Monthly tracker ----------

// Remembers what was on screen, so cells can fade from their old shade to the new one.
let monthlyView = { journal: null, date: '', offset: 0, shown: '', values: {} };

// Everything the summary strip and the grid need for one month.
function monthStats(journal, year, month) {
  const todayKey = getTodayKey();
  const total = new Date(year, month + 1, 0).getDate();
  const hasGoals = journal.goals.length > 0;
  const days = [];

  let counted = 0;
  let sum = 0;
  let perfect = 0;

  for (let d = 1; d <= total; d++) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const future = key > todayKey;
    const value = future ? 0 : getDayCompletion(journal, key);
    days.push({ key, day: d, value, future });

    if (future) continue;

    counted++;
    sum += value;
    if (hasGoals && value >= 1) perfect++;
  }

  return { days, avg: counted ? sum / counted : null, perfect };
}

// The lines shown in a day's hover card.
function dayDetailLines(journal, day) {
  if (day.future) return ['Upcoming day'];

  const entry = journal.entries[day.key];
  const lines = [];
  const goalCount = journal.goals.length;

  if (goalCount > 0) {
    const done = Math.round(day.value * goalCount);
    lines.push(`${done} of ${goalCount} goal${goalCount === 1 ? '' : 's'}`);
  }

  if (journal.trackers.calorie && journal.calorieGoal && entry && entry.calories) {
    const { consumed, burned } = entry.calories;

    if (consumed > 0 || burned > 0) {
      const left = journal.calorieGoal - consumed + burned;
      lines.push(
        left >= 0
          ? `${left.toLocaleString('en-US')} calories left`
          : `${(-left).toLocaleString('en-US')} calories over`
      );
    }
  }

  if (journal.trackers.water && journal.waterGoalMl && entry && Array.isArray(entry.water) && entry.water.length > 0) {
    const unitKey = WATER_UNITS[journal.waterUnit] ? journal.waterUnit : 'oz';
    const drank = entry.water.reduce((sum, ml) => sum + ml, 0);
    lines.push(
      `${formatWater(drank, unitKey)} of ${formatWater(journal.waterGoalMl, unitKey)} ${WATER_UNITS[unitKey].label} water`
    );
  }

  return lines.length ? lines : ['Nothing tracked'];
}

function renderMonthlyTracker(journal, box) {
  // A different journal or day starts back on its own month
  const sameView = monthlyView.journal === journal && monthlyView.date === currentViewDate;
  if (!sameView) monthlyView.offset = 0;

  const anchor = new Date(currentViewDate + 'T00:00:00');
  const shown = new Date(anchor.getFullYear(), anchor.getMonth() + monthlyView.offset, 1);
  const year = shown.getFullYear();
  const month = shown.getMonth();
  const monthKey = `${year}-${month}`;

  // Cells fade between shades if it's the same month. A new month pops in.
  const sameMonth = sameView && monthlyView.shown === monthKey;
  const pop = !sameMonth;
  const previous = sameMonth ? monthlyView.values : {};

  const stats = monthStats(journal, year, month);
  const todayKey = getTodayKey();

  // Summary chips
  const chips = [];

  if (journal.goals.length === 0) {
    chips.push('<span class="month-chip">No daily goals yet</span>');
  } else if (stats.avg === null) {
    chips.push('<span class="month-chip">Upcoming month</span>');
  } else {
    chips.push(`<span class="month-chip">Avg <b>${Math.round(stats.avg * 100)}%</b></span>`);
    chips.push(`<span class="month-chip">⭐ <b>${stats.perfect}</b> perfect</span>`);
  }

  // The grid
  const dowHeader = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
    .map((d) => `<div class="month-dow">${d}</div>`)
    .join('');

  let cells = '';
  const leading = shown.getDay();

  for (let i = 0; i < leading; i++) {
    cells += '<div class="month-cell blank"></div>';
  }

  const values = {};

  stats.days.forEach((d, i) => {
    values[d.key] = d.value;

    const finalAlpha = d.future ? 0.06 : 0.1 + 0.8 * d.value;
    const fromAlpha = previous[d.key] !== undefined && !d.future ? 0.1 + 0.8 * previous[d.key] : finalAlpha;
    const perfect = !d.future && journal.goals.length > 0 && d.value >= 1;

    const classes = ['month-cell'];
    if (d.key === todayKey) classes.push('today');
    if (d.future) classes.push('future');
    if (!d.future && d.value >= 0.5) classes.push('light');
    if (pop) classes.push('pop');

    cells += `
      <div class="${classes.join(' ')}" data-index="${i}" data-alpha="${finalAlpha}"
        style="background-color: rgba(255, 255, 255, ${fromAlpha}); animation-delay: ${i * 20}ms;">
        <span class="month-day">${d.day}</span>
        ${perfect ? '<span class="month-star">★</span>' : ''}
      </div>
    `;
  });

  // Always six rows, so the tracker is the same height in every month
  for (let i = leading + stats.days.length; i < 42; i++) {
    cells += '<div class="month-cell blank"></div>';
  }

  const away = monthlyView.offset !== 0;

  box.innerHTML = `
    <div class="week-nav">
      <button class="week-arrow" id="month-prev" title="Previous month">‹</button>
      <button class="week-label${away ? ' away' : ''}" id="month-label" title="${away ? 'Back to this month' : ''}">${shown.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</button>
      <button class="week-arrow" id="month-next" title="Next month">›</button>
    </div>

    <div class="month-summary">${chips.join('')}</div>

    <div class="month-grid">${dowHeader}${cells}</div>

    <div class="month-legend">
      <span>0%</span>
      <div class="month-legend-bar"></div>
      <span>100%</span>
      <span class="month-legend-star">★ perfect day</span>
    </div>

    <div class="month-tip"></div>
  `;

  // Cells fade to their new shade
  function settleColors() {
    box.querySelectorAll('.month-cell[data-alpha]').forEach((cell) => {
      cell.style.backgroundColor = `rgba(255, 255, 255, ${cell.dataset.alpha})`;
    });
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    settleColors();
  } else {
    requestAnimationFrame(() => requestAnimationFrame(settleColors));
  }

  monthlyView = { journal, date: currentViewDate, offset: monthlyView.offset, shown: monthKey, values };

  // Hover cards (and tap cards, on touch screens)
  const tip = box.querySelector('.month-tip');
  const grid = box.querySelector('.month-grid');

  function showTip(cell) {
    const day = stats.days[Number(cell.dataset.index)];
    const date = new Date(day.key + 'T00:00:00');

    tip.innerHTML = `
      <strong>${date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</strong>
      ${dayDetailLines(journal, day).map((line) => `<div>${line}</div>`).join('')}
    `;

    // Measure it first, then place it above the day (or below if there's no room)
    tip.style.display = 'block';
    tip.style.visibility = 'hidden';

    const boxRect = box.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();

    let left = cellRect.left - boxRect.left + cellRect.width / 2 - tip.offsetWidth / 2;
    left = Math.max(4, Math.min(left, boxRect.width - tip.offsetWidth - 4));

    let top = cellRect.top - boxRect.top - tip.offsetHeight - 8;
    if (top < 4) top = cellRect.bottom - boxRect.top + 8;

    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
    tip.style.visibility = 'visible';
  }

  function hideTip() {
    tip.style.display = 'none';
  }

  grid.querySelectorAll('.month-cell[data-index]').forEach((cell) => {
    cell.addEventListener('mouseenter', () => showTip(cell));
    cell.addEventListener('mouseleave', hideTip);
    cell.addEventListener('click', () => showTip(cell));
  });

  // Month arrows
  box.querySelector('#month-prev').addEventListener('click', () => {
    monthlyView.offset -= 1;
    renderMonthlyTracker(journal, box);
  });

  box.querySelector('#month-next').addEventListener('click', () => {
    monthlyView.offset += 1;
    renderMonthlyTracker(journal, box);
  });

  box.querySelector('#month-label').addEventListener('click', () => {
    if (monthlyView.offset === 0) return;

    monthlyView.offset = 0;
    renderMonthlyTracker(journal, box);
  });
}

// Touching anywhere except a day hides the monthly hover card
document.addEventListener('pointerdown', (e) => {
  if (e.target.closest('.month-cell')) return;

  document.querySelectorAll('.month-tip').forEach((tip) => {
    tip.style.display = 'none';
  });
});

const savedTheme = readItem('ezjournal-theme') || 'sage';
applyTheme(savedTheme);

document.querySelectorAll('.theme-swatch').forEach((swatch) => {
  if (swatch.dataset.theme === savedTheme) {
    swatch.classList.add('active');
  }
});

/* =========================================================
   NOTES BOARDS
   ========================================================= */

// ---------- Boards: saving, grid, settings ----------

let boards = loadList('ezjournal-boards');
let currentBoard = null;

function persistBoards() {
  return storeItem('ezjournal-boards', JSON.stringify(boards));
}

function saveBoards() {
  persistBoards();
  renderBoardGrid();
}

function renderBoardGrid() {
  const grid = document.getElementById('board-grid');
  grid.innerHTML = '';

  if (boards.length === 0) {
    grid.innerHTML = '<p class="empty-goals-msg">No boards yet. Click the + to create one.</p>';
    return;
  }

  boards.forEach((board) => {
    const card = document.createElement('div');
    card.className = 'journal-card';
    card.innerHTML = `
      <div class="journal-card-preview">
        <span class="preview-percent">${board.items.length}</span>
        <span class="preview-label">item${board.items.length === 1 ? '' : 's'}</span>
      </div>
      <div class="journal-card-title"></div>
    `;
    card.querySelector('.journal-card-title').textContent = board.name;
    card.addEventListener('click', () => openBoard(board));
    grid.appendChild(card);
  });
}

document.getElementById('add-board-btn').addEventListener('click', () => {
  const name = prompt('Name your board:');
  if (!name || !name.trim()) return;

  const board = { id: Date.now(), name: name.trim(), items: [] };
  boards.push(board);
  saveBoards();
  openBoard(board);
});

document.getElementById('back-to-boards').addEventListener('click', () => {
  showView('notes');
});

function renderBoardDeleteList() {
  const list = document.getElementById('delete-board-list');
  list.innerHTML = '';

  if (boards.length === 0) {
    list.innerHTML = '<p>No boards yet.</p>';
    return;
  }

  boards.forEach((board) => {
    const row = document.createElement('div');
    row.className = 'delete-journal-row';

    const name = document.createElement('span');
    name.textContent = board.name;

    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => renameBoard(board));

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => {
      const confirmed = confirm(`Are you sure you want to delete "${board.name}" and everything on it? This cannot be undone.`);
      if (confirmed) deleteBoard(board);
    });

    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'delete-row-buttons';
    buttonGroup.appendChild(editBtn);
    buttonGroup.appendChild(deleteBtn);

    row.appendChild(name);
    row.appendChild(buttonGroup);
    list.appendChild(row);
  });
}

function renameBoard(board) {
  const newName = prompt('Rename board:', board.name);
  if (!newName || !newName.trim()) return;

  board.name = newName.trim();
  saveBoards();

  if (currentBoard === board) {
    document.getElementById('board-title').textContent = board.name;
  }

  renderBoardDeleteList();
}

function deleteBoard(board) {
  boards = boards.filter((b) => b !== board);

  if (currentBoard === board) {
    currentBoard = null;
    selectedItemId = null;
    activeEditor = null;
    savedRange = null;
    showView('notes');
  }

  saveBoards();
  renderBoardDeleteList();
}

document.getElementById('settings-btn').addEventListener('click', renderBoardDeleteList);

// ---------- Text formatting ----------

let activeEditor = null;
let savedRange = null;
let syncing = false;
let lastFontSync = null;

const formatState = {
  bold: false,
  italic: false,
  color: '#333333',
  font: 'sans-serif',
  size: 16
};

const boardCanvas = document.getElementById('board-canvas');
const formatBar = document.getElementById('format-bar');
const boldBtn = document.getElementById('bold-btn');
const italicBtn = document.getElementById('italic-btn');
const applyColorBtn = document.getElementById('apply-color-btn');
const colorLetter = document.getElementById('color-letter');
const colorInput = document.getElementById('text-color-input');
const fontFamilySelect = document.getElementById('font-family-select');
const fontSizeSelect = document.getElementById('font-size-select');

// Turns a font name from the dropdown into something CSS understands
function fontStack(name) {
  return name === 'sans-serif' ? 'sans-serif' : `"${name}", sans-serif`;
}

// Sizes up to 24 are shown at their real size. Bigger ones are shrunk so the list doesn't get huge.
function previewSize(size) {
  return Math.min(size, 24 + (size - 24) * 0.25);
}

function refreshToolbar() {
  boldBtn.classList.toggle('active', formatState.bold);
  italicBtn.classList.toggle('active', formatState.italic);
  colorLetter.style.borderBottom = `3px solid ${formatState.color}`;
  colorInput.value = formatState.color;
  fontFamilySelect.value = formatState.font;
  fontSizeSelect.value = String(formatState.size);

  // The closed dropdown shows the current font in its own typeface
  fontFamilySelect.style.fontFamily = fontStack(formatState.font);
}

function rgbToHex(rgb) {
  if (rgb.startsWith('#')) return rgb.toLowerCase();
  const nums = rgb.match(/\d+/g);
  if (!nums) return '';
  return '#' + nums.slice(0, 3).map((n) => parseInt(n).toString(16).padStart(2, '0')).join('');
}

function firstFamily(value) {
  return value.split(',')[0].replace(/["']/g, '').trim().toLowerCase();
}

function commitActiveEditor() {
  if (!activeEditor) return;
  activeEditor.item.html = activeEditor.content.innerHTML;
  persistBoards();
}

function restoreSelection() {
  if (!savedRange) return;
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(savedRange);
}

// Checklists and images have no text to format
function hasRichText(item) {
  return item.type !== 'checklist' && item.type !== 'image';
}

function selectionInEditor() {
  const sel = window.getSelection();

  // Checklists and images have no rich text, so there's nothing to format in them
  if (!activeEditor || (activeEditor.item && !hasRichText(activeEditor.item)) || sel.rangeCount === 0) {
    return null;
  }

  const range = sel.getRangeAt(0);
  return activeEditor.content.contains(range.commonAncestorContainer) ? range : null;
}

// Picking from a dropdown pulls focus out of the note, so put it back.
function refocusEditor() {
  // Nothing to go back to when you haven't clicked into the note's text
  if (!savedRange || !activeEditor || !activeEditor.content.isConnected) return;

  const sel = window.getSelection();
  const keep = sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;

  activeEditor.content.focus({ preventScroll: true });

  if (keep) {
    sel.removeAllRanges();
    sel.addRange(keep);
  }
}

// The browser's size command only knows 7 fixed sizes. We use its biggest
// one as a marker, then switch the marked text to the exact size you picked.
function normalizeSizeSpans(content, size) {
  content.querySelectorAll('[style*="xxx-large"]').forEach((el) => {
    el.style.fontSize = `${size}px`;
    el.querySelectorAll('[style*="font-size"]').forEach((inner) => {
      inner.style.removeProperty('font-size');
    });
  });
}

// Makes whatever you type next match the toolbar settings.
function syncCaretToState() {
  const range = selectionInEditor();
  if (!range || !range.collapsed) return;

  syncing = true;
  document.execCommand('styleWithCSS', false, true);

  if (document.queryCommandState('bold') !== formatState.bold) {
    document.execCommand('bold');
  }
  if (document.queryCommandState('italic') !== formatState.italic) {
    document.execCommand('italic');
  }
  if (rgbToHex(document.queryCommandValue('foreColor')) !== formatState.color) {
    document.execCommand('foreColor', false, formatState.color);
  }

  // Font and size can't be read back from what you're about to type, so we
  // remember which spot we already handled instead of repeating the commands.
  const key = `${formatState.font}|${formatState.size}`;
  const handled =
    lastFontSync &&
    lastFontSync.node === range.startContainer &&
    lastFontSync.offset === range.startOffset &&
    lastFontSync.key === key;

  if (!handled) {
    const node = range.startContainer;
    const el = node.nodeType === 1 ? node : node.parentElement;
    const computed = getComputedStyle(el);

    if (firstFamily(computed.fontFamily) !== firstFamily(formatState.font)) {
      document.execCommand('fontName', false, formatState.font);
    }
    if (Math.round(parseFloat(computed.fontSize)) !== formatState.size) {
      document.execCommand('fontSize', false, '7');
    }

    const after = selectionInEditor() || range;
    lastFontSync = { node: after.startContainer, offset: after.startOffset, key };
  }

  syncing = false;
}

boardCanvas.addEventListener('focusin', (e) => {
  const content = e.target.closest('.board-item-content');
  if (!content) return;

  const items = Array.from(boardCanvas.querySelectorAll('.board-item'));
  const index = items.indexOf(content.parentElement);
  activeEditor = { content, item: currentBoard.items[index] };
});

document.addEventListener('selectionchange', () => {
  if (syncing) return;

  const range = selectionInEditor();
  if (!range) return;

  savedRange = range.cloneRange();
  if (range.collapsed) syncCaretToState();
});

// Runs before each note saves itself, so the exact size gets saved.
boardCanvas.addEventListener('input', (e) => {
  const content = e.target.closest('.board-item-content');
  if (content) normalizeSizeSpans(content, formatState.size);
}, true);

// Puts the selection back where it was. If you haven't clicked into the note's text,
// the whole note is selected instead, so the formatting applies to all of it.
// Returns true when it had to select the whole note.
function prepareSelection() {
  const content = activeEditor.content;

  if (savedRange && content.contains(savedRange.commonAncestorContainer)) {
    restoreSelection();
    return false;
  }

  const range = document.createRange();
  range.selectNodeContents(content);

  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  return true;
}

function finishFormatting(wholeNote) {
  commitActiveEditor();

  // Formatting a whole note shouldn't leave all of its text highlighted
  if (wholeNote) {
    window.getSelection().removeAllRanges();
    savedRange = null;
  }
}

function toggleStyle(key, command) {
  formatState[key] = !formatState[key];
  refreshToolbar();

  if (!activeEditor || !activeEditor.content.isConnected) return;

  const wholeNote = prepareSelection();
  document.execCommand('styleWithCSS', false, true);
  if (document.queryCommandState(command) !== formatState[key]) {
    document.execCommand(command);
  }
  finishFormatting(wholeNote);
}

function applyColorToSelection() {
  if (!activeEditor || !activeEditor.content.isConnected) return;

  const wholeNote = prepareSelection();
  document.execCommand('styleWithCSS', false, true);
  document.execCommand('foreColor', false, formatState.color);
  finishFormatting(wholeNote);
}

function applyFontToSelection() {
  if (!activeEditor || !activeEditor.content.isConnected) return;

  const wholeNote = prepareSelection();
  document.execCommand('styleWithCSS', false, true);
  document.execCommand('fontName', false, formatState.font);
  finishFormatting(wholeNote);
}

function applySizeToSelection() {
  if (!activeEditor || !activeEditor.content.isConnected) return;

  const wholeNote = prepareSelection();
  document.execCommand('styleWithCSS', false, true);
  document.execCommand('fontSize', false, '7');
  normalizeSizeSpans(activeEditor.content, formatState.size);
  finishFormatting(wholeNote);
}

boldBtn.addEventListener('mousedown', (e) => {
  e.preventDefault();
  toggleStyle('bold', 'bold');
});

italicBtn.addEventListener('mousedown', (e) => {
  e.preventDefault();
  toggleStyle('italic', 'italic');
});

applyColorBtn.addEventListener('mousedown', (e) => {
  e.preventDefault();
  applyColorToSelection();
});

colorInput.addEventListener('input', (e) => {
  formatState.color = e.target.value;
  refreshToolbar();
  applyColorToSelection();
});

fontFamilySelect.addEventListener('change', () => {
  formatState.font = fontFamilySelect.value;
  applyFontToSelection();
  refocusEditor();
});

fontSizeSelect.addEventListener('change', () => {
  formatState.size = Number(fontSizeSelect.value);
  applySizeToSelection();
  refocusEditor();
});

// Every font name is written in its own font, and every size is shown at its size
fontFamilySelect.querySelectorAll('option').forEach((option) => {
  option.style.fontFamily = fontStack(option.value);
});

fontSizeSelect.querySelectorAll('option').forEach((option) => {
  option.style.fontSize = `${previewSize(Number(option.value))}px`;
});

refreshToolbar();

// ---------- Selecting notes ----------

let selectedItemId = null;
let topZ = 1; // the highest layer any note is on

// The colors a sticky note can be
const STICKY_COLORS = [
  { name: 'Yellow', color: '#fff3a3' },
  { name: 'Pink', color: '#ffc4d6' },
  { name: 'Orange', color: '#ffd3a3' },
  { name: 'Green', color: '#c9f0c5' },
  { name: 'Blue', color: '#bfe3ff' },
  { name: 'Purple', color: '#e0cffc' }
];

// The color choices only show in the format bar while a sticky note is selected
const swatchRow = document.createElement('div');
swatchRow.className = 'note-swatches';

STICKY_COLORS.forEach(({ name, color }) => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'note-swatch';
  btn.dataset.color = color;
  btn.title = name;
  btn.style.backgroundColor = color;
  btn.addEventListener('mousedown', (e) => e.preventDefault());
  btn.addEventListener('click', () => setStickyColor(color));
  swatchRow.appendChild(btn);
});

formatBar.appendChild(swatchRow);

function updateSwatches(item) {
  const current = (item.color || STICKY_COLORS[0].color).toLowerCase();

  swatchRow.querySelectorAll('.note-swatch').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.color === current);
  });
}

function setStickyColor(color) {
  const item = currentBoard ? currentBoard.items.find((i) => i.id === selectedItemId) : null;
  if (!item || item.type !== 'sticky') return;

  item.color = color;

  const el = boardCanvas.querySelector(`.board-item[data-id="${item.id}"]`);
  if (el) el.style.backgroundColor = color;

  persistBoards();
  updateSwatches(item);
}

// The format bar shows how the selected note looks, based on its first character.
function readFormatFromNote(content) {
  const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => (node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT)
  });

  const textNode = walker.nextNode();

  // An empty note shows its own starting style, like a heading's big bold text
  const computed = getComputedStyle(textNode ? textNode.parentElement : content);

  formatState.bold = computed.fontWeight === 'bold' || parseInt(computed.fontWeight) >= 600;
  formatState.italic = computed.fontStyle === 'italic';
  formatState.color = rgbToHex(computed.color);

  const family = firstFamily(computed.fontFamily);
  const fontMatch = Array.from(fontFamilySelect.options).find((o) => firstFamily(o.value) === family);
  formatState.font = fontMatch ? fontMatch.value : 'sans-serif';

  const size = Math.round(parseFloat(computed.fontSize));
  const sizes = Array.from(fontSizeSelect.options).map((o) => Number(o.value));
  formatState.size = sizes.reduce((best, s) => (Math.abs(s - size) < Math.abs(best - size) ? s : best), sizes[0]);

  refreshToolbar();
}

// Puts the format bar above the selected note, or below it when there's no room above.
function positionFormatBar() {
  const item = selectedItemId === null || !currentBoard
    ? null
    : currentBoard.items.find((i) => i.id === selectedItemId);
  const el = item ? boardCanvas.querySelector(`.board-item[data-id="${selectedItemId}"]`) : null;

  // Checklists and images have no text formatting
  if (!el || !hasRichText(item)) {
    formatBar.classList.remove('visible');
    return;
  }

  // Sticky notes also get their color choices
  formatBar.classList.toggle('sticky-selected', item.type === 'sticky');
  if (item.type === 'sticky') updateSwatches(item);

  const canvasRect = boardCanvas.getBoundingClientRect();
  const rect = el.getBoundingClientRect();

  // Hide the bar when the note has been scrolled out of view
  const offscreen =
    rect.bottom < canvasRect.top || rect.top > canvasRect.bottom ||
    rect.right < canvasRect.left || rect.left > canvasRect.right;

  if (offscreen) {
    formatBar.classList.remove('visible');
    return;
  }

  formatBar.classList.add('visible');

  const barWidth = formatBar.offsetWidth;
  const barHeight = formatBar.offsetHeight;

  let left = rect.left - canvasRect.left + rect.width / 2 - barWidth / 2;
  left = Math.max(8, Math.min(left, canvasRect.width - barWidth - 8));

  let top = rect.top - canvasRect.top - barHeight - 12;
  if (top < 8) top = rect.bottom - canvasRect.top + 12;
  top = Math.max(8, Math.min(top, canvasRect.height - barHeight - 8));

  formatBar.style.left = `${left}px`;
  formatBar.style.top = `${top}px`;
}

function selectItem(id) {
  if (id === selectedItemId) return;
  selectedItemId = id;

  boardCanvas.querySelectorAll('.board-item.selected').forEach((el) => el.classList.remove('selected'));

  const item = id === null || !currentBoard ? null : currentBoard.items.find((i) => i.id === id);
  const el = item ? boardCanvas.querySelector(`.board-item[data-id="${id}"]`) : null;

  // Nothing selected
  if (!item || !el) {
    selectedItemId = null;
    activeEditor = null;
    savedRange = null;
    positionFormatBar();
    return;
  }

  el.classList.add('selected');

  // Stop typing in a different note
  const typing = document.activeElement;
  if (typing && typing !== document.body && !el.contains(typing) && boardCanvas.contains(typing)) typing.blur();

  // Bring it to the front
  if ((item.z || 0) < topZ) {
    topZ += 1;
    item.z = topZ;
    el.style.zIndex = item.z;
    persistBoards();
  }

  // The format bar now works on this note, and shows how it looks
  activeEditor = { content: el.querySelector('.board-item-content'), item };
  savedRange = null;
  if (hasRichText(item)) readFormatFromNote(activeEditor.content);

  positionFormatBar();
}

// Clicking a line lets go of the selected note
boardCanvas.addEventListener('click', (e) => {
  if (e.target.closest('.board-line-hit')) selectItem(null);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && selectedItemId !== null) selectItem(null);
});

// ---------- Connection lines ----------

let connectMode = false;
let connectFrom = null;

const connectBtn = document.getElementById('connect-btn');

function setConnectMode(on) {
  connectMode = on;
  connectFrom = null;
  connectBtn.classList.toggle('active', on);
  boardCanvas.classList.toggle('connecting', on);
  boardCanvas.querySelectorAll('.connect-source').forEach((el) => el.classList.remove('connect-source'));
}

let selectedConnectionId = null;

const linePanel = document.getElementById('line-panel');
const lineWidthInput = document.getElementById('line-width');
const lineColorInput = document.getElementById('line-color');
const lineStyleButtons = document.querySelectorAll('.style-btn');

function getSelectedConnection() {
  if (!currentBoard || selectedConnectionId === null) return null;
  return (currentBoard.connections || []).find((c) => c.id === selectedConnectionId) || null;
}

function dashFor(style, width) {
  if (style === 'dashed') return `${width * 3 + 6} ${width * 2 + 6}`;
  if (style === 'dotted') return `0.1 ${width * 2 + 5}`;
  return 'none';
}

function makeSvgLine(className, x1, y1, x2, y2) {
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('class', className);
  line.setAttribute('x1', x1);
  line.setAttribute('y1', y1);
  line.setAttribute('x2', x2);
  line.setAttribute('y2', y2);
  return line;
}

let newLineId = null; // the line that was just drawn, so it can fade in

function drawConnections() {
  const svg = document.getElementById('board-lines');
  if (!svg) return;
  svg.innerHTML = '';

  linePanel.classList.toggle('open', !!getSelectedConnection());
  if (!currentBoard || !currentBoard.connections) return;

  currentBoard.connections.forEach((c) => {
    const a = currentBoard.items.find((i) => i.id === c.from);
    const b = currentBoard.items.find((i) => i.id === c.to);
    if (!a || !b) return;

    const x1 = a.x + a.width / 2;
    const y1 = a.y + a.height / 2;
    const x2 = b.x + b.width / 2;
    const y2 = b.y + b.height / 2;
    const width = c.width || 3;

    if (c.id === selectedConnectionId) {
      const halo = makeSvgLine('board-line-halo', x1, y1, x2, y2);
      halo.style.strokeWidth = width + 8;
      svg.appendChild(halo);
    }

    const line = makeSvgLine('board-line', x1, y1, x2, y2);
    if (c.id === newLineId) line.classList.add('line-in');
    line.style.stroke = c.color || 'var(--color-accent)';
    line.style.strokeWidth = width;
    line.style.strokeDasharray = dashFor(c.style, width);
    svg.appendChild(line);

    // An invisible, wider copy on top makes thin lines easy to click.
    const hit = makeSvgLine('board-line-hit', x1, y1, x2, y2);
    hit.addEventListener('click', () => selectConnection(c.id));
    svg.appendChild(hit);
  });

  newLineId = null;
}

function refreshLinePanel() {
  const c = getSelectedConnection();
  linePanel.classList.toggle('open', !!c);
  if (!c) return;

  lineWidthInput.value = c.width || 3;
  lineColorInput.value = c.color || rgbToHex(getThemeColors().accent);
  lineStyleButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.style === (c.style || 'solid'));
  });
}

function selectConnection(id) {
  selectedConnectionId = id;
  refreshLinePanel();
  drawConnections();
}

function updateSelectedConnection(changes) {
  const c = getSelectedConnection();
  if (!c) return;

  Object.assign(c, changes);
  persistBoards();
  drawConnections();
}

lineWidthInput.addEventListener('input', () => {
  updateSelectedConnection({ width: Number(lineWidthInput.value) });
});

lineColorInput.addEventListener('input', () => {
  updateSelectedConnection({ color: lineColorInput.value });
});

lineStyleButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    updateSelectedConnection({ style: btn.dataset.style });
    refreshLinePanel();
  });
});

document.getElementById('delete-line-btn').addEventListener('click', () => {
  const c = getSelectedConnection();
  if (!c) return;

  currentBoard.connections = currentBoard.connections.filter((x) => x.id !== c.id);
  selectedConnectionId = null;
  persistBoards();
  drawConnections();
});

// Clicking anywhere on the board except a line deselects the line.
boardCanvas.addEventListener('pointerdown', (e) => {
  if (!e.target.closest('.board-line-hit') && selectedConnectionId !== null) {
    selectConnection(null);
  }
});

function toggleConnection(a, b) {
  const list = currentBoard.connections;
  const existing = list.findIndex(
    (c) => (c.from === a && c.to === b) || (c.from === b && c.to === a)
  );

  if (existing >= 0) {
    list.splice(existing, 1);
  } else {
    const id = Date.now();
    list.push({ id, from: a, to: b });
    newLineId = id;
  }

  persistBoards();
  drawConnections();
}

connectBtn.addEventListener('click', () => setConnectMode(!connectMode));

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;

  if (selectedConnectionId !== null) selectConnection(null);
  if (connectMode) setConnectMode(false);
});

// While Connect is on, clicking a box selects it instead of typing in it.
boardCanvas.addEventListener('mousedown', (e) => {
  if (connectMode && e.target.closest('.board-item')) e.preventDefault();
}, true);

boardCanvas.addEventListener('pointerdown', (e) => {
  if (!connectMode) return;

  const el = e.target.closest('.board-item');
  if (!el) return;

  e.stopPropagation();
  const id = Number(el.dataset.id);

  if (connectFrom === null) {
    connectFrom = id;
    el.classList.add('connect-source');
    return;
  }

  if (connectFrom !== id) {
    toggleConnection(connectFrom, id);
  }

  boardCanvas.querySelectorAll('.connect-source').forEach((s) => s.classList.remove('connect-source'));
  connectFrom = null;
}, true);

// ---------- Pan and zoom ----------
// The board has a top-left corner you can't pan past, and it goes on forever to the right and down.

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 2;
let view = { x: 0, y: 0, zoom: 1 };
let wheelTimer = null;

// The left wall and the top edge of the board, drawn as solid black lines
const wallLeft = document.createElement('div');
wallLeft.className = 'board-wall board-wall-left';

const wallTop = document.createElement('div');
wallTop.className = 'board-wall board-wall-top';

boardCanvas.append(wallLeft, wallTop);

function applyView() {
  view.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.zoom));

  // The corner is as far up and to the left as you can go
  view.x = Math.min(0, view.x);
  view.y = Math.min(0, view.y);

  const world = document.getElementById('board-world');
  world.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`;

  // The walls sit right where the corner is
  wallLeft.style.left = `${view.x}px`;
  wallTop.style.top = `${view.y}px`;

  // The dotted grid is drawn on the board itself, so it never runs out.
  // When you zoom far out, every other dot is skipped so it doesn't turn into noise.
  let gridSize = 32 * view.zoom;
  while (gridSize < 14) gridSize *= 2;
  boardCanvas.style.backgroundSize = `${gridSize}px ${gridSize}px`;
  boardCanvas.style.backgroundPosition = `${view.x}px ${view.y}px`;

  document.getElementById('zoom-label').textContent = `${Math.round(view.zoom * 100)}%`;

  // The format bar follows the selected note as the board moves
  positionFormatBar();
}

// Saves a moment after you stop, so typing and zooming don't re-save everything on every tick
function schedulePersist() {
  clearTimeout(wheelTimer);
  wheelTimer = setTimeout(persistBoards, 300);
}

// Saves right away when the page is hidden or closed, so a change waiting to save is never lost
function flushBoards() {
  clearTimeout(wheelTimer);
  persistBoards();
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushBoards();
});

window.addEventListener('pagehide', flushBoards);

// Stops a glide that's in progress, like when you grab the board
let glideFrame = null;

function stopGlide() {
  if (glideFrame) {
    cancelAnimationFrame(glideFrame);
    glideFrame = null;
  }
}

// Zooming with the scroll wheel always happens from the middle of the board, wherever your mouse is.
function setZoom(newZoom) {
  stopGlide();

  const anchorX = boardCanvas.clientWidth / 2;
  const anchorY = boardCanvas.clientHeight / 2;

  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, newZoom));
  const worldX = (anchorX - view.x) / view.zoom;
  const worldY = (anchorY - view.y) / view.zoom;

  view.zoom = zoom;
  view.x = anchorX - worldX * zoom;
  view.y = anchorY - worldY * zoom;

  applyView();
  schedulePersist();
}

// Smoothly moves the board to a new place and zoom
function glideTo(target) {
  stopGlide();

  if (prefersReducedMotion()) {
    view.x = target.x;
    view.y = target.y;
    view.zoom = target.zoom;
    applyView();
    persistBoards();
    return;
  }

  const startedOn = view;
  const from = { x: view.x, y: view.y, zoom: view.zoom };
  const start = performance.now();

  function step(now) {
    // If you opened a different board, this glide is over
    if (view !== startedOn) {
      glideFrame = null;
      return;
    }

    const t = Math.min((now - start) / 300, 1);
    const eased = 1 - Math.pow(1 - t, 3);

    view.x = from.x + (target.x - from.x) * eased;
    view.y = from.y + (target.y - from.y) * eased;
    view.zoom = from.zoom + (target.zoom - from.zoom) * eased;
    applyView();

    if (t < 1) {
      glideFrame = requestAnimationFrame(step);
    } else {
      glideFrame = null;
      persistBoards();
    }
  }

  glideFrame = requestAnimationFrame(step);
}

// The zoom buttons glide too, also from the middle of the board
function glideZoom(newZoom) {
  const anchorX = boardCanvas.clientWidth / 2;
  const anchorY = boardCanvas.clientHeight / 2;

  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, newZoom));
  const worldX = (anchorX - view.x) / view.zoom;
  const worldY = (anchorY - view.y) / view.zoom;

  glideTo({
    x: Math.min(0, anchorX - worldX * zoom),
    y: Math.min(0, anchorY - worldY * zoom),
    zoom
  });
}

document.getElementById('zoom-in-btn').addEventListener('click', () => glideZoom(view.zoom * 1.25));
document.getElementById('zoom-out-btn').addEventListener('click', () => glideZoom(view.zoom / 1.25));
document.getElementById('zoom-label').addEventListener('click', () => glideZoom(1));

// Glides back to the corner at 100%.
document.getElementById('zoom-reset-btn').addEventListener('click', () => {
  glideTo({ x: 0, y: 0, zoom: 1 });
});

// Drag empty space to pan. You can keep scrolling to zoom in the middle of a drag.
// Clicking empty space (without dragging) lets go of the selected note.
boardCanvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  if (e.target.closest('.board-item') || e.target.closest('.board-line-hit') || e.target.closest('.format-bar')) return;
  stopGlide();

  let lastX = e.clientX;
  let lastY = e.clientY;
  let travelled = 0;
  boardCanvas.classList.add('panning');

  function onMove(ev) {
    // Moves by how far the mouse travelled since the last move, so zooming mid-drag doesn't jump
    const dx = ev.clientX - lastX;
    const dy = ev.clientY - lastY;

    view.x += dx;
    view.y += dy;
    travelled += Math.abs(dx) + Math.abs(dy);
    lastX = ev.clientX;
    lastY = ev.clientY;

    applyView();
  }

  function onUp() {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    boardCanvas.classList.remove('panning');
    persistBoards();

    if (travelled < 4) selectItem(null);
  }

  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
});

// Scrolling zooms from the middle of the board.
boardCanvas.addEventListener('wheel', (e) => {
  // The format bar and a note with more text than fits scroll on their own
  if (e.target.closest('.format-bar')) return;

  const content = e.target.closest('.board-item-content');
  if (content && content.scrollHeight > content.clientHeight + 1) return;

  e.preventDefault();

  const raw = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
  const delta = Math.max(-100, Math.min(100, raw));
  const speed = e.ctrlKey ? 0.01 : 0.0025;

  setZoom(view.zoom * Math.exp(-delta * speed));
}, { passive: false });

// ---------- Touch: pinch to zoom, two fingers to move the board ----------

const touchPoints = new Map(); // the fingers touching the board right now
let pinch = null;              // where the two fingers were last time, while a pinch is happening

function readTwoFingers() {
  const [a, b] = Array.from(touchPoints.values());
  return { distance: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

boardCanvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'touch') return;

  // The first finger of a new touch starts the count fresh, so a missed lift can't throw it off
  if (e.isPrimary) touchPoints.clear();
  touchPoints.set(e.pointerId, { x: e.clientX, y: e.clientY });

  // A second (or third) finger never starts a note drag or a board move of its own
  if (touchPoints.size >= 2) e.stopPropagation();
  if (touchPoints.size !== 2) return;

  // A second finger turns whatever the first one was doing (dragging a note, moving the board) into a pinch
  const stop = new Event('pointerup');
  stop.isPinchStart = true;
  document.dispatchEvent(stop);

  stopGlide();
  pinch = readTwoFingers();
}, true);

document.addEventListener('pointermove', (e) => {
  if (!touchPoints.has(e.pointerId)) return;

  touchPoints.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (!pinch || touchPoints.size !== 2) return;

  const now = readTwoFingers();

  if (pinch.distance < 1) {
    pinch = now;
    return;
  }

  // Zooms from the middle of the board, like the scroll wheel.
  // Two fingers sliding together move the board.
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.zoom * (now.distance / pinch.distance)));
  const anchorX = boardCanvas.clientWidth / 2;
  const anchorY = boardCanvas.clientHeight / 2;
  const worldX = (anchorX - view.x) / view.zoom;
  const worldY = (anchorY - view.y) / view.zoom;

  view.x = anchorX - worldX * zoom + (now.x - pinch.x);
  view.y = anchorY - worldY * zoom + (now.y - pinch.y);
  view.zoom = zoom;
  pinch = now;

  applyView();
  schedulePersist();
});

function releaseFinger(e) {
  if (e.isPinchStart) return;

  touchPoints.delete(e.pointerId);
  if (touchPoints.size < 2) pinch = null;
}

document.addEventListener('pointerup', releaseFinger);
document.addEventListener('pointercancel', releaseFinger);

// Safari has its own pinch that would zoom the whole page. On the board, it stays out of the way.
['gesturestart', 'gesturechange', 'gestureend'].forEach((name) => {
  boardCanvas.addEventListener(name, (e) => e.preventDefault());
});

window.addEventListener('resize', () => {
  if (currentBoard) applyView();
});

// ---------- Little animations ----------

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let popItemId = null;           // the note that just appeared, so it can pop in
const removingIds = new Set();  // notes that are shrinking away, so they can't be deleted twice

// ---------- Items on a board ----------

// The board now has a top-left corner, so anything placed past it moves just inside.
function pullItemsIntoCorner(board) {
  if (board.items.length === 0) return;

  const minX = Math.min(...board.items.map((item) => item.x));
  const minY = Math.min(...board.items.map((item) => item.y));
  const shiftX = minX < 0 ? 40 - minX : 0;
  const shiftY = minY < 0 ? 40 - minY : 0;

  if (!shiftX && !shiftY) return;

  board.items.forEach((item) => {
    item.x += shiftX;
    item.y += shiftY;
  });

  board.view = { x: 0, y: 0, zoom: 1 };
  persistBoards();
}

function openBoard(board) {
  currentBoard = board;
  selectedConnectionId = null;
  selectedItemId = null;
  activeEditor = null;
  savedRange = null;

  pullItemsIntoCorner(board);

  topZ = Math.max(1, ...board.items.map((item) => item.z || 0));

  if (!board.view) board.view = { x: 0, y: 0, zoom: 1 };
  view = board.view;

  document.getElementById('board-title').textContent = board.name;
  applyBackground(board);
  bgPopover.classList.remove('open');
  renderBoardItems();
  showView('notes-detail');
  applyView();
}

// A checklist note: a tick box and a line of text for each item
function buildChecklist(content, item) {
  content.contentEditable = 'false';
  content.classList.add('checklist-content');

  if (!Array.isArray(item.rows) || item.rows.length === 0) {
    item.rows = [{ text: '', done: false }];
  }

  function draw(focusIndex) {
    content.innerHTML = '';

    item.rows.forEach((row, i) => {
      const line = makeEl('div', row.done ? 'check-row done' : 'check-row');

      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = row.done;
      box.addEventListener('change', () => {
        row.done = box.checked;
        line.classList.toggle('done', row.done);
        persistBoards();
      });

      const text = document.createElement('textarea');
      text.className = 'check-text';
      text.rows = 1;
      text.value = row.text;
      text.placeholder = 'To do';

      // The box grows with its text
      const fit = () => {
        text.style.height = 'auto';
        text.style.height = `${text.scrollHeight}px`;
      };

      text.addEventListener('input', () => {
        row.text = text.value;
        fit();
        schedulePersist();
      });

      text.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          item.rows.splice(i + 1, 0, { text: '', done: false });
          persistBoards();
          draw(i + 1);
        } else if (e.key === 'Backspace' && text.value === '' && item.rows.length > 1) {
          e.preventDefault();
          item.rows.splice(i, 1);
          persistBoards();
          draw(Math.max(0, i - 1));
        }
      });

      line.append(box, text);
      content.appendChild(line);

      requestAnimationFrame(fit);
      if (i === focusIndex) requestAnimationFrame(() => text.focus());
    });

    const add = makeEl('button', 'check-add', '+ Add item');
    add.type = 'button';
    add.addEventListener('click', () => {
      item.rows.push({ text: '', done: false });
      persistBoards();
      draw(item.rows.length - 1);
    });
    content.appendChild(add);
  }

  draw(-1);
}

function renderBoardItems() {
  setConnectMode(false);

  const world = document.getElementById('board-world');
  world.querySelectorAll('.board-item').forEach((el) => el.remove());

  if (!currentBoard) {
    positionFormatBar();
    return;
  }
  if (!currentBoard.connections) currentBoard.connections = [];

  currentBoard.items.forEach((item) => {
    const el = document.createElement('div');
    el.className = `board-item ${item.type}`;
    if (item.id === selectedItemId) el.classList.add('selected');
    if (item.id === popItemId) el.classList.add('pop-in');
    el.dataset.id = item.id;
    el.style.left = `${item.x}px`;
    el.style.top = `${item.y}px`;
    el.style.width = `${item.width}px`;
    el.style.height = `${item.height}px`;
    el.style.zIndex = item.z || 1;
    el.style.transform = `rotate(${item.rotation}deg)`;

    // A sticky note can have its own color
    if (item.type === 'sticky' && item.color) el.style.backgroundColor = item.color;

    // Clicking anywhere on a note selects it
    el.addEventListener('pointerdown', () => selectItem(item.id));

    const handle = document.createElement('div');
    handle.className = 'board-item-handle';
    handle.addEventListener('pointerdown', (e) => startDrag(e, item, el));

    const rotateBtn = document.createElement('div');
    rotateBtn.className = 'board-rotate-handle';
    rotateBtn.textContent = '⟳';
    rotateBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      startRotate(e, item, el);
    });

    const deleteBtn = document.createElement('div');
    deleteBtn.className = 'board-delete-handle';
    deleteBtn.textContent = '×';
    deleteBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      deleteBoardItem(item);
    });

    handle.appendChild(deleteBtn);
    handle.appendChild(rotateBtn);

    const content = document.createElement('div');
    content.className = 'board-item-content';

    if (item.type === 'checklist') {
      buildChecklist(content, item);
    } else if (item.type === 'image') {
      content.classList.add('image-content');

      const img = document.createElement('img');
      img.src = item.src;
      img.alt = 'Image';
      img.draggable = false;
      content.appendChild(img);

      // A picture can be dragged by grabbing it anywhere
      content.addEventListener('pointerdown', (e) => startDrag(e, item, el));
    } else {
      content.contentEditable = 'true';
      content.innerHTML = item.html;

      // Saves a moment after you stop typing, so notes with images on the board stay quick
      content.addEventListener('input', () => {
        item.html = content.innerHTML;
        schedulePersist();
      });

      // Pasted text goes in plain, without the fonts and colors of wherever it came from.
      // Pictures are handled by the page-wide paste handler.
      content.addEventListener('paste', (e) => {
        if (!e.clipboardData || e.clipboardData.files.length > 0) return;

        const text = e.clipboardData.getData('text/plain');
        if (!text) return;

        e.preventDefault();
        document.execCommand('insertText', false, text);
      });
    }

    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'board-resize-handle';
    resizeHandle.addEventListener('pointerdown', (e) => startResize(e, item, el));

    el.appendChild(handle);
    el.appendChild(content);
    el.appendChild(resizeHandle);
    world.appendChild(el);
  });

  popItemId = null;

  // Keep the format bar working on the selected note after a redraw
  const selectedItem = selectedItemId === null
    ? null
    : currentBoard.items.find((i) => i.id === selectedItemId);
  const selectedEl = selectedItem
    ? world.querySelector(`.board-item[data-id="${selectedItemId}"]`)
    : null;

  if (selectedEl) {
    activeEditor = { content: selectedEl.querySelector('.board-item-content'), item: selectedItem };
    savedRange = null;
  } else {
    selectedItemId = null;
  }

  drawConnections();
  positionFormatBar();
}

// How big each kind of note starts out
const NEW_ITEM_SIZES = {
  text: { width: 220, height: 100 },
  sticky: { width: 180, height: 180 },
  heading: { width: 360, height: 70 },
  checklist: { width: 240, height: 170 }
};

function addBoardItem(type) {
  if (!currentBoard) return;

  const offset = (currentBoard.items.length % 8) * 24;
  const size = NEW_ITEM_SIZES[type];

  topZ += 1;

  // New items land in whatever part of the board you're looking at.
  const item = {
    id: Date.now(),
    type,
    x: Math.round((-view.x + 40) / view.zoom) + offset,
    y: Math.round((-view.y + 40) / view.zoom) + offset,
    width: size.width,
    height: size.height,
    rotation: 0,
    z: topZ,
    html: ''
  };

  if (type === 'checklist') item.rows = [{ text: '', done: false }];

  currentBoard.items.push(item);

  saveBoards();
  popItemId = item.id;
  renderBoardItems();

  // The new note is selected and ready to type in
  selectItem(item.id);

  const el = boardCanvas.querySelector(`.board-item[data-id="${item.id}"]`);
  const field = el && el.querySelector(type === 'checklist' ? '.check-text' : '.board-item-content');
  if (field) field.focus({ preventScroll: true });
}

function deleteBoardItem(item) {
  if (removingIds.has(item.id)) return;

  const hasText = item.type === 'checklist'
    ? (item.rows || []).some((row) => row.text.trim() !== '')
    : item.html.replace(/<[^>]*>/g, '').trim() !== '';

  if ((hasText || item.type === 'image') && !confirm('Delete this item?')) return;

  function removeIt() {
    removingIds.delete(item.id);

    currentBoard.items = currentBoard.items.filter((i) => i.id !== item.id);
    currentBoard.connections = (currentBoard.connections || []).filter(
      (c) => c.from !== item.id && c.to !== item.id
    );

    if (selectedItemId === item.id) selectedItemId = null;

    if (activeEditor && activeEditor.item === item) {
      activeEditor = null;
      savedRange = null;
    }

    saveBoards();
    renderBoardItems();
  }

  // The note shrinks away first
  const el = boardCanvas.querySelector(`.board-item[data-id="${item.id}"]`);

  if (el && !prefersReducedMotion()) {
    removingIds.add(item.id);
    el.classList.add('removing');
    setTimeout(removeIt, 200);
  } else {
    removeIt();
  }
}

function startDrag(e, item, el) {
  e.preventDefault();

  const startX = e.clientX;
  const startY = e.clientY;
  const originX = item.x;
  const originY = item.y;
  let lifted = false;

  function onMove(ev) {
    // The note lifts once you actually start dragging it
    if (!lifted) {
      lifted = true;
      el.classList.add('dragging');
    }

    // Notes can't be dragged past the corner
    item.x = Math.max(0, Math.round(originX + (ev.clientX - startX) / view.zoom));
    item.y = Math.max(0, Math.round(originY + (ev.clientY - startY) / view.zoom));

    el.style.left = `${item.x}px`;
    el.style.top = `${item.y}px`;
    drawConnections();
    positionFormatBar();
  }

  function onUp() {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    el.classList.remove('dragging');
    persistBoards();
  }

  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
}

function startRotate(e, item, el) {
  e.preventDefault();

  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx);
  const startRotation = item.rotation;

  function onMove(ev) {
    const angle = Math.atan2(ev.clientY - cy, ev.clientX - cx);
    let rotation = startRotation + (angle - startAngle) * (180 / Math.PI);
    if (ev.shiftKey) rotation = Math.round(rotation / 15) * 15;

    item.rotation = Math.round(rotation);
    el.style.transform = `rotate(${item.rotation}deg)`;

    drawConnections();
    positionFormatBar();
  }

  function onUp() {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    persistBoards();
  }

  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
}

function startResize(e, item, el) {
  e.preventDefault();

  const rad = (item.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const startX = e.clientX;
  const startY = e.clientY;
  const startW = item.width;
  const startH = item.height;

  // The top-left corner stays put while you resize.
  const cx = item.x + startW / 2;
  const cy = item.y + startH / 2;
  const cornerX = cx + (-startW / 2) * cos - (-startH / 2) * sin;
  const cornerY = cy + (-startW / 2) * sin + (-startH / 2) * cos;

  function onMove(ev) {
    const dx = (ev.clientX - startX) / view.zoom;
    const dy = (ev.clientY - startY) / view.zoom;

    const localDx = dx * cos + dy * sin;
    const localDy = -dx * sin + dy * cos;

    // A picture keeps its shape, and everything else resizes freely
    item.width = Math.round(Math.max(80, startW + localDx));
    item.height = item.ratio
      ? Math.round(item.width / item.ratio)
      : Math.round(Math.max(50, startH + localDy));

    const newCx = cornerX + (item.width / 2) * cos - (item.height / 2) * sin;
    const newCy = cornerY + (item.width / 2) * sin + (item.height / 2) * cos;
    item.x = Math.round(newCx - item.width / 2);
    item.y = Math.round(newCy - item.height / 2);

    el.style.width = `${item.width}px`;
    el.style.height = `${item.height}px`;
    el.style.left = `${item.x}px`;
    el.style.top = `${item.y}px`;
    drawConnections();
    positionFormatBar();
  }

  function onUp() {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    persistBoards();
  }

  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
}

// ---------- Image notes ----------

const imageInput = document.getElementById('board-image-input');

// Where a new note goes when you didn't point at a spot: the top-left of what you're looking at
function newNoteSpot(step) {
  const offset = ((currentBoard ? currentBoard.items.length : 0) % 8) * 24 + step * 24;

  return {
    x: Math.round((-view.x + 40) / view.zoom) + offset,
    y: Math.round((-view.y + 40) / view.zoom) + offset
  };
}

// Reads a picture from a file, shrinks it, and puts it on the board as a note.
// x and y are where on the board it goes. "centered" puts the middle of the picture there.
async function addImageNote(file, x, y, centered) {
  if (!currentBoard) return;

  let src;
  try {
    src = await shrinkPhoto(file, 800);
  } catch (err) {
    alert("That image couldn't be read. Try a JPG or PNG.");
    return;
  }

  // Find the picture's shape, so the note matches it
  const img = new Image();
  await new Promise((resolve) => {
    img.onload = resolve;
    img.onerror = resolve;
    img.src = src;
  });

  const ratio = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1;

  let width = 300;
  let height = width / ratio;

  if (height > 320) {
    height = 320;
    width = height * ratio;
  }

  width = Math.max(80, Math.round(width));
  height = Math.round(width / ratio);

  topZ += 1;

  const item = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    type: 'image',
    src,
    ratio,
    x: Math.max(0, Math.round(centered ? x - width / 2 : x)),
    y: Math.max(0, Math.round(centered ? y - height / 2 : y)),
    width,
    height,
    rotation: 0,
    z: topZ,
    html: ''
  };

  currentBoard.items.push(item);

  // A full browser storage means it can't be kept
  if (!persistBoards()) {
    currentBoard.items.pop();
    return;
  }

  renderBoardGrid();
  popItemId = item.id;
  renderBoardItems();
  selectItem(item.id);
}

document.getElementById('add-image-btn').addEventListener('click', () => imageInput.click());

imageInput.addEventListener('change', async () => {
  const files = Array.from(imageInput.files);
  imageInput.value = '';

  for (let i = 0; i < files.length; i++) {
    const spot = newNoteSpot(i);
    await addImageNote(files[i], spot.x, spot.y, false);
  }
});

// Drop pictures right onto the board
boardCanvas.addEventListener('dragover', (e) => {
  if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) e.preventDefault();
});

boardCanvas.addEventListener('drop', async (e) => {
  const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
  if (files.length === 0) return;

  e.preventDefault();

  const rect = boardCanvas.getBoundingClientRect();
  const dropX = (e.clientX - rect.left - view.x) / view.zoom;
  const dropY = (e.clientY - rect.top - view.y) / view.zoom;

  for (let i = 0; i < files.length; i++) {
    await addImageNote(files[i], dropX + i * 24, dropY + i * 24, true);
  }
});

// Paste a copied picture or a screenshot
document.addEventListener('paste', async (e) => {
  const boardOpen = currentBoard && document.getElementById('view-notes-detail').classList.contains('active');
  if (!boardOpen || !e.clipboardData) return;

  const files = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith('image/'));
  if (files.length === 0) return;

  e.preventDefault();

  for (let i = 0; i < files.length; i++) {
    const spot = newNoteSpot(i);
    await addImageNote(files[i], spot.x, spot.y, false);
  }
});

document.getElementById('add-textbox-btn').addEventListener('click', () => addBoardItem('text'));
document.getElementById('add-heading-btn').addEventListener('click', () => addBoardItem('heading'));
document.getElementById('add-sticky-btn').addEventListener('click', () => addBoardItem('sticky'));
document.getElementById('add-checklist-btn').addEventListener('click', () => addBoardItem('checklist'));

// ---------- Board backgrounds ----------

const BOARD_PATTERNS = [
  { key: 'dots', label: 'Dots' },
  { key: 'grid', label: 'Grid' },
  { key: 'lines', label: 'Lines' },
  { key: 'blank', label: 'Blank' }
];

const BOARD_COLORS = [
  { name: 'White', color: '#ffffff' },
  { name: 'Cream', color: '#fbf6e9' },
  { name: 'Gray', color: '#eef0f2' },
  { name: 'Mint', color: '#e8f5ec' },
  { name: 'Sky', color: '#e8f1fb' },
  { name: 'Rose', color: '#fbeaef' }
];

const bgBtn = document.getElementById('bg-btn');
const bgPopover = document.getElementById('bg-popover');

// Shows a board's pattern and color, and marks them in the picker
function applyBackground(board) {
  const bg = { pattern: 'dots', color: '#ffffff', ...board.background };

  BOARD_PATTERNS.forEach((p) => boardCanvas.classList.remove(`bg-${p.key}`));
  boardCanvas.classList.add(`bg-${bg.pattern}`);
  boardCanvas.style.backgroundColor = bg.color;

  bgPopover.querySelectorAll('.bg-option').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.pattern === bg.pattern);
  });
  bgPopover.querySelectorAll('.bg-color').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.color === bg.color);
  });
}

function setBackground(changes) {
  if (!currentBoard) return;

  currentBoard.background = { pattern: 'dots', color: '#ffffff', ...currentBoard.background, ...changes };
  persistBoards();
  applyBackground(currentBoard);
}

// Build the picker: a row of patterns, then a row of colors
const patternLabel = makeEl('div', 'bg-label', 'Pattern');
const patternRow = makeEl('div', 'bg-row');

BOARD_PATTERNS.forEach(({ key, label }) => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'bg-option';
  btn.dataset.pattern = key;
  btn.innerHTML = `<span class="bg-preview bg-preview-${key}"></span><span>${label}</span>`;
  btn.addEventListener('click', () => setBackground({ pattern: key }));
  patternRow.appendChild(btn);
});

const colorLabel = makeEl('div', 'bg-label', 'Color');
const colorRow = makeEl('div', 'bg-row bg-colors');

BOARD_COLORS.forEach(({ name, color }) => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'bg-color';
  btn.dataset.color = color;
  btn.title = name;
  btn.style.backgroundColor = color;
  btn.addEventListener('click', () => setBackground({ color }));
  colorRow.appendChild(btn);
});

bgPopover.append(patternLabel, patternRow, colorLabel, colorRow);

bgBtn.addEventListener('click', () => bgPopover.classList.toggle('open'));

// Touching anywhere else, or pressing Escape, closes the picker
document.addEventListener('pointerdown', (e) => {
  if (!e.target.closest('.bg-picker')) bgPopover.classList.remove('open');
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') bgPopover.classList.remove('open');
});

// ---------- Workouts: exercise catalog ----------

const BODY_GROUPS = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Legs', 'Core'];
const OTHER_GROUPS = ['Plyos', 'Isometrics', 'Stretches'];
const MUSCLE_GROUPS = [...BODY_GROUPS, ...OTHER_GROUPS]; // every heading, in order

// Name first, then every group it belongs to. Two or more groups gets a star.
const STARTER_EXERCISES = [
  // Chest
  ['Bench Press', 'Chest'],
  ['Chest Fly', 'Chest'],
  ['Chest Press', 'Chest'],
  ['Dips', 'Chest', 'Triceps'],
  ['Dumbbell Press', 'Chest'],
  ['Push-Ups', 'Chest'],

  // Back
  ['Barbell Row', 'Back'],
  ['Cable Row', 'Back'],
  ['Deadlift', 'Back', 'Legs'],
  ['Dumbbell Row', 'Back'],
  ['Lat Pulldown', 'Back'],
  ['Pull-Ups', 'Back'],
  ['T-Bar Row', 'Back'],

  // Shoulders
  ['Front Raise', 'Shoulders'],
  ['Lateral Raise', 'Shoulders'],
  ['Overhead Press', 'Shoulders'],
  ['Rear Delt Fly', 'Shoulders'],

  // Biceps
  ['Barbell Curl', 'Biceps'],
  ['Cable Curl', 'Biceps'],
  ['Dumbbell Curl', 'Biceps'],
  ['Hammer Curl', 'Biceps'],
  ['Preacher Curl', 'Biceps'],

  // Triceps
  ['Skull Crushers', 'Triceps'],
  ['Tricep Extension', 'Triceps'],
  ['Tricep Pushdown', 'Triceps'],

  // Legs
  ['Bulgarian Split Squat', 'Legs'],
  ['Calf Raise', 'Legs'],
  ['Hip Thrust', 'Legs'],
  ['Leg Curl', 'Legs'],
  ['Leg Extension', 'Legs'],
  ['Leg Press', 'Legs'],
  ['Lunges', 'Legs'],
  ['Romanian Deadlift', 'Legs', 'Back'],
  ['Squat', 'Legs'],

  // Core
  ['Ab Wheel', 'Core'],
  ['Cable Crunch', 'Core'],
  ['Crunches', 'Core'],
  ['Leg Raise', 'Core'],
  ['Plank', 'Core'],
  ['Russian Twist', 'Core'],
  ['Sit-Ups', 'Core'],

  // Plyos
  ['Approach Max', 'Plyos'],
  ['Box Jumps', 'Plyos'],
  ['Depth Jumps', 'Plyos'],
  ['Pogos', 'Plyos'],
  ['Standing Max', 'Plyos'],

  // Isometrics
  ['Calf Raise Hold', 'Isometrics'],
  ['Dead Hang', 'Isometrics'],
  ['Lunge Hold', 'Isometrics'],
  ['Wall Sits', 'Isometrics'],

  // Stretches
  ['90-90s', 'Stretches'],
  ['Ankle Stretch', 'Stretches'],
  ['Butterflies', 'Stretches'],
  ['Couch Sit', 'Stretches'],
  ['Deep Squat', 'Stretches'],
  ['Hamstring Extension', 'Stretches'],
  ['Hamstring Stretch', 'Stretches'],
  ['Quad Stretch', 'Stretches'],
  ['Wrist Stretch', 'Stretches']
];

const STARTER_BY_NAME = {};
STARTER_EXERCISES.forEach(([name, ...muscles]) => {
  STARTER_BY_NAME[name.toLowerCase()] = muscles;
});

function buildStarterExercises() {
  return STARTER_EXERCISES.map(([name, ...muscles], i) => ({
    id: `ex-seed-${i + 1}`,
    name,
    muscles
  }));
}

// Upgrades a catalog saved in the old format (one muscle per exercise).
// Glutes folds into Legs, and the starter exercises get their new groups.
function migrateExercises(list) {
  const result = [];

  list.forEach((ex) => {
    let muscles = Array.isArray(ex.muscles) ? ex.muscles : [ex.muscle];
    muscles = muscles.map((m) => (m === 'Glutes' ? 'Legs' : m));

    const starter = STARTER_BY_NAME[String(ex.name).toLowerCase()];
    if (String(ex.id).startsWith('ex-seed-') && starter) {
      muscles = starter;
    }

    const existing = result.find((r) => r.name.toLowerCase() === ex.name.toLowerCase());
    if (existing) {
      existing.muscles = [...new Set([...existing.muscles, ...muscles])];
    } else {
      result.push({ id: ex.id, name: ex.name, muscles: [...new Set(muscles)] });
    }
  });

  return result;
}

// Starter exercises that were renamed (old name on the left, new name on the right).
const RENAMED_STARTERS = {
  'overhead tricep extension': 'Tricep Extension',
  'hanging leg raise': 'Leg Raise'
};

// Starter exercises that are new in this update.
const NEWLY_ADDED_STARTERS = ['Dumbbell Press', 'Chest Press', 'Cable Row', 'Sit-Ups'];

// Brings a saved catalog in line with the starter list above.
// Exercises you added yourself are never touched.
function updateStarterExercises(list) {
  const result = [];

  list.forEach((ex) => {
    if (!String(ex.id).startsWith('ex-seed-')) {
      result.push(ex);
      return;
    }

    const newName = RENAMED_STARTERS[ex.name.toLowerCase()] || ex.name;
    const starter = STARTER_BY_NAME[newName.toLowerCase()];

    // No longer in the starter list, so it's removed.
    if (!starter) return;

    result.push({ ...ex, name: newName, muscles: [...starter] });
  });

  NEWLY_ADDED_STARTERS.forEach((name) => {
    const alreadyThere = result.some((r) => r.name.toLowerCase() === name.toLowerCase());

    if (!alreadyThere) {
      result.push({
        id: `ex-seed-new-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        name,
        muscles: [...STARTER_BY_NAME[name.toLowerCase()]]
      });
    }
  });

  return result;
}

// The starter exercises added with plyos, isometrics, and stretches.
const V4_STARTERS = [
  'Approach Max', 'Box Jumps', 'Depth Jumps', 'Pogos', 'Standing Max',
  'Calf Raise Hold', 'Dead Hang', 'Lunge Hold', 'Wall Sits',
  '90-90s', 'Ankle Stretch', 'Butterflies', 'Couch Sit', 'Deep Squat',
  'Hamstring Extension', 'Hamstring Stretch', 'Quad Stretch', 'Wrist Stretch'
];

// Adds starter exercises your saved catalog doesn't have yet.
// Anything already there is left alone.
function addStarterExercises(list, names) {
  const result = list.slice();

  names.forEach((name) => {
    const alreadyThere = result.some((r) => r.name.toLowerCase() === name.toLowerCase());

    if (!alreadyThere) {
      result.push({
        id: `ex-seed-new-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        name,
        muscles: [...STARTER_BY_NAME[name.toLowerCase()]]
      });
    }
  });

  return result;
}

// The starter list is only added the very first time. After that,
// the catalog is yours: whatever you add or remove stays that way.
const EXERCISE_VERSION = 4;
let exercises = loadList('ezjournal-exercises', null);
const savedExerciseVersion = Number(readItem('ezjournal-exercises-version')) || 1;

if (!exercises) {
  exercises = buildStarterExercises();
} else {
  if (savedExerciseVersion < 2) exercises = migrateExercises(exercises);
  if (savedExerciseVersion < 3) exercises = updateStarterExercises(exercises);
  if (savedExerciseVersion < 4) exercises = addStarterExercises(exercises, V4_STARTERS);
}

storeItem('ezjournal-exercises', JSON.stringify(exercises));
storeItem('ezjournal-exercises-version', String(EXERCISE_VERSION));

function saveExercises() {
  storeItem('ezjournal-exercises', JSON.stringify(exercises));
  renderExerciseCatalog();
}

const exerciseNameInput = document.getElementById('exercise-name-input');
const muscleChips = document.getElementById('muscle-chips');

MUSCLE_GROUPS.forEach((muscle) => {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'muscle-chip';
  chip.dataset.muscle = muscle;
  chip.textContent = muscle;
  chip.addEventListener('click', () => chip.classList.toggle('selected'));
  muscleChips.appendChild(chip);
});

function addExercise() {
  const name = exerciseNameInput.value.trim();
  const picked = Array.from(muscleChips.querySelectorAll('.muscle-chip.selected'))
    .map((chip) => chip.dataset.muscle);

  if (!name) {
    alert('Please type an exercise name.');
    return;
  }

  if (picked.length === 0) {
    alert('Pick at least one group.');
    return;
  }

  // Typing a name that already exists adds the new groups to that exercise.
  const existing = exercises.find((ex) => ex.name.toLowerCase() === name.toLowerCase());

  if (existing) {
    const missing = picked.filter((m) => !existing.muscles.includes(m));

    if (missing.length === 0) {
      alert(`"${existing.name}" is already in ${picked.join(', ')}.`);
      return;
    }

    existing.muscles = existing.muscles.concat(missing);
  } else {
    exercises.push({ id: `ex-${Date.now()}`, name, muscles: picked });
  }

  exerciseNameInput.value = '';
  muscleChips.querySelectorAll('.muscle-chip.selected').forEach((chip) => {
    chip.classList.remove('selected');
  });
  saveExercises();
}

// The × on a card removes the exercise from that group only.
// If it was the last group, the exercise leaves the catalog.
function removeExerciseFromGroup(exercise, muscle) {
  const others = exercise.muscles.filter((m) => m !== muscle);

  const message = others.length > 0
    ? `Remove "${exercise.name}" from ${muscle}? It will stay in ${others.join(', ')}.`
    : `Remove "${exercise.name}" from your catalog?`;

  if (!confirm(message)) return;

  if (others.length > 0) {
    exercise.muscles = others;
  } else {
    exercises = exercises.filter((ex) => ex.id !== exercise.id);
  }

  saveExercises();
}

document.getElementById('add-exercise-btn').addEventListener('click', addExercise);

exerciseNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addExercise();
});

function setOneRepMax(exercise) {
  const current = exercise.oneRepMax ? String(exercise.oneRepMax) : '';
  const answer = prompt(
    `One rep max for ${exercise.name} (lb).\nLeave it blank to remove it.`,
    current
  );

  if (answer === null) return; // cancelled

  if (answer.trim() === '') {
    delete exercise.oneRepMax;
  } else {
    const value = parseFloat(answer);

    if (!(value > 0)) {
      alert('Please enter a number greater than 0.');
      return;
    }

    exercise.oneRepMax = Math.round(value * 10) / 10;
  }

  saveExercises();
}

function renderExerciseCatalog() {
  const catalog = document.getElementById('exercise-catalog');
  catalog.innerHTML = '';

  if (exercises.length === 0) {
    catalog.innerHTML = '<p class="empty-goals-msg">Your catalog is empty. Add an exercise above.</p>';
    return;
  }

  MUSCLE_GROUPS.forEach((muscle) => {
    const group = exercises.filter((ex) => ex.muscles.includes(muscle));
    if (group.length === 0) return;

    const section = document.createElement('div');
    section.className = 'muscle-group';

    const title = document.createElement('h3');
    title.className = 'muscle-title';
    title.textContent = muscle;

    const count = document.createElement('span');
    count.className = 'muscle-count';
    count.textContent = group.length;
    title.appendChild(count);

    const grid = document.createElement('div');
    grid.className = 'exercise-grid';

    group.forEach((exercise) => {
      const card = document.createElement('div');
      card.className = 'exercise-card';

      const name = document.createElement('span');
      name.textContent = exercise.name;

      if (exercise.muscles.length > 1) {
        const others = exercise.muscles.filter((m) => m !== muscle);
        const star = document.createElement('span');
        star.className = 'exercise-star';
        star.textContent = '★';
        star.title = `Also in: ${others.join(', ')}`;
        name.appendChild(star);
      }

      card.appendChild(name);

      // A one rep max only makes sense for lifts
      if (exercise.muscles.some((m) => BODY_GROUPS.includes(m))) {
        const rm = document.createElement('button');
        rm.className = exercise.oneRepMax ? 'exercise-1rm has-value' : 'exercise-1rm';
        rm.textContent = exercise.oneRepMax ? `1RM: ${exercise.oneRepMax} lb` : '+ 1RM';
        rm.title = exercise.oneRepMax ? 'Click to change your one rep max' : 'Add your one rep max';
        rm.addEventListener('click', () => setOneRepMax(exercise));
        card.appendChild(rm);
      }

      const del = document.createElement('button');
      del.className = 'exercise-delete';
      del.title = `Remove from ${muscle}`;
      del.textContent = '×';
      del.addEventListener('click', () => removeExerciseFromGroup(exercise, muscle));
      card.appendChild(del);

      grid.appendChild(card);
    });

    section.appendChild(title);
    section.appendChild(grid);
    catalog.appendChild(section);
  });
}

// ---------- Workouts: tabs ----------

document.querySelectorAll('#view-workouts .tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#view-workouts .tab-btn').forEach((b) => {
      b.classList.toggle('active', b === btn);
    });
    document.querySelectorAll('#view-workouts .tab-panel').forEach((panel) => {
      panel.classList.toggle('active', panel.id === `workouts-${btn.dataset.tab}`);
    });

    if (btn.dataset.tab === 'splits') renderSplits();
    if (btn.dataset.tab === 'history') renderHistory();
  });
});

// ---------- Workouts: splits ----------

let splits = loadList('ezjournal-splits');
let openPickerId = null;

function makeEl(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function persistSplits() {
  storeItem('ezjournal-splits', JSON.stringify(splits));
}

function saveSplits() {
  persistSplits();
  renderSplits();
}

// Drops any exercise that has since been removed from the catalog.
function pruneSplits() {
  let changed = false;

  splits.forEach((split) => {
    const valid = split.exerciseIds.filter((id) => exercises.some((ex) => ex.id === id));
    if (valid.length !== split.exerciseIds.length) {
      split.exerciseIds = valid;
      changed = true;
    }
  });

  if (changed) persistSplits();
}

function renameSplit(split) {
  const newName = prompt('Rename split:', split.name);
  if (!newName || !newName.trim()) return;

  split.name = newName.trim();
  saveSplits();
}

function deleteSplit(split) {
  if (!confirm(`Delete "${split.name}"? This cannot be undone.`)) return;

  splits = splits.filter((s) => s.id !== split.id);
  if (openPickerId === split.id) openPickerId = null;
  saveSplits();
}

function toggleSplitExercise(split, exerciseId) {
  const index = split.exerciseIds.indexOf(exerciseId);

  if (index >= 0) {
    split.exerciseIds.splice(index, 1);
  } else {
    split.exerciseIds.push(exerciseId);
  }

  saveSplits();
}

document.getElementById('add-split-btn').addEventListener('click', () => {
  const name = prompt('Name your split (for example "Push Day"):');
  if (!name || !name.trim()) return;

  const split = { id: `split-${Date.now()}`, name: name.trim(), exerciseIds: [], timesDone: 0 };
  splits.push(split);
  openPickerId = split.id; // go straight to picking exercises
  saveSplits();
});

function renderSplits() {
  pruneSplits();

  // Forget an in-progress workout whose split was deleted.
  if (activeWorkout && !splits.some((s) => s.id === activeWorkout.splitId)) {
    activeWorkout = null;
    persistWorkout();
  }

  const list = document.getElementById('split-list');
  const scrollY = window.scrollY;
  list.innerHTML = '';

  if (splits.length === 0) {
    list.appendChild(makeEl('p', 'empty-goals-msg', 'No splits yet. Click "+ New split" to build your first one.'));
    return;
  }

  splits.forEach((split) => {
    const card = makeEl('div', 'split-card');

    // Name, counts, rename and delete
    const header = makeEl('div', 'split-card-header');
    const title = makeEl('div', 'split-title');
    const count = split.exerciseIds.length;
    const done = split.timesDone || 0;

    title.appendChild(makeEl('h3', '', split.name));
    title.appendChild(makeEl(
      'span',
      'split-meta',
      `${count} exercise${count === 1 ? '' : 's'} · Done ${done} time${done === 1 ? '' : 's'}`
    ));

    const actions = makeEl('div', 'delete-row-buttons');
    const renameBtn = makeEl('button', 'edit-btn', 'Rename');
    renameBtn.addEventListener('click', () => renameSplit(split));
    const deleteBtn = makeEl('button', 'delete-btn', 'Delete');
    deleteBtn.addEventListener('click', () => deleteSplit(split));
    actions.append(renameBtn, deleteBtn);

    header.append(title, actions);
    card.appendChild(header);

    // The exercises in this split
    const chips = makeEl('div', 'split-exercises');

    if (count === 0) {
      chips.appendChild(makeEl('span', 'split-empty', 'No exercises yet. Add some below.'));
    }

    split.exerciseIds.forEach((id) => {
      const exercise = exercises.find((ex) => ex.id === id);
      if (!exercise) return;

      const chip = makeEl('span', 'split-chip', exercise.name);
      const remove = makeEl('button', '', '×');
      remove.title = 'Remove from this split';
      remove.addEventListener('click', () => toggleSplitExercise(split, id));
      chip.appendChild(remove);
      chips.appendChild(chip);
    });

    card.appendChild(chips);

    // Start or resume a workout, and open the exercise picker
    const buttons = makeEl('div', 'split-buttons');

    const isActive = activeWorkout && activeWorkout.splitId === split.id;
    const startBtn = makeEl('button', 'toolbar-btn', isActive ? '▶ Resume workout' : '▶ Start workout');
    startBtn.addEventListener('click', () => startWorkout(split));

    const isOpen = openPickerId === split.id;
    const pickBtn = makeEl('button', 'toolbar-btn', isOpen ? 'Done' : '+ Add exercises');
    pickBtn.addEventListener('click', () => {
      openPickerId = isOpen ? null : split.id;
      renderSplits();
    });

    buttons.append(startBtn, pickBtn);
    card.appendChild(buttons);

    if (isOpen) {
      const picker = makeEl('div', 'split-picker');

      if (exercises.length === 0) {
        picker.appendChild(makeEl('p', 'empty-goals-msg', 'Your catalog is empty. Add exercises on the Exercises tab first.'));
      }

      MUSCLE_GROUPS.forEach((muscle) => {
        const group = exercises.filter((ex) => ex.muscles.includes(muscle));
        if (group.length === 0) return;

        const section = makeEl('div', 'picker-group');
        section.appendChild(makeEl('h4', 'picker-title', muscle));

        const row = makeEl('div', 'picker-chips');

        group.forEach((exercise) => {
          const included = split.exerciseIds.includes(exercise.id);
          const btn = makeEl(
            'button',
            `pick-chip${included ? ' in-split' : ''}`,
            `${included ? '✓ ' : ''}${exercise.name}`
          );
          btn.addEventListener('click', () => toggleSplitExercise(split, exercise.id));
          row.appendChild(btn);
        });

        section.appendChild(row);
        picker.appendChild(section);
      });

      card.appendChild(picker);
    }

    list.appendChild(card);
  });

  window.scrollTo(0, scrollY);
}

// ---------- Workouts: logging ----------

let workoutLogs = loadList('ezjournal-workout-logs');

// The workout you're in the middle of: { splitId, date, sets: { exerciseId: [{ weight, reps or seconds }] } }
let activeWorkout = loadObject('ezjournal-active-workout');

function saveWorkoutLogs() {
  storeItem('ezjournal-workout-logs', JSON.stringify(workoutLogs));
}

function persistWorkout() {
  if (activeWorkout) {
    storeItem('ezjournal-active-workout', JSON.stringify(activeWorkout));
  } else {
    try {
      localStorage.removeItem('ezjournal-active-workout');
    } catch (err) {
      // nothing to remove if the browser won't let us look
    }
  }
}

function formatShortDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Isometrics and stretches are counted in seconds. Everything else is counted in reps.
function isTimedExercise(exercise) {
  return exercise.muscles.includes('Isometrics') || exercise.muscles.includes('Stretches');
}

function formatSet(set) {
  if (set.seconds !== undefined) {
    return set.weight > 0 ? `${set.weight} × ${set.seconds}s` : `${set.seconds}s`;
  }

  return set.weight > 0 ? `${set.weight} × ${set.reps}` : `${set.reps} reps`;
}

// The most recent finished workout that included this exercise.
function getLastSession(exerciseId) {
  for (let i = workoutLogs.length - 1; i >= 0; i--) {
    const entry = workoutLogs[i].exercises.find((e) => e.exerciseId === exerciseId);
    if (entry && entry.sets.length > 0) {
      return { date: workoutLogs[i].date, sets: entry.sets };
    }
  }
  return null;
}

function startWorkout(split) {
  if (split.exerciseIds.length === 0) {
    alert('Add at least one exercise to this split first.');
    return;
  }

  if (activeWorkout && activeWorkout.splitId !== split.id) {
    const other = splits.find((s) => s.id === activeWorkout.splitId);
    const otherName = other ? other.name : 'another split';

    if (!confirm(`You have a workout in progress for "${otherName}". Discard it and start this one?`)) {
      return;
    }
    activeWorkout = null;
  }

  if (!activeWorkout) {
    activeWorkout = { splitId: split.id, date: getTodayKey(), sets: {} };
    persistWorkout();
  }

  renderWorkoutSession();
  showView('workout-session');
  window.scrollTo(0, 0);
}

function renderWorkoutSession() {
  const root = document.getElementById('workout-session');
  const scrollY = window.scrollY;
  root.innerHTML = '';

  const split = activeWorkout ? splits.find((s) => s.id === activeWorkout.splitId) : null;
  if (!split) {
    activeWorkout = null;
    persistWorkout();
    showView('workouts');
    renderSplits();
    return;
  }

  // Title, date, and the two big buttons
  const header = makeEl('div', 'session-header');
  const titleBox = makeEl('div');
  titleBox.appendChild(makeEl('h2', '', split.name));
  titleBox.appendChild(makeEl('p', 'session-date', formatDateLabel(activeWorkout.date)));

  const actions = makeEl('div', 'session-actions');
  const discardBtn = makeEl('button', 'toolbar-btn danger-btn', 'Discard');
  discardBtn.addEventListener('click', discardWorkout);
  const finishBtn = makeEl('button', 'toolbar-btn', '✓ Finish workout');
  finishBtn.addEventListener('click', finishWorkout);
  actions.append(discardBtn, finishBtn);

  header.append(titleBox, actions);
  root.appendChild(header);

  // One card per exercise in the split
  split.exerciseIds.forEach((id) => {
    const exercise = exercises.find((ex) => ex.id === id);
    if (!exercise) return;

    const timed = isTimedExercise(exercise);
    const field = timed ? 'seconds' : 'reps';

    if (!activeWorkout.sets[id]) activeWorkout.sets[id] = [];
    const sets = activeWorkout.sets[id];
    const last = getLastSession(id);

    const card = makeEl('div', 'session-exercise');
    card.appendChild(makeEl('h3', '', exercise.name));

    card.appendChild(makeEl(
      'p',
      'session-last',
      last
        ? `Last time (${formatShortDate(last.date)}): ${last.sets.map(formatSet).join(' · ')}`
        : 'First time logging this one.'
    ));

    const table = makeEl('div', 'set-table');

    if (sets.length > 0) {
      const head = makeEl('div', 'set-row set-head');
      head.append(
        makeEl('span', '', 'Set'),
        makeEl('span', '', 'Weight (lb)'),
        makeEl('span', '', timed ? 'Seconds' : 'Reps'),
        makeEl('span')
      );
      table.appendChild(head);
    }

    sets.forEach((set, i) => {
      const row = makeEl('div', 'set-row');
      row.appendChild(makeEl('span', 'set-number', String(i + 1)));

      const weight = document.createElement('input');
      weight.type = 'number';
      weight.min = '0';
      weight.step = 'any';
      weight.inputMode = 'decimal';
      weight.placeholder = 'lb';
      weight.value = set.weight === undefined ? '' : set.weight;
      weight.addEventListener('input', () => {
        set.weight = weight.value;
        persistWorkout();
      });

      const amount = document.createElement('input');
      amount.type = 'number';
      amount.min = '0';
      amount.step = '1';
      amount.inputMode = 'numeric';
      amount.placeholder = timed ? 'sec' : 'reps';
      amount.value = set[field] === undefined ? '' : set[field];
      amount.addEventListener('input', () => {
        set[field] = amount.value;
        persistWorkout();
      });

      const remove = makeEl('button', 'set-remove', '×');
      remove.title = 'Remove this set';
      remove.addEventListener('click', () => {
        sets.splice(i, 1);
        persistWorkout();
        renderWorkoutSession();
      });

      row.append(weight, amount, remove);
      table.appendChild(row);
    });

    card.appendChild(table);

    // A new set starts from the same set number last time. With no history,
    // it copies the set above it.
    const addSet = makeEl('button', 'toolbar-btn', '+ Add set');
    addSet.addEventListener('click', () => {
      const base =
        (last && last.sets[sets.length]) ||
        sets[sets.length - 1] ||
        (last && last.sets[last.sets.length - 1]) ||
        { weight: '' };

      sets.push({
        weight: String(base.weight === undefined ? '' : base.weight),
        [field]: String(base[field] === undefined ? '' : base[field])
      });
      persistWorkout();
      renderWorkoutSession();
    });
    card.appendChild(addSet);

    root.appendChild(card);
  });

  window.scrollTo(0, scrollY);
}

function finishWorkout() {
  const split = activeWorkout ? splits.find((s) => s.id === activeWorkout.splitId) : null;
  if (!split) return;

  const logged = [];

  split.exerciseIds.forEach((id) => {
    const exercise = exercises.find((ex) => ex.id === id);
    if (!exercise) return;

    const field = isTimedExercise(exercise) ? 'seconds' : 'reps';

    // A set only counts if it has reps (or seconds). Leave weight blank for bodyweight.
    const sets = (activeWorkout.sets[id] || [])
      .map((s) => ({ weight: Number(s.weight) || 0, [field]: Number(s[field]) || 0 }))
      .filter((s) => s[field] > 0);

    if (sets.length > 0) {
      logged.push({ exerciseId: id, name: exercise.name, sets });
    }
  });

  if (logged.length === 0) {
    alert('Log at least one set with reps or seconds before finishing.');
    return;
  }

  workoutLogs.push({
    id: `log-${Date.now()}`,
    splitId: split.id,
    splitName: split.name,
    date: activeWorkout.date,
    exercises: logged
  });
  split.timesDone = (split.timesDone || 0) + 1;

  activeWorkout = null;
  persistWorkout();
  saveWorkoutLogs();
  persistSplits();

  showView('workouts');
  renderSplits();
}

function discardWorkout() {
  if (!confirm('Discard this workout? Nothing you entered will be saved.')) return;

  activeWorkout = null;
  persistWorkout();
  showView('workouts');
  renderSplits();
}

// Leaving without finishing keeps your numbers. Come back with "Resume workout".
document.getElementById('back-to-splits').addEventListener('click', () => {
  showView('workouts');
  renderSplits();
});

// ---------- Workouts: history ----------

let openLogId = null;

function formatHistoryDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function deleteWorkoutLog(log) {
  if (!confirm(`Delete the ${log.splitName} workout from ${formatHistoryDate(log.date)}? This cannot be undone.`)) return;

  workoutLogs = workoutLogs.filter((l) => l.id !== log.id);
  saveWorkoutLogs();

  // Keep the split's "Done X times" count in step with its history.
  const split = splits.find((s) => s.id === log.splitId);
  if (split) {
    split.timesDone = Math.max(0, (split.timesDone || 0) - 1);
    persistSplits();
  }

  if (openLogId === log.id) openLogId = null;
  renderHistory();
}

function renderHistory() {
  const list = document.getElementById('history-list');
  const scrollY = window.scrollY;
  list.innerHTML = '';

  if (workoutLogs.length === 0) {
    list.appendChild(makeEl('p', 'empty-goals-msg', 'No workouts logged yet. Finish a workout and it will show up here.'));
    return;
  }

  // Newest first. Workouts on the same day stay in the order you finished them.
  const sorted = workoutLogs
    .slice()
    .reverse()
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  sorted.forEach((log) => {
    const totalSets = log.exercises.reduce((sum, e) => sum + e.sets.length, 0);
    const exerciseCount = log.exercises.length;
    const isOpen = openLogId === log.id;

    const card = makeEl('div', 'split-card history-card');

    const head = makeEl('div', 'split-card-header');
    const info = makeEl('div', 'split-title');
    info.appendChild(makeEl('h3', '', log.splitName));
    info.appendChild(makeEl(
      'span',
      'split-meta',
      `${formatHistoryDate(log.date)} · ${exerciseCount} exercise${exerciseCount === 1 ? '' : 's'} · ${totalSets} set${totalSets === 1 ? '' : 's'}`
    ));

    const actions = makeEl('div', 'delete-row-buttons');

    const toggle = makeEl('button', 'edit-btn', isOpen ? 'Hide' : 'View');
    toggle.addEventListener('click', () => {
      openLogId = isOpen ? null : log.id;
      renderHistory();
    });

    const del = makeEl('button', 'delete-btn', 'Delete');
    del.addEventListener('click', () => deleteWorkoutLog(log));

    actions.append(toggle, del);
    head.append(info, actions);
    card.appendChild(head);

    if (isOpen) {
      const body = makeEl('div', 'history-body');

      log.exercises.forEach((entry) => {
        const row = makeEl('div', 'history-exercise');
        row.appendChild(makeEl('strong', '', entry.name));
        row.appendChild(makeEl('span', '', entry.sets.map(formatSet).join(' · ')));
        body.appendChild(row);
      });

      card.appendChild(body);
    }

    list.appendChild(card);
  });

  window.scrollTo(0, scrollY);
}

// ---------- Closet ----------

const CLOSET_CATEGORIES = ['Headwear', 'Tops', 'Bottoms', 'Shoes', 'Accessories & Other'];

const CLOSET_ICONS = {
  'Headwear': '🧢',
  'Tops': '👕',
  'Bottoms': '👖',
  'Shoes': '👟',
  'Accessories & Other': '🕶️'
};

// Each item: { id, closet: 'current' | 'dream', category, name, photo }
let closetItems = loadList('ezjournal-closet');
let activeClosetTab = 'current';
let pendingPhoto = ''; // a photo you've picked but haven't added yet

const closetNameInput = document.getElementById('closet-name-input');
const closetCategorySelect = document.getElementById('closet-category-select');
const closetPhotoInput = document.getElementById('closet-photo-input');
const closetPhotoPreview = document.getElementById('closet-photo-preview');
const addClosetItemBtn = document.getElementById('add-closet-item-btn');

CLOSET_CATEGORIES.forEach((category) => {
  const option = document.createElement('option');
  option.value = category;
  option.textContent = category;
  closetCategorySelect.appendChild(option);
});

function saveCloset() {
  try {
    localStorage.setItem('ezjournal-closet', JSON.stringify(closetItems));
  } catch (err) {
    alert('Your browser storage is full, so this could not be saved. Try removing a few items.');
    return false;
  }

  renderCloset();
  return true;
}

// Photos are shrunk before saving so lots of them fit in the browser's storage.
function shrinkPhoto(file, maxSize = 500) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Could not read the file'));
    reader.onload = () => {
      const img = new Image();

      img.onerror = () => reject(new Error('Not a readable image'));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const width = Math.round(img.width * scale);
        const height = Math.round(img.height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff'; // see-through PNGs get a white background
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };

      img.src = reader.result;
    };

    reader.readAsDataURL(file);
  });
}

function renderPhotoPreview() {
  closetPhotoPreview.innerHTML = '';
  if (!pendingPhoto) return;

  const img = document.createElement('img');
  img.src = pendingPhoto;
  img.alt = 'Photo preview';

  const clear = makeEl('button', '', '×');
  clear.type = 'button';
  clear.title = 'Remove photo';
  clear.addEventListener('click', () => {
    pendingPhoto = '';
    renderPhotoPreview();
  });

  closetPhotoPreview.append(img, clear);
}

closetPhotoInput.addEventListener('change', async () => {
  const file = closetPhotoInput.files[0];
  if (!file) return;

  try {
    pendingPhoto = await shrinkPhoto(file);
  } catch (err) {
    pendingPhoto = '';
    alert("That photo couldn't be read. Try a JPG or PNG.");
  }

  closetPhotoInput.value = ''; // lets you pick the same file again later
  renderPhotoPreview();
});

function updateClosetAddButton() {
  const label = activeClosetTab === 'current' ? 'Current' : 'Dream';
  addClosetItemBtn.textContent = `+ Add to ${label} closet`;
}

document.querySelectorAll('#view-closet .tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    activeClosetTab = btn.dataset.tab;

    document.querySelectorAll('#view-closet .tab-btn').forEach((b) => {
      b.classList.toggle('active', b === btn);
    });
    document.querySelectorAll('#view-closet .tab-panel').forEach((panel) => {
      panel.classList.toggle('active', panel.id === `closet-${activeClosetTab}`);
    });

    updateClosetAddButton();
  });
});

function addClosetItem() {
  const name = closetNameInput.value.trim();

  if (!name) {
    alert('Please give the item a name.');
    return;
  }

  closetItems.push({
    id: `closet-${Date.now()}`,
    closet: activeClosetTab,
    category: closetCategorySelect.value,
    name,
    photo: pendingPhoto
  });

  if (!saveCloset()) {
    closetItems.pop(); // it didn't fit, so don't keep it in memory either
    return;
  }

  closetNameInput.value = '';
  pendingPhoto = '';
  renderPhotoPreview();
}

function deleteClosetItem(item) {
  const which = item.closet === 'current' ? 'current' : 'dream';
  if (!confirm(`Remove "${item.name}" from your ${which} closet?`)) return;

  closetItems = closetItems.filter((it) => it.id !== item.id);
  saveCloset();
}

addClosetItemBtn.addEventListener('click', addClosetItem);

closetNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addClosetItem();
});

// ---------- Closet: moving items around ----------

let draggedClosetId = null;

function clearDropMarkers() {
  document.querySelectorAll('.drop-before, .drop-after, .drop-target').forEach((el) => {
    el.classList.remove('drop-before', 'drop-after', 'drop-target');
  });
}

// Puts an item under a heading, just before another item (or at the end).
function moveClosetItem(itemId, category, beforeId) {
  const item = closetItems.find((it) => it.id === itemId);
  if (!item) return;

  const backupOrder = closetItems.slice();
  const backupCategory = item.category;

  closetItems = closetItems.filter((it) => it.id !== itemId);
  item.category = category;

  const at = beforeId ? closetItems.findIndex((it) => it.id === beforeId) : -1;
  if (at >= 0) {
    closetItems.splice(at, 0, item);
  } else {
    closetItems.push(item);
  }

  if (!saveCloset()) {
    item.category = backupCategory;
    closetItems = backupOrder;
  }
}

function dropOnCard(targetItem, after) {
  const movedId = draggedClosetId;
  draggedClosetId = null;
  if (!movedId || movedId === targetItem.id) return;

  const siblings = closetItems.filter(
    (it) => it.closet === targetItem.closet && it.category === targetItem.category && it.id !== movedId
  );
  const pos = siblings.findIndex((it) => it.id === targetItem.id);
  const beforeItem = after ? siblings[pos + 1] : siblings[pos];

  moveClosetItem(movedId, targetItem.category, beforeItem ? beforeItem.id : null);
}

// ---------- Closet: editing an item ----------

const closetEditOverlay = document.getElementById('closet-edit-overlay');
const closetEditName = document.getElementById('closet-edit-name');
const closetEditCategory = document.getElementById('closet-edit-category');
const closetEditPhotoInput = document.getElementById('closet-edit-photo-input');
const closetEditPreview = document.getElementById('closet-edit-preview');

let editingClosetItem = null;
let editingPhoto = '';

CLOSET_CATEGORIES.forEach((category) => {
  const option = document.createElement('option');
  option.value = category;
  option.textContent = category;
  closetEditCategory.appendChild(option);
});

function renderEditPhoto() {
  closetEditPreview.innerHTML = '';

  if (editingPhoto) {
    const img = document.createElement('img');
    img.src = editingPhoto;
    img.alt = 'Photo';
    closetEditPreview.appendChild(img);
  } else {
    closetEditPreview.appendChild(
      makeEl('div', 'closet-placeholder', CLOSET_ICONS[closetEditCategory.value] || '👕')
    );
  }
}

function openClosetEdit(item) {
  editingClosetItem = item;
  editingPhoto = item.photo || '';

  closetEditName.value = item.name;
  closetEditCategory.value = item.category;
  renderEditPhoto();

  closetEditOverlay.classList.add('open');
  closetEditName.focus();
}

function closeClosetEdit() {
  closetEditOverlay.classList.remove('open');
  editingClosetItem = null;
}

function saveClosetEdit() {
  const item = editingClosetItem;
  if (!item) return;

  const name = closetEditName.value.trim();
  if (!name) {
    alert('Please give the item a name.');
    return;
  }

  const backupOrder = closetItems.slice();
  const backup = { name: item.name, category: item.category, photo: item.photo };
  const newCategory = closetEditCategory.value;

  item.name = name;
  item.photo = editingPhoto;

  // Choosing a new heading puts the item at the end of that heading.
  if (newCategory !== item.category) {
    item.category = newCategory;
    closetItems = closetItems.filter((it) => it.id !== item.id);
    closetItems.push(item);
  }

  if (!saveCloset()) {
    Object.assign(item, backup);
    closetItems = backupOrder;
    return;
  }

  closeClosetEdit();
}

closetEditCategory.addEventListener('change', renderEditPhoto);

closetEditPhotoInput.addEventListener('change', async () => {
  const file = closetEditPhotoInput.files[0];
  if (!file) return;

  try {
    editingPhoto = await shrinkPhoto(file);
  } catch (err) {
    alert("That photo couldn't be read. Try a JPG or PNG.");
  }

  closetEditPhotoInput.value = '';
  renderEditPhoto();
});

document.getElementById('closet-edit-remove-photo').addEventListener('click', () => {
  editingPhoto = '';
  renderEditPhoto();
});

document.getElementById('closet-edit-save').addEventListener('click', saveClosetEdit);
document.getElementById('closet-edit-close').addEventListener('click', closeClosetEdit);

closetEditOverlay.addEventListener('click', (e) => {
  if (e.target === closetEditOverlay) closeClosetEdit();
});

closetEditName.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveClosetEdit();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && closetEditOverlay.classList.contains('open')) closeClosetEdit();
});

// ---------- Closet: drawing the cards ----------

function buildClosetCard(item) {
  const card = makeEl('div', 'closet-card');
  card.draggable = true;

  if (item.photo) {
    const img = document.createElement('img');
    img.src = item.photo;
    img.alt = item.name;
    img.draggable = false; // so the whole card is what you pick up
    card.appendChild(img);
  } else {
    card.appendChild(makeEl('div', 'closet-placeholder', CLOSET_ICONS[item.category] || '👕'));
  }

  card.appendChild(makeEl('span', 'closet-name', item.name));

  const edit = makeEl('button', 'closet-edit', '✎');
  edit.title = 'Edit';
  edit.addEventListener('click', () => openClosetEdit(item));
  card.appendChild(edit);

  const del = makeEl('button', 'closet-delete', '×');
  del.title = 'Remove';
  del.addEventListener('click', () => deleteClosetItem(item));
  card.appendChild(del);

  // Picking the card up
  card.addEventListener('dragstart', (e) => {
    draggedClosetId = item.id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.id);
    setTimeout(() => card.classList.add('dragging'), 0);
  });

  card.addEventListener('dragend', () => {
    draggedClosetId = null;
    card.classList.remove('dragging');
    clearDropMarkers();
  });

  // Hovering over another card shows which side it will land on
  card.addEventListener('dragover', (e) => {
    e.stopPropagation();
    if (!draggedClosetId || draggedClosetId === item.id) return;

    e.preventDefault();
    const rect = card.getBoundingClientRect();
    const after = e.clientX > rect.left + rect.width / 2;

    clearDropMarkers();
    card.classList.add(after ? 'drop-after' : 'drop-before');
  });

  card.addEventListener('drop', (e) => {
    e.stopPropagation();
    if (!draggedClosetId || draggedClosetId === item.id) return;

    e.preventDefault();
    const rect = card.getBoundingClientRect();
    dropOnCard(item, e.clientX > rect.left + rect.width / 2);
  });

  return card;
}

function renderCloset() {
  ['current', 'dream'].forEach((which) => {
    const panel = document.getElementById(`closet-${which}`);
    panel.innerHTML = '';

    CLOSET_CATEGORIES.forEach((category) => {
      const items = closetItems.filter((it) => it.closet === which && it.category === category);

      const section = makeEl('div', 'muscle-group');
      const title = makeEl('h3', 'muscle-title', category);
      title.appendChild(makeEl('span', 'muscle-count', String(items.length)));
      section.appendChild(title);

      if (items.length === 0) {
        section.appendChild(makeEl('div', 'closet-empty', 'Nothing here yet.'));
      } else {
        const grid = makeEl('div', 'closet-grid');
        items.forEach((item) => grid.appendChild(buildClosetCard(item)));
        section.appendChild(grid);
      }

      // Dropping anywhere else on a heading puts the item at the end of it
      section.addEventListener('dragover', (e) => {
        if (!draggedClosetId) return;

        e.preventDefault();
        clearDropMarkers();
        section.classList.add('drop-target');
      });

      section.addEventListener('drop', (e) => {
        if (!draggedClosetId) return;

        e.preventDefault();
        const movedId = draggedClosetId;
        draggedClosetId = null;
        moveClosetItem(movedId, category, null);
      });

      panel.appendChild(section);
    });
  });
}

renderCloset();
updateClosetAddButton();

// ---------- Recipes ----------

const RECIPE_CATEGORIES = ['Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Desserts'];

const RECIPE_ICONS = {
  'Breakfast': '🍳',
  'Lunch': '🥪',
  'Dinner': '🍝',
  'Snacks': '🍿',
  'Desserts': '🍰'
};

// Each recipe: { id, category, name, photo, recipe, notes }
let recipes = loadList('ezjournal-recipes');
let recipeFormTarget = null; // the recipe being edited, or null for a new one
let recipeFormPhoto = '';

const recipeFormOverlay = document.getElementById('recipe-form-overlay');
const recipeFormTitle = document.getElementById('recipe-form-title');
const recipeNameInput = document.getElementById('recipe-name-input');
const recipeCategorySelect = document.getElementById('recipe-category-select');
const recipePhotoInput = document.getElementById('recipe-photo-input');
const recipePhotoPreview = document.getElementById('recipe-photo-preview');
const recipeTextInput = document.getElementById('recipe-text-input');
const recipeNotesInput = document.getElementById('recipe-notes-input');
const recipeSaveBtn = document.getElementById('recipe-save-btn');

RECIPE_CATEGORIES.forEach((category) => {
  const option = document.createElement('option');
  option.value = category;
  option.textContent = category;
  recipeCategorySelect.appendChild(option);
});

function saveRecipes() {
  try {
    localStorage.setItem('ezjournal-recipes', JSON.stringify(recipes));
  } catch (err) {
    alert('Your browser storage is full, so this could not be saved. Try removing a few photos or recipes.');
    return false;
  }

  renderRecipes();
  return true;
}

function renderRecipePhoto() {
  recipePhotoPreview.innerHTML = '';

  if (recipeFormPhoto) {
    const img = document.createElement('img');
    img.src = recipeFormPhoto;
    img.alt = 'Photo';
    recipePhotoPreview.appendChild(img);
  } else {
    recipePhotoPreview.appendChild(
      makeEl('div', 'closet-placeholder', RECIPE_ICONS[recipeCategorySelect.value] || '🍽️')
    );
  }
}

function saveRecipeForm() {
  const name = recipeNameInput.value.trim();

  if (!name) {
    alert('Please give the recipe a name.');
    return;
  }

  const fields = {
    name,
    category: recipeCategorySelect.value,
    photo: recipeFormPhoto,
    recipe: recipeTextInput.value,
    notes: recipeNotesInput.value
  };

  if (recipeFormTarget) {
    const target = recipeFormTarget;
    const backup = { ...target };
    const backupOrder = recipes.slice();

    // Choosing a new heading puts the recipe at the end of that heading.
    const moved = fields.category !== target.category;
    Object.assign(target, fields);

    if (moved) {
      recipes = recipes.filter((r) => r.id !== target.id);
      recipes.push(target);
    }

    if (!saveRecipes()) {
      Object.assign(target, backup);
      recipes = backupOrder;
      return;
    }
  } else {
    recipes.push({ id: `recipe-${Date.now()}`, ...fields });

    if (!saveRecipes()) {
      recipes.pop();
      return;
    }
  }

  closeRecipeForm();
}

function deleteRecipe(recipe) {
  if (!confirm(`Remove "${recipe.name}" from your recipes?`)) return;

  recipes = recipes.filter((r) => r.id !== recipe.id);
  saveRecipes();
}

recipeCategorySelect.addEventListener('change', renderRecipePhoto);

recipePhotoInput.addEventListener('change', async () => {
  const file = recipePhotoInput.files[0];
  if (!file) return;

  try {
    recipeFormPhoto = await shrinkPhoto(file);
  } catch (err) {
    alert("That photo couldn't be read. Try a JPG or PNG.");
  }

  recipePhotoInput.value = '';
  renderRecipePhoto();
});

document.getElementById('recipe-remove-photo').addEventListener('click', () => {
  recipeFormPhoto = '';
  renderRecipePhoto();
});

document.getElementById('add-recipe-btn').addEventListener('click', () => openRecipeForm());
document.getElementById('recipe-save-btn').addEventListener('click', saveRecipeForm);
document.getElementById('recipe-form-close').addEventListener('click', closeRecipeForm);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && recipeFormOverlay.classList.contains('open')) closeRecipeForm();
});

// ---------- Recipes: reading and editing ----------

let recipeFormFromView = false;
let viewedRecipe = null;

const recipeViewOverlay = document.getElementById('recipe-view-overlay');
const recipeViewBody = document.getElementById('recipe-view-body');

function openRecipeForm(recipe = null, fromView = false) {
  recipeFormTarget = recipe;
  recipeFormFromView = fromView && !!recipe;
  recipeFormPhoto = recipe ? recipe.photo || '' : '';

  recipeFormTitle.textContent = recipe ? 'Edit recipe' : 'New recipe';
  recipeSaveBtn.textContent = recipe ? 'Save changes' : 'Add recipe';
  recipeNameInput.value = recipe ? recipe.name : '';
  recipeCategorySelect.value = recipe ? recipe.category : RECIPE_CATEGORIES[0];
  recipeTextInput.value = recipe ? recipe.recipe || '' : '';
  recipeNotesInput.value = recipe ? recipe.notes || '' : '';
  renderRecipePhoto();

  recipeFormOverlay.classList.add('open');
  recipeNameInput.focus();
}

// Saving or cancelling an edit that started in the popup brings the popup back.
function closeRecipeForm() {
  const returnTo = recipeFormFromView ? recipeFormTarget : null;

  recipeFormOverlay.classList.remove('open');
  recipeFormTarget = null;
  recipeFormFromView = false;

  if (returnTo && recipes.some((r) => r.id === returnTo.id)) {
    openRecipeView(returnTo);
  }
}

function addRecipeViewText(heading, text, emptyMessage) {
  const value = text || '';
  const hasText = value.trim() !== '';

  recipeViewBody.appendChild(makeEl('h3', 'recipe-view-heading', heading));
  recipeViewBody.appendChild(makeEl(
    'div',
    hasText ? 'recipe-view-text' : 'recipe-view-text recipe-view-empty',
    hasText ? value : emptyMessage
  ));
}

function openRecipeView(recipe) {
  viewedRecipe = recipe;
  recipeViewBody.innerHTML = '';

  if (recipe.photo) {
    const img = document.createElement('img');
    img.className = 'recipe-view-photo';
    img.src = recipe.photo;
    img.alt = recipe.name;
    recipeViewBody.appendChild(img);
  }

  recipeViewBody.appendChild(makeEl('span', 'recipe-view-tag', recipe.category));
  recipeViewBody.appendChild(makeEl('h2', '', recipe.name));

  addRecipeViewText('Recipe', recipe.recipe, 'No recipe written yet.');
  addRecipeViewText('Notes', recipe.notes, 'No notes yet.');

  recipeViewOverlay.classList.add('open');
  recipeViewOverlay.querySelector('.recipe-view-modal').scrollTop = 0;
}

function closeRecipeView() {
  recipeViewOverlay.classList.remove('open');
  viewedRecipe = null;
}

document.getElementById('recipe-view-close').addEventListener('click', closeRecipeView);

recipeViewOverlay.addEventListener('click', (e) => {
  if (e.target === recipeViewOverlay) closeRecipeView();
});

document.getElementById('recipe-view-edit').addEventListener('click', () => {
  const recipe = viewedRecipe;
  if (!recipe) return;

  closeRecipeView();
  openRecipeForm(recipe, true);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && recipeViewOverlay.classList.contains('open')) closeRecipeView();
});

// ---------- Recipes: moving cards around ----------

let draggedRecipeId = null;

// Puts a recipe under a heading, just before another recipe (or at the end).
function moveRecipe(recipeId, category, beforeId) {
  const recipe = recipes.find((r) => r.id === recipeId);
  if (!recipe) return;

  const backupOrder = recipes.slice();
  const backupCategory = recipe.category;

  recipes = recipes.filter((r) => r.id !== recipeId);
  recipe.category = category;

  const at = beforeId ? recipes.findIndex((r) => r.id === beforeId) : -1;
  if (at >= 0) {
    recipes.splice(at, 0, recipe);
  } else {
    recipes.push(recipe);
  }

  if (!saveRecipes()) {
    recipe.category = backupCategory;
    recipes = backupOrder;
  }
}

function dropOnRecipeCard(target, after) {
  const movedId = draggedRecipeId;
  draggedRecipeId = null;
  if (!movedId || movedId === target.id) return;

  const siblings = recipes.filter((r) => r.category === target.category && r.id !== movedId);
  const pos = siblings.findIndex((r) => r.id === target.id);
  const beforeRecipe = after ? siblings[pos + 1] : siblings[pos];

  moveRecipe(movedId, target.category, beforeRecipe ? beforeRecipe.id : null);
}

function buildRecipeCard(recipe) {
  const card = makeEl('div', 'closet-card recipe-card');
  card.draggable = true;

  if (recipe.photo) {
    const img = document.createElement('img');
    img.src = recipe.photo;
    img.alt = recipe.name;
    img.draggable = false; // so the whole card is what you pick up
    card.appendChild(img);
  } else {
    card.appendChild(makeEl('div', 'closet-placeholder', RECIPE_ICONS[recipe.category] || '🍽️'));
  }

  card.appendChild(makeEl('span', 'closet-name', recipe.name));

  const edit = makeEl('button', 'closet-edit', '✎');
  edit.title = 'Edit';
  edit.addEventListener('click', (e) => {
    e.stopPropagation();
    openRecipeForm(recipe);
  });
  card.appendChild(edit);

  const del = makeEl('button', 'closet-delete', '×');
  del.title = 'Remove';
  del.addEventListener('click', (e) => {
    e.stopPropagation();
    deleteRecipe(recipe);
  });
  card.appendChild(del);

  card.addEventListener('click', () => openRecipeView(recipe));

  // Picking the card up
  card.addEventListener('dragstart', (e) => {
    draggedRecipeId = recipe.id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', recipe.id);
    setTimeout(() => card.classList.add('dragging'), 0);
  });

  card.addEventListener('dragend', () => {
    draggedRecipeId = null;
    card.classList.remove('dragging');
    clearDropMarkers();
  });

  // Hovering over another card shows which side it will land on
  card.addEventListener('dragover', (e) => {
    e.stopPropagation();
    if (!draggedRecipeId || draggedRecipeId === recipe.id) return;

    e.preventDefault();
    const rect = card.getBoundingClientRect();
    const after = e.clientX > rect.left + rect.width / 2;

    clearDropMarkers();
    card.classList.add(after ? 'drop-after' : 'drop-before');
  });

  card.addEventListener('drop', (e) => {
    e.stopPropagation();
    if (!draggedRecipeId || draggedRecipeId === recipe.id) return;

    e.preventDefault();
    const rect = card.getBoundingClientRect();
    dropOnRecipeCard(recipe, e.clientX > rect.left + rect.width / 2);
  });

  return card;
}

function renderRecipes() {
  const book = document.getElementById('recipe-book');
  book.innerHTML = '';

  RECIPE_CATEGORIES.forEach((category) => {
    const items = recipes.filter((r) => r.category === category);

    const section = makeEl('div', 'muscle-group');
    const title = makeEl('h3', 'muscle-title', category);
    title.appendChild(makeEl('span', 'muscle-count', String(items.length)));
    section.appendChild(title);

    if (items.length === 0) {
      section.appendChild(makeEl('div', 'closet-empty', 'Nothing here yet.'));
    } else {
      const grid = makeEl('div', 'closet-grid');
      items.forEach((recipe) => grid.appendChild(buildRecipeCard(recipe)));
      section.appendChild(grid);
    }

    // Dropping anywhere else on a heading puts the recipe at the end of it
    section.addEventListener('dragover', (e) => {
      if (!draggedRecipeId) return;

      e.preventDefault();
      clearDropMarkers();
      section.classList.add('drop-target');
    });

    section.addEventListener('drop', (e) => {
      if (!draggedRecipeId) return;

      e.preventDefault();
      const movedId = draggedRecipeId;
      draggedRecipeId = null;
      moveRecipe(movedId, category, null);
    });

    book.appendChild(section);
  });
}

renderRecipes();

// ---------- Water tracker ----------

// Drinks are saved in milliliters, so you can switch units any time
// and nothing you logged changes.
const WATER_UNITS = {
  oz:   { label: 'fl oz', ml: 29.5735, quick: [8, 12, 16] },
  cups: { label: 'cups',  ml: 236.588, quick: [0.5, 1, 2] },
  gal:  { label: 'gal',   ml: 3785.41, quick: [0.25, 0.5, 1] },
  ml:   { label: 'mL',    ml: 1,       quick: [250, 500, 750] },
  l:    { label: 'L',     ml: 1000,    quick: [0.25, 0.5, 1] }
};

function formatWater(ml, unitKey) {
  const value = ml / WATER_UNITS[unitKey].ml;
  const precision = ['l', 'cups', 'gal'].includes(unitKey) ? 100 : 10;
  return String(Math.round(value * precision) / precision);
}

function fillWaterUnitSelect(select, selectedKey) {
  Object.keys(WATER_UNITS).forEach((key) => {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = WATER_UNITS[key].label;
    select.appendChild(option);
  });

  select.value = selectedKey;
}

function drawWaterBottle(canvas, fraction, phase = 0, slosh = 0) {
  const ctx = canvas.getContext('2d');
  const colors = getThemeColors();

  // The bottle is drawn on an 80 by 150 grid. On phones and tablets the canvas has more
  // pixels than that, so the same drawing is scaled up and stays sharp.
  const W = 80;
  const H = 150;
  const scale = canvas.width / W;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  const BOTTOM = 146; // the floor of the bottle
  const TOP = 22;     // a full bottle fills up into the neck
  const level = BOTTOM - (BOTTOM - TOP) * Math.min(1, Math.max(0, fraction));

  ctx.clearRect(0, 0, W, H);

  function bottlePath() {
    ctx.beginPath();
    ctx.moveTo(30, 16);
    ctx.lineTo(50, 16);
    ctx.lineTo(50, 30);
    ctx.quadraticCurveTo(72, 36, 72, 58);
    ctx.lineTo(72, 126);
    ctx.quadraticCurveTo(72, 146, 52, 146);
    ctx.lineTo(28, 146);
    ctx.quadraticCurveTo(8, 146, 8, 126);
    ctx.lineTo(8, 58);
    ctx.quadraticCurveTo(8, 36, 30, 30);
    ctx.closePath();
  }

  // The empty bottle
  bottlePath();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.fill();

  // Everything inside the bottle is clipped to its shape
  ctx.save();
  bottlePath();
  ctx.clip();

  if (fraction > 0) {
    // The surface ripples. While the water is moving it sloshes more.
    const waveHeight = 2 + slosh * 3;

    ctx.beginPath();
    ctx.moveTo(0, level);
    for (let x = 0; x <= W; x += 4) {
      ctx.lineTo(x, level + Math.sin((x / W) * Math.PI * 3 + phase) * waveHeight);
    }
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fillStyle = '#4aa8e8';
    ctx.fill();
  }

  // Marks at 25%, 50% and 75%
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = 2;
  [0.25, 0.5, 0.75].forEach((mark) => {
    const y = BOTTOM - (BOTTOM - TOP) * mark;
    ctx.beginPath();
    ctx.moveTo(60, y);
    ctx.lineTo(72, y);
    ctx.stroke();
  });

  // A little shine
  ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.fillRect(15, 62, 5, 64);
  ctx.restore();

  // Outline and cap
  bottlePath();
  ctx.lineWidth = 3;
  ctx.strokeStyle = colors.bg;
  ctx.stroke();

  ctx.fillStyle = colors.bg;
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(27, 3, 26, 13, 3);
  } else {
    ctx.rect(27, 3, 26, 13);
  }
  ctx.fill();
}

// Remembers how full the bottle was, so it can glide from there to the new level.
let lastWaterView = { journal: null, date: '', fraction: 0 };

function animateWaterBottle(canvas, fromFraction, toFraction) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reducedMotion || fromFraction === toFraction) {
    drawWaterBottle(canvas, toFraction);
    return;
  }

  const duration = 1000;
  const start = performance.now();

  function frame(now) {
    // If the tracker was redrawn, a newer animation has taken over
    if (!canvas.isConnected) return;

    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    const current = fromFraction + (toFraction - fromFraction) * eased;

    drawWaterBottle(canvas, current, now / 180, 1 - t);

    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      drawWaterBottle(canvas, toFraction);
    }
  }

  drawWaterBottle(canvas, fromFraction);
  requestAnimationFrame(frame);
}

function renderWaterTracker(journal, box) {
  box.innerHTML = '';

  if (!WATER_UNITS[journal.waterUnit]) journal.waterUnit = 'oz';

  // First time: pick a goal and the unit you want to count in
  if (!journal.waterGoalMl) {
    box.innerHTML = `
      <span>Set a daily water goal</span>
      <div class="calorie-inputs">
        <input type="number" id="water-goal-input" min="0" step="any" placeholder="e.g. 64">
        <select class="water-unit-select" id="water-goal-unit"></select>
      </div>
      <button id="set-water-goal-btn">Set</button>
    `;

    const goalUnitSelect = box.querySelector('#water-goal-unit');
    fillWaterUnitSelect(goalUnitSelect, journal.waterUnit);

    box.querySelector('#set-water-goal-btn').addEventListener('click', () => {
      const value = parseFloat(box.querySelector('#water-goal-input').value);

      if (!(value > 0)) {
        alert('Please enter a valid water goal.');
        return;
      }

      journal.waterUnit = goalUnitSelect.value;
      journal.waterGoalMl = value * WATER_UNITS[goalUnitSelect.value].ml;
      saveJournals();
      renderWaterTracker(journal, box);
    });

    return;
  }

  if (!journal.entries[currentViewDate]) {
    journal.entries[currentViewDate] = {};
  }
  const entry = journal.entries[currentViewDate];
  if (!Array.isArray(entry.water)) entry.water = [];

  const unitKey = journal.waterUnit;
  const unit = WATER_UNITS[unitKey];
  const drankMl = entry.water.reduce((sum, ml) => sum + ml, 0);
  const fraction = drankMl / journal.waterGoalMl;
  const leftMl = Math.max(0, journal.waterGoalMl - drankMl);

  box.innerHTML = `
    <canvas id="water-bottle" width="80" height="150"></canvas>
    <div class="calorie-stats">
      <span>${formatWater(drankMl, unitKey)} of ${formatWater(journal.waterGoalMl, unitKey)} ${unit.label} (${Math.round(fraction * 100)}%)</span>
      <span>${fraction >= 1 ? 'Goal reached! 🎉' : `${formatWater(leftMl, unitKey)} ${unit.label} to go`}</span>
    </div>
    <div class="water-quick"></div>
    <div class="calorie-inputs">
      <input type="number" id="water-add-input" min="0" step="any" placeholder="Amount">
      <select class="water-unit-select" id="water-unit-select" title="Unit"></select>
      <button id="water-add-btn">Add</button>
    </div>
    <div class="water-links">
      <button id="water-undo-btn">↶ Undo last</button>
      <button id="water-goal-btn">✎ Change goal</button>
    </div>
  `;

  // Sharper bottle on phones and tablets: more pixels, shown at the same size
  const bottleCanvas = box.querySelector('#water-bottle');
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 3);
  bottleCanvas.width = Math.round(80 * pixelRatio);
  bottleCanvas.height = Math.round(150 * pixelRatio);
  bottleCanvas.style.width = '80px';
  bottleCanvas.style.height = '150px';

  function logWater(amountInUnit) {
    entry.water.push(amountInUnit * unit.ml);
    saveJournals();
    renderWaterTracker(journal, box);
  }

  // One-tap amounts for the unit you're using
  const quick = box.querySelector('.water-quick');
  unit.quick.forEach((amount) => {
    const btn = document.createElement('button');
    btn.textContent = `+${amount}`;
    btn.title = `Add ${amount} ${unit.label}`;
    btn.addEventListener('click', () => logWater(amount));
    quick.appendChild(btn);
  });

  // Switching units converts everything on screen
  const unitSelect = box.querySelector('#water-unit-select');
  fillWaterUnitSelect(unitSelect, unitKey);
  unitSelect.addEventListener('change', () => {
    journal.waterUnit = unitSelect.value;
    saveJournals();
    renderWaterTracker(journal, box);
  });

  const addInput = box.querySelector('#water-add-input');

  function addTyped() {
    const value = parseFloat(addInput.value);
    if (!(value > 0)) return;
    logWater(value);
  }

  box.querySelector('#water-add-btn').addEventListener('click', addTyped);
  addInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addTyped();
  });

  box.querySelector('#water-undo-btn').addEventListener('click', () => {
    if (entry.water.length === 0) return;

    entry.water.pop();
    saveJournals();
    renderWaterTracker(journal, box);
  });

  box.querySelector('#water-goal-btn').addEventListener('click', () => {
    const answer = prompt(`New daily water goal (${unit.label}):`, formatWater(journal.waterGoalMl, unitKey));
    const value = parseFloat(answer);

    if (!(value > 0)) return; // cancelled or not a number

    journal.waterGoalMl = value * unit.ml;
    saveJournals();
    renderWaterTracker(journal, box);
  });

  const level = Math.min(fraction, 1);
  const sameView = lastWaterView.journal === journal && lastWaterView.date === currentViewDate;

  animateWaterBottle(bottleCanvas, sameView ? lastWaterView.fraction : 0, level);
  lastWaterView = { journal, date: currentViewDate, fraction: level };
}

// ---------- Moving cards earlier or later ----------
// Tap buttons for putting closet items and recipes in order, for screens where dragging is awkward.

// Swaps a card with its neighbor under the same heading. Gives back false if there's nowhere to go.
function nudge(list, item, inSameGroup, step) {
  const group = list.filter(inSameGroup);
  const position = group.indexOf(item);
  const neighbor = position < 0 ? null : group[position + step];
  if (!neighbor) return false;

  const a = list.indexOf(item);
  const b = list.indexOf(neighbor);
  [list[a], list[b]] = [list[b], list[a]];
  return true;
}

// Closet items
const closetGroupOf = (item) => (it) => it.closet === item.closet && it.category === item.category;

function refreshClosetMove() {
  const item = editingClosetItem;
  if (!item) return;

  const group = closetItems.filter(closetGroupOf(item));
  const position = group.indexOf(item);
  const headingChanged = closetEditCategory.value !== item.category;

  document.getElementById('closet-move-label').textContent = headingChanged
    ? 'Save first to move it to the new heading, then you can reorder it'
    : `Order: ${position + 1} of ${group.length}`;
  document.getElementById('closet-move-earlier').disabled = headingChanged || position <= 0;
  document.getElementById('closet-move-later').disabled = headingChanged || position >= group.length - 1;
}

function moveClosetCard(step) {
  const item = editingClosetItem;
  if (!item) return;

  const backup = closetItems.slice();
  if (!nudge(closetItems, item, closetGroupOf(item), step)) return;

  if (!saveCloset()) closetItems = backup; // it didn't fit, so keep the old order
  refreshClosetMove();
}

document.getElementById('closet-move-earlier').addEventListener('click', () => moveClosetCard(-1));
document.getElementById('closet-move-later').addEventListener('click', () => moveClosetCard(1));
closetEditCategory.addEventListener('change', refreshClosetMove);

// Keeps the buttons right whenever the edit window opens
new MutationObserver(refreshClosetMove).observe(closetEditOverlay, { attributes: true, attributeFilter: ['class'] });

// Recipes
const recipeGroupOf = (recipe) => (r) => r.category === recipe.category;

function refreshRecipeMove() {
  const recipe = recipeFormTarget;
  const row = document.getElementById('recipe-move-row');

  // A recipe that hasn't been added yet has no place to move
  row.hidden = !recipe;
  if (!recipe) return;

  const group = recipes.filter(recipeGroupOf(recipe));
  const position = group.indexOf(recipe);
  const headingChanged = recipeCategorySelect.value !== recipe.category;

  document.getElementById('recipe-move-label').textContent = headingChanged
    ? 'Save first to move it to the new heading, then you can reorder it'
    : `Order: ${position + 1} of ${group.length}`;
  document.getElementById('recipe-move-earlier').disabled = headingChanged || position <= 0;
  document.getElementById('recipe-move-later').disabled = headingChanged || position >= group.length - 1;
}

function moveRecipeCard(step) {
  const recipe = recipeFormTarget;
  if (!recipe) return;

  const backup = recipes.slice();
  if (!nudge(recipes, recipe, recipeGroupOf(recipe), step)) return;

  if (!saveRecipes()) recipes = backup; // it didn't fit, so keep the old order
  refreshRecipeMove();
}

document.getElementById('recipe-move-earlier').addEventListener('click', () => moveRecipeCard(-1));
document.getElementById('recipe-move-later').addEventListener('click', () => moveRecipeCard(1));
recipeCategorySelect.addEventListener('change', refreshRecipeMove);

new MutationObserver(refreshRecipeMove).observe(recipeFormOverlay, { attributes: true, attributeFilter: ['class'] });

// ---------- About popup ----------

const aboutOverlay = document.getElementById('about-overlay');

function openAbout() {
  aboutOverlay.classList.add('open');
  aboutOverlay.querySelector('.about-body').scrollTop = 0;
}

function closeAbout() {
  aboutOverlay.classList.remove('open');
  storeItem('ezjournal-about-seen', '1');
}

document.getElementById('open-about-btn').addEventListener('click', () => {
  settingsOverlay.classList.remove('open');
  openAbout();
});

document.getElementById('about-close').addEventListener('click', closeAbout);
document.getElementById('about-ok').addEventListener('click', closeAbout);

aboutOverlay.addEventListener('click', (e) => {
  if (e.target === aboutOverlay) closeAbout();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && aboutOverlay.classList.contains('open')) closeAbout();
});

// It shows once, the first time someone opens the app on a device
if (!readItem('ezjournal-about-seen')) openAbout();

// ---------- Start up ----------

updateEmptyState();
renderJournalGrid();
renderHomeSummary();
renderBoardGrid();
renderExerciseCatalog();