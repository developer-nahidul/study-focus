(() => {
  "use strict";

  const STORAGE_KEY = "deepFocusTracker.v1";
  const DEFAULT_SETTINGS = { focus: 25, short: 5, long: 15, sessionsPerCycle: 4, autoBreaks: false, soundAlerts: true };
  const LEVELS = [
    { level: 1, title: "Focus Beginner", subtitle: "Every expert starts with one focused minute.", xp: 0, goal: 60, description: "Start building your focus habit.", icon: "✧" },
    { level: 2, title: "Focus Explorer", subtitle: "You are learning to protect your attention.", xp: 60, goal: 180, description: "Record 60 focus minutes to unlock this level.", icon: "◈" },
    { level: 3, title: "Deep Worker", subtitle: "You are making meaningful progress.", xp: 180, goal: 420, description: "Reach 180 cumulative focus minutes.", icon: "✦" },
    { level: 4, title: "Focus Champion", subtitle: "Consistency is becoming your superpower.", xp: 420, goal: 900, description: "Reach 420 cumulative focus minutes.", icon: "♜" },
    { level: 5, title: "Focus Master", subtitle: "You have built a powerful practice of deep work.", xp: 900, goal: 1500, description: "Reach 900 cumulative focus minutes.", icon: "★" },
    { level: 6, title: "Deep Focus Legend", subtitle: "Your commitment to focused work stands out.", xp: 1500, goal: 1500, description: "Reach 1,500 cumulative focus minutes.", icon: "✹" }
  ];
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const dateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
  const safeId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { tasks: [], sessions: [], settings: { ...DEFAULT_SETTINGS }, completedFocusCount: 0 };
      const parsed = JSON.parse(raw);
      return {
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
        completedFocusCount: Number(parsed.completedFocusCount) || 0
      };
    } catch (error) {
      console.warn("Could not load saved focus data:", error);
      return { tasks: [], sessions: [], settings: { ...DEFAULT_SETTINGS }, completedFocusCount: 0 };
    }
  }

  let state = loadState();
  let mode = "focus";
  let remainingSeconds = state.settings.focus * 60;
  let intervalId = null;
  let endAt = null;
  let running = false;
  let soundEnabled = true;
  let taskFilter = "all";
  let sessionCountInCycle = 0;
  let toastTimeout;

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (error) { showToast("Could not save locally. Check browser storage."); }
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove("show"), 2600);
  }

  function formatTime(seconds) {
    const safe = Math.max(0, Math.ceil(seconds));
    return `${String(Math.floor(safe / 60)).padStart(2,"0")}:${String(safe % 60).padStart(2,"0")}`;
  }

  function modeDuration(currentMode = mode) {
    return Number(state.settings[currentMode]) * 60;
  }

  function dateLabel(date, options) {
    return new Intl.DateTimeFormat(undefined, options).format(date);
  }

  function setView(viewName) {
    const names = { dashboard: "Overview", tasks: "My tasks", analytics: "Analytics", settings: "Settings" };
    $$(".view").forEach(view => view.classList.toggle("active-view", view.id === `${viewName}View`));
    $$(".nav-item[data-view]").forEach(button => button.classList.toggle("active", button.dataset.view === viewName));
    $("#breadcrumbCurrent").textContent = names[viewName] || "Overview";
    $("#sidebar").classList.remove("open");
    if (viewName === "analytics") renderAnalytics();
    if (viewName === "tasks") renderAllTasks();
    if (viewName === "settings") populateSettings();
  }

  function todaySessions() {
    return state.sessions.filter(session => session.date === dateKey() && session.type === "focus");
  }

  function minutesForDate(key) {
    return state.sessions.filter(session => session.date === key && session.type === "focus").reduce((sum, session) => sum + session.minutes, 0);
  }

  function calculateStreak() {
    const activeDates = new Set(state.sessions.filter(session => session.type === "focus").map(session => session.date));
    let streak = 0;
    const cursor = new Date();
    if (!activeDates.has(dateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
    while (activeDates.has(dateKey(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  function updateHeader() {
    const now = new Date();
    $("#todayLabel").textContent = dateLabel(now, { weekday: "short", month: "short", day: "numeric" });
    $("#longDate").textContent = dateLabel(now, { weekday: "long", month: "short", day: "numeric" });
  }

  function renderStats() {
    const focusToday = todaySessions();
    const todayMinutes = focusToday.reduce((sum, session) => sum + session.minutes, 0);
    const complete = state.tasks.filter(task => task.completed).length;
    $("#todayMinutes").textContent = todayMinutes;
    $("#todaySessions").textContent = focusToday.length;
    $("#completedTasks").textContent = complete;
    $("#totalTasks").textContent = state.tasks.length;
    $("#streakDays").textContent = calculateStreak();
    $("#allTimeMinutes").textContent = state.sessions.filter(s => s.type === "focus").reduce((sum,s) => sum + s.minutes, 0);
    $("#allTimeSessions").textContent = state.sessions.filter(s => s.type === "focus").length;
    $("#allTimeTasks").textContent = complete;
    $("#navTaskCount").textContent = state.tasks.filter(t => !t.completed).length;
    $("#sessionCount").textContent = `${state.completedFocusCount} completed`;
  }

  function renderTaskOptions() {
    const select = $("#focusTask");
    const selected = select.value;
    const openTasks = state.tasks.filter(task => !task.completed);
    select.innerHTML = '<option value="">Choose a task (optional)</option>';
    openTasks.forEach(task => {
      const option = document.createElement("option");
      option.value = task.id;
      option.textContent = task.title;
      select.append(option);
    });
    if (openTasks.some(task => task.id === selected)) select.value = selected;
  }

  function createTask(title, priority = "medium") {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    state.tasks.unshift({ id: safeId(), title: cleanTitle, priority, completed: false, createdAt: new Date().toISOString(), completedAt: null });
    saveState();
    renderEverything();
    showToast("Task added to your list.");
  }

  function toggleTask(id) {
    const task = state.tasks.find(item => item.id === id);
    if (!task) return;
    task.completed = !task.completed;
    task.completedAt = task.completed ? new Date().toISOString() : null;
    saveState();
    renderEverything();
    showToast(task.completed ? "Nice work — task completed!" : "Task marked as active.");
  }

  function deleteTask(id) {
    state.tasks = state.tasks.filter(task => task.id !== id);
    if ($("#focusTask").value === id) $("#focusTask").value = "";
    saveState();
    renderEverything();
    showToast("Task deleted.");
  }

  function makeTaskRow(task, detailed = false) {
    const row = document.createElement("div");
    row.className = `task-row${task.completed ? " done" : ""}`;
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox"; checkbox.className = "task-check"; checkbox.checked = task.completed;
    checkbox.setAttribute("aria-label", `Mark ${task.title} ${task.completed ? "active" : "complete"}`);
    checkbox.addEventListener("change", () => toggleTask(task.id));
    const name = document.createElement("span"); name.className = "task-name"; name.textContent = task.title; name.title = task.title;
    const dot = document.createElement("span"); dot.className = `priority-dot priority-${task.priority}`; dot.title = `${task.priority} priority`;
    row.append(checkbox, name);
    if (detailed) {
      const meta = document.createElement("span"); meta.className = "task-meta";
      const priority = document.createElement("span"); priority.className = `priority-label ${task.priority}`; priority.textContent = `${task.priority} priority`;
      meta.append(priority); row.append(meta);
    } else row.append(dot);
    const del = document.createElement("button"); del.className = "delete-task"; del.type = "button"; del.textContent = "×"; del.title = "Delete task"; del.setAttribute("aria-label", `Delete ${task.title}`);
    del.addEventListener("click", () => deleteTask(task.id));
    row.append(del);
    return row;
  }

  function renderDashboardTasks() {
    const list = $("#dashboardTaskList");
    list.replaceChildren();
    const tasks = state.tasks.slice(0, 5);
    tasks.forEach(task => list.append(makeTaskRow(task)));
    $("#dashboardEmpty").classList.toggle("hidden", tasks.length > 0);
    list.classList.toggle("hidden", tasks.length === 0);
    const done = state.tasks.filter(task => task.completed).length;
    $("#taskProgressText").textContent = `${done} of ${state.tasks.length} completed`;
    $("#taskProgressBar").style.width = `${state.tasks.length ? done / state.tasks.length * 100 : 0}%`;
  }

  function renderAllTasks() {
    const list = $("#allTasksList");
    list.replaceChildren();
    const filtered = state.tasks.filter(task => taskFilter === "all" || (taskFilter === "active" && !task.completed) || (taskFilter === "completed" && task.completed));
    filtered.forEach(task => list.append(makeTaskRow(task, true)));
    $("#allTasksEmpty").classList.toggle("hidden", filtered.length > 0);
    list.classList.toggle("hidden", filtered.length === 0);
    $("#allTaskCount").textContent = `${filtered.length} ${filtered.length === 1 ? "task" : "tasks"}`;
  }

  function renderChart(container, days, large = false) {
    container.replaceChildren();
    const max = Math.max(30, ...days.map(day => day.minutes));
    days.forEach(day => {
      const col = document.createElement("div");
      col.className = `bar-column${day.key === dateKey() ? " today" : ""}`;
      const track = document.createElement("div"); track.className = "bar-track";
      const fill = document.createElement("div"); fill.className = "bar-fill";
      fill.style.height = `${day.minutes ? Math.max(5, day.minutes / max * 100) : 0}%`;
      fill.title = `${day.label}: ${day.minutes} minutes`;
      track.append(fill);
      const label = document.createElement("span"); label.className = "bar-label"; label.textContent = day.label;
      col.append(track, label);
      container.append(col);
    });
  }

  function getLastSevenDays() {
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(12,0,0,0);
      date.setDate(date.getDate() - (6 - index));
      return { key: dateKey(date), label: dateLabel(date, { weekday: "short" }).slice(0,3), minutes: minutesForDate(dateKey(date)) };
    });
  }

  function renderWeekly() {
    const days = getLastSevenDays();
    const total = days.reduce((sum, day) => sum + day.minutes, 0);
    $("#weekTotal").textContent = `${total} min`;
    $("#weekAverage").textContent = `Daily average: ${Math.round(total / 7)} min`;
    renderChart($("#weeklyChart"), days);
  }

  function renderAnalytics() {
    const days = getLastSevenDays();
    const total = days.reduce((sum, day) => sum + day.minutes, 0);
    $("#analyticsWeekTotal").textContent = `${total} min`;
    renderChart($("#analyticsChart"), days, true);
    const history = $("#sessionHistory");
    history.replaceChildren();
    const sessions = state.sessions.filter(s => s.type === "focus").slice(0, 10);
    $("#historyEmpty").classList.toggle("hidden", sessions.length > 0);
    sessions.forEach(session => {
      const row = document.createElement("div"); row.className = "history-row";
      const symbol = document.createElement("div"); symbol.className = "history-symbol"; symbol.textContent = "◷";
      const copy = document.createElement("div"); copy.className = "history-copy";
      const title = document.createElement("strong"); title.textContent = session.taskTitle || "Focus session";
      const meta = document.createElement("span"); meta.textContent = `${session.date} · ${session.completedAt ? dateLabel(new Date(session.completedAt), { hour: "numeric", minute: "2-digit" }) : ""}`;
      copy.append(title, meta);
      const duration = document.createElement("div"); duration.className = "history-duration"; duration.textContent = `${session.minutes} min`;
      row.append(symbol, copy, duration); history.append(row);
    });
  }

  function updateTimerUI() {
    $("#timerDisplay").textContent = formatTime(remainingSeconds);
    $("#startPauseText").textContent = running ? "Pause focus" : "Start focus";
    $("#startPauseIcon").textContent = running ? "Ⅱ" : "▶";
    $("#timerStatus").textContent = running ? (mode === "focus" ? "FOCUS IN PROGRESS" : "BREAK IN PROGRESS") : "READY TO FOCUS";
    $("#timerUnit").textContent = mode === "focus" ? "minutes" : "take a breath";
    $("#modePill").textContent = mode === "focus" ? "POMODORO" : mode === "short" ? "SHORT BREAK" : "LONG BREAK";
    $$(".timer-tab").forEach(button => button.classList.toggle("active", button.dataset.mode === mode));
    const duration = modeDuration();
    const progress = duration ? Math.max(0, Math.min(1, remainingSeconds / duration)) : 0;
    const degrees = (1 - progress) * 360;
    $("#timerRing").style.background = `conic-gradient(var(--purple) 0deg ${degrees}deg, #efedfb ${degrees}deg 360deg)`;
    const nextSession = (sessionCountInCycle % state.settings.sessionsPerCycle) + 1;
    $("#sessionLabel").textContent = `Session ${nextSession} of ${state.settings.sessionsPerCycle}`;
    document.title = `${formatTime(remainingSeconds)} · Deep Focus`;
  }

  function stopInterval() {
    if (intervalId !== null) clearInterval(intervalId);
    intervalId = null;
  }

  function startTimer() {
    if (running) return;
    if (remainingSeconds <= 0) remainingSeconds = modeDuration();
    running = true;
    endAt = Date.now() + remainingSeconds * 1000;
    stopInterval();
    intervalId = setInterval(() => {
      remainingSeconds = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      updateTimerUI();
      if (remainingSeconds <= 0) finishTimer();
    }, 250);
    updateTimerUI();
  }

  function pauseTimer() {
    if (!running) return;
    remainingSeconds = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
    running = false;
    endAt = null;
    stopInterval();
    updateTimerUI();
  }

  function resetTimer() {
    pauseTimer();
    remainingSeconds = modeDuration();
    updateTimerUI();
  }

  function switchMode(nextMode) {
    if (!["focus", "short", "long"].includes(nextMode)) return;
    pauseTimer();
    mode = nextMode;
    remainingSeconds = modeDuration();
    updateTimerUI();
  }

  function playAlert() {
    if (!state.settings.soundAlerts || !soundEnabled) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      [660, 880, 660].forEach((frequency, index) => {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.frequency.value = frequency;
        oscillator.type = "sine";
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + index * 0.18);
        gain.gain.exponentialRampToValueAtTime(0.13, ctx.currentTime + index * 0.18 + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + index * 0.18 + 0.15);
        oscillator.connect(gain); gain.connect(ctx.destination);
        oscillator.start(ctx.currentTime + index * 0.18);
        oscillator.stop(ctx.currentTime + index * 0.18 + 0.17);
      });
      setTimeout(() => ctx.close(), 900);
    } catch (error) { /* Audio is an enhancement; timer still works. */ }
  }

  function finishTimer() {
    pauseTimer();
    remainingSeconds = 0;
    if (mode === "focus") {
      const task = state.tasks.find(item => item.id === $("#focusTask").value);
      const session = {
        id: safeId(), type: "focus", minutes: Number(state.settings.focus),
        date: dateKey(), completedAt: new Date().toISOString(),
        taskId: task ? task.id : null, taskTitle: task ? task.title : ""
      };
      state.sessions.unshift(session);
      state.completedFocusCount++;
      sessionCountInCycle++;
      saveState();
      renderEverything();
      playAlert();
      showToast("Focus session complete. Take a breath!");
      const nextMode = sessionCountInCycle % state.settings.sessionsPerCycle === 0 ? "long" : "short";
      mode = nextMode;
      remainingSeconds = modeDuration();
      updateTimerUI();
      if (state.settings.autoBreaks) startTimer();
    } else {
      playAlert();
      showToast("Break complete. Ready for another round?");
      mode = "focus";
      remainingSeconds = modeDuration();
      updateTimerUI();
    }
  }

  function skipTimer() {
    pauseTimer();
    if (mode === "focus") {
      mode = "short";
    } else {
      mode = "focus";
    }
    remainingSeconds = modeDuration();
    updateTimerUI();
    showToast("Timer session skipped.");
  }

  function populateSettings() {
    $("#focusDuration").value = state.settings.focus;
    $("#shortDuration").value = state.settings.short;
    $("#longDuration").value = state.settings.long;
    $("#sessionsPerCycle").value = state.settings.sessionsPerCycle;
    $("#autoBreaks").checked = state.settings.autoBreaks;
    $("#soundAlerts").checked = state.settings.soundAlerts;
  }

  function saveSettings() {
    const getNumber = (id, fallback, min, max) => {
      const value = Number($(id).value);
      return Number.isFinite(value) ? Math.max(min, Math.min(max, Math.round(value))) : fallback;
    };
    state.settings.focus = getNumber("#focusDuration", 25, 1, 180);
    state.settings.short = getNumber("#shortDuration", 5, 1, 60);
    state.settings.long = getNumber("#longDuration", 15, 1, 90);
    state.settings.sessionsPerCycle = getNumber("#sessionsPerCycle", 4, 2, 8);
    state.settings.autoBreaks = $("#autoBreaks").checked;
    state.settings.soundAlerts = $("#soundAlerts").checked;
    saveState();
    pauseTimer();
    remainingSeconds = modeDuration();
    updateTimerUI();
    renderEverything();
    $("#settingsMessage").textContent = "Settings saved successfully.";
    showToast("Your focus settings have been saved.");
  }

  function resetAllData() {
    const confirmed = window.confirm("Reset all tasks, focus sessions, and settings? This cannot be undone.");
    if (!confirmed) return;
    pauseTimer();
    state = { tasks: [], sessions: [], settings: { ...DEFAULT_SETTINGS }, completedFocusCount: 0 };
    mode = "focus"; sessionCountInCycle = 0; remainingSeconds = modeDuration();
    saveState(); populateSettings(); renderEverything(); updateTimerUI();
    $("#settingsMessage").textContent = "All local data has been reset.";
    showToast("Your data has been reset.");
  }

  function getProgressData() {
    const focusSessions = state.sessions.filter(session => session.type === "focus");
    const totalMinutes = focusSessions.reduce((sum, session) => sum + Number(session.minutes || 0), 0);
    const completedTasks = state.tasks.filter(task => task.completed).length;
    const currentIndex = LEVELS.reduce((index, level, i) => totalMinutes >= level.xp ? i : index, 0);
    const current = LEVELS[currentIndex];
    const next = LEVELS[Math.min(currentIndex + 1, LEVELS.length - 1)];
    const isMax = currentIndex === LEVELS.length - 1;
    const range = isMax ? 1 : Math.max(1, next.xp - current.xp);
    const progress = isMax ? 1 : Math.max(0, Math.min(1, (totalMinutes - current.xp) / range));
    const achievements = [
      { id: "first-session", title: "First focused session", description: "Complete your first focus session.", icon: "◷", earned: focusSessions.length >= 1 },
      { id: "one-hour", title: "One hour of focus", description: "Accumulate 60 focused minutes.", icon: "⌁", earned: totalMinutes >= 60 },
      { id: "five-sessions", title: "Finding your rhythm", description: "Complete 5 focus sessions.", icon: "✦", earned: focusSessions.length >= 5 },
      { id: "first-task", title: "A task off your mind", description: "Finish your first task.", icon: "✓", earned: completedTasks >= 1 },
      { id: "three-hours", title: "Deep work in motion", description: "Accumulate 180 focused minutes.", icon: "◆", earned: totalMinutes >= 180 },
      { id: "streak-three", title: "Three-day streak", description: "Focus on 3 consecutive days.", icon: "♨", earned: calculateStreak() >= 3 },
      { id: "ten-sessions", title: "Session regular", description: "Complete 10 focus sessions.", icon: "★", earned: focusSessions.length >= 10 },
      { id: "ten-tasks", title: "Task finisher", description: "Complete 10 tasks.", icon: "☑", earned: completedTasks >= 10 }
    ];
    return { focusSessions, totalMinutes, completedTasks, currentIndex, current, next, isMax, progress, achievements };
  }

  function renderProgress() {
    const data = getProgressData();
    const percent = Math.round(data.progress * 100);
    $("#levelBadge").textContent = String(data.current.level).padStart(2, "0");
    $("#levelTitle").textContent = data.current.title;
    $("#levelSubtitle").textContent = data.current.subtitle;
    $("#levelProgressLabel").textContent = data.isMax ? "Maximum level reached" : `${data.totalMinutes - data.current.xp} / ${data.next.xp - data.current.xp} focus minutes`;
    $("#levelProgressPercent").textContent = `${percent}%`;
    $("#levelProgressFill").style.width = `${percent}%`;
    $("#nextLevelHint").textContent = data.isMax ? "Incredible work — you reached the highest level. Keep your rhythm going!" : `${data.next.xp - data.totalMinutes} more focus minutes to unlock ${data.next.title}.`;
    $("#progressTotalMinutes").textContent = data.totalMinutes.toLocaleString();
    $("#progressTotalSessions").textContent = data.focusSessions.length.toLocaleString();
    $("#progressTotalTasks").textContent = data.completedTasks.toLocaleString();
    $("#progressStreak").textContent = calculateStreak().toLocaleString();
    const unlockedCount = LEVELS.filter(level => data.totalMinutes >= level.xp).length;
    $("#roadmapCount").textContent = `${unlockedCount} / ${LEVELS.length} levels`;
    const roadmap = $("#levelRoadmap");
    roadmap.replaceChildren();
    LEVELS.forEach((level, index) => {
      const unlocked = data.totalMinutes >= level.xp;
      const current = index === data.currentIndex;
      const step = document.createElement("div");
      step.className = `roadmap-step${unlocked ? " unlocked" : ""}${current ? " current" : ""}`;
      const icon = document.createElement("div"); icon.className = "roadmap-icon"; icon.textContent = unlocked ? "✓" : level.icon;
      const copy = document.createElement("div"); copy.className = "roadmap-copy";
      const title = document.createElement("strong"); title.textContent = `Level ${String(level.level).padStart(2, "0")} · ${level.title}`;
      const description = document.createElement("p");
      if (index === LEVELS.length - 1) description.textContent = `Unlock at ${level.xp.toLocaleString()} cumulative focus minutes.`;
      else description.textContent = `Unlock at ${level.xp.toLocaleString()} focus minutes${index === 0 ? " · Your starting level" : ""}.`;
      copy.append(title, description);
      const status = document.createElement("span"); status.className = "roadmap-status"; status.textContent = unlocked ? (current ? "Current" : "Unlocked") : "Locked";
      step.append(icon, copy, status); roadmap.append(step);
    });
    const achievements = $("#achievementList");
    achievements.replaceChildren();
    data.achievements.forEach(achievement => {
      const item = document.createElement("div"); item.className = `achievement-item${achievement.earned ? " earned" : ""}`;
      const icon = document.createElement("div"); icon.className = "achievement-icon"; icon.textContent = achievement.icon;
      const copy = document.createElement("div"); copy.className = "achievement-copy";
      const title = document.createElement("strong"); title.textContent = achievement.title;
      const desc = document.createElement("p"); desc.textContent = achievement.description;
      copy.append(title, desc);
      const status = document.createElement("span"); status.className = "achievement-state"; status.textContent = achievement.earned ? "EARNED" : "LOCKED";
      item.append(icon, copy, status); achievements.append(item);
    });
    const now = new Date();
    $("#reportPreviewDate").textContent = dateLabel(now, { month: "short", day: "numeric", year: "numeric" });
    $("#previewLevelTitle").textContent = data.current.title;
    $("#previewLevelSub").textContent = data.current.subtitle;
    $("#previewLevelNumber").textContent = `LEVEL ${String(data.current.level).padStart(2, "0")}`;
    $("#previewMinutes").textContent = data.totalMinutes.toLocaleString();
    $("#previewSessions").textContent = data.focusSessions.length.toLocaleString();
    $("#previewTasks").textContent = data.completedTasks.toLocaleString();
    $("#previewStreak").textContent = `${calculateStreak()} days`;
    $("#previewPercent").textContent = `${percent}%`;
    $("#previewProgressFill").style.width = `${percent}%`;
  }

  function printProgressReport() {
    renderProgress();
    document.body.classList.add("print-progress-report");
    const cleanup = () => {
      document.body.classList.remove("print-progress-report");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
    // Some browsers do not fire afterprint reliably; retain no print-only state after dialog closes.
    setTimeout(cleanup, 1500);
  }

  function renderEverything() {
    renderStats();
    renderTaskOptions();
    renderDashboardTasks();
    renderAllTasks();
    renderWeekly();
    renderProgress();
    if ($("#analyticsView").classList.contains("active-view")) renderAnalytics();
  }

  function bindEvents() {
    $$(".nav-item[data-view]").forEach(button => button.addEventListener("click", () => setView(button.dataset.view)));
    $$("[data-go]").forEach(button => button.addEventListener("click", () => setView(button.dataset.go)));
    $$(".timer-tab").forEach(button => button.addEventListener("click", () => switchMode(button.dataset.mode)));
    $("#startPauseBtn").addEventListener("click", () => running ? pauseTimer() : startTimer());
    $("#resetBtn").addEventListener("click", resetTimer);
    $("#skipBtn").addEventListener("click", skipTimer);
    $("#quickAddForm").addEventListener("submit", event => {
      event.preventDefault();
      createTask($("#quickTaskInput").value);
      $("#quickTaskInput").value = "";
      $("#quickTaskInput").focus();
    });
    $("#taskCreateForm").addEventListener("submit", event => {
      event.preventDefault();
      createTask($("#newTaskInput").value, $("#newTaskPriority").value);
      $("#newTaskInput").value = "";
      $("#newTaskInput").focus();
    });
    $$(".filter-tab").forEach(button => button.addEventListener("click", () => {
      taskFilter = button.dataset.filter;
      $$(".filter-tab").forEach(tab => tab.classList.toggle("active", tab === button));
      renderAllTasks();
    }));
    $("#printProgressBtn").addEventListener("click", printProgressReport);
    $("#saveSettingsBtn").addEventListener("click", saveSettings);
    $("#resetDataBtn").addEventListener("click", resetAllData);
    $("#soundToggle").addEventListener("click", () => {
      soundEnabled = !soundEnabled;
      $("#soundToggle").style.color = soundEnabled ? "var(--purple)" : "#b8b8c7";
      $("#soundToggle").setAttribute("aria-label", soundEnabled ? "Mute sound" : "Enable sound");
      showToast(soundEnabled ? "Sound enabled." : "Sound muted.");
    });
    $("#mobileMenu").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
    document.addEventListener("click", event => {
      if (window.innerWidth <= 850 && $("#sidebar").classList.contains("open") && !$("#sidebar").contains(event.target) && !$("#mobileMenu").contains(event.target)) {
        $("#sidebar").classList.remove("open");
      }
    });
    document.addEventListener("visibilitychange", () => {
      if (running && endAt) {
        remainingSeconds = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
        updateTimerUI();
        if (remainingSeconds <= 0) finishTimer();
      }
    });
    window.addEventListener("beforeunload", () => {
      if (running && endAt) {
        // The timer is recalculated from its end timestamp when the page becomes visible again.
      }
    });
  }

  function init() {
    updateHeader();
    bindEvents();
    populateSettings();
    remainingSeconds = modeDuration();
    renderEverything();
    updateTimerUI();
  }

  init();
})();
