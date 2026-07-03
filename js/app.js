// ======================= APPLICATION =======================

// State
let currentUser = null;
let currentUserData = null;
let isRunning = false;
let usersList = [];
let tasksList = [];
let isCreatingUser = false;
let currentLanguage = 'de';
let currentTask = null;
let currentState = "---";
let lastEntry = null;

// DOM elements
const userSelect = document.getElementById('userSelect');
const currentUserSpan = document.getElementById('currentUser');
const currentUserCard = document.getElementById('currentUserCard');
const startStopBtn = document.getElementById('startStopBtn');
const viewProgressBtn = document.getElementById('viewProgressBtn');
const viewSupervisorProgressBtn = document.getElementById('viewSupervisorProgressBtn');
const statusP = document.getElementById('timerStatus');
const lastActionInfo = document.getElementById('lastActionInfo');
const userErrorMsg = document.getElementById('userErrorMsg');
const refreshBtn = document.getElementById('refreshUsersBtn');
const developerControls = document.getElementById('developerControls');
const supervisorControls = document.getElementById('supervisorControls');
const supervisorUserSelect = document.getElementById('supervisorUserSelect');
const profileCreation = document.getElementById('profileCreation');
const newUserFirstname = document.getElementById('newUserFirstname');
const newUserSurname = document.getElementById('newUserSurname');
const newUserRole = document.getElementById('newUserRole');
const createUserBtn = document.getElementById('createUserBtn');
const createErrorMsg = document.getElementById('createErrorMsg');
const pageTitle = document.getElementById('pageTitle');
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
const languageSelect = document.getElementById('languageSelect');

// Popup elements
const popupOverlay = document.getElementById('taskPopupOverlay');
const popupTitle = document.getElementById('popupTitle');
const popupTaskSelect = document.getElementById('popupTaskSelect');
const popupTaskState = document.getElementById('popupTaskState');
const popupDescription = document.getElementById('popupDescription');
const popupConfirmBtn = document.getElementById('popupConfirmBtn');
const popupCancelBtn = document.getElementById('popupCancelBtn');
const popupCloseBtn = document.getElementById('popupCloseBtn');
const popupCreateTaskBtn = document.getElementById('popupCreateTaskBtn');

// New Task Popup elements
const newTaskPopupOverlay = document.getElementById('newTaskPopupOverlay');
const newTaskNameInput = document.getElementById('newTaskNameInput');
const newTaskDescInput = document.getElementById('newTaskDescInput');
const newTaskDoDInput = document.getElementById('newTaskDoDInput');
const newTaskConfirmBtn = document.getElementById('newTaskConfirmBtn');
const newTaskCancelBtn = document.getElementById('newTaskCancelBtn');
const newTaskPopupCloseBtn = document.getElementById('newTaskPopupCloseBtn');

// ======================= UI HELPERS =======================

function getText(key) {
    return translations[currentLanguage][key] || key;
}

function showMessage(msgKey, type = 'info') {
    const msg = getText(msgKey);
    userErrorMsg.textContent = msg;
    userErrorMsg.className = `error-msg ${type}`;
    setTimeout(() => {
        if (userErrorMsg.textContent === msg) {
            userErrorMsg.textContent = '';
            userErrorMsg.className = 'error-msg';
        }
    }, 5000);
}

function updateUI() {
    if (isRunning) {
        startStopBtn.textContent = getText('stop');
        startStopBtn.style.background = '#ef4444';
        statusP.textContent = getText('active');
    } else {
        startStopBtn.textContent = getText('start');
        startStopBtn.style.background = '#3b82f6';
        statusP.textContent = getText('inactive');
    }
}

function updateLastActionInfo() {
    if (isRunning && lastEntry) {
        const stateDisplay = currentState === "---" ? getText('sameState') : currentState;
        const task = tasksList.find(t => t.id === lastEntry.taskId);
        lastActionInfo.innerHTML = `
            📌 ${task ? task.taskName : `Task ${lastEntry.taskId}`}
            <span class="state-badge">${stateDisplay}</span>
        `;
    } else {
        lastActionInfo.textContent = getText('noActiveTimer');
    }
}

// ======================= POPUP =======================

function openPopup() {
    populateTaskSelect(tasksList);
    
    if (lastEntry && lastEntry.taskId) {
        const taskExists = tasksList.some(t => t.id === lastEntry.taskId);
        if (taskExists) {
            popupTaskSelect.value = lastEntry.taskId;
        }
    }
    
    if (currentState && currentState !== "---") {
        popupTaskState.value = currentState;
    } else {
        popupTaskState.value = '';
    }
    
    popupDescription.value = '';
    popupOverlay.style.display = 'flex';
}

function closePopup() {
    popupOverlay.style.display = 'none';
}

function openNewTaskPopup() {
    newTaskNameInput.value = '';
    newTaskDescInput.value = '';
    newTaskDoDInput.value = '';
    newTaskPopupOverlay.style.display = 'flex';
}

function closeNewTaskPopup() {
    newTaskPopupOverlay.style.display = 'none';
}

// ======================= USER MANAGEMENT =======================

function populateUserSelect(users) {
    const selectedId = userSelect.value;
    userSelect.innerHTML = `<option value="">${getText('selectProfile')}</option>`;
    users.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = user.displayShort;
        userSelect.appendChild(option);
    });
    if (selectedId && users.some(u => u.id == selectedId)) {
        userSelect.value = selectedId;
    } else if (currentUser && users.some(u => u.id == currentUser)) {
        userSelect.value = currentUser;
    }
}

function populateSupervisorSelect(users) {
    const developers = users.filter(u => u.role === 'developer');
    supervisorUserSelect.innerHTML = `<option value="">${getText('selectDeveloper')}</option>`;
    developers.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = user.fullName;
        supervisorUserSelect.appendChild(option);
    });
}

function populateTaskSelect(tasks) {
    const currentValue = popupTaskSelect.value;
    popupTaskSelect.innerHTML = `<option value="">-- Letzten Task fortsetzen --</option>`;
    tasks.forEach(task => {
        const option = document.createElement('option');
        option.value = task.id;
        option.textContent = task.taskName;
        if (task.description && task.description !== "---") {
            option.title = task.description;
        }
        if (task.definitionOfDone && task.definitionOfDone !== "---") {
            if (option.title) {
                option.title += ` | Done: ${task.definitionOfDone}`;
            } else {
                option.title = `Done: ${task.definitionOfDone}`;
            }
        }
        popupTaskSelect.appendChild(option);
    });
    if (currentValue && tasks.some(t => t.id == currentValue)) {
        popupTaskSelect.value = currentValue;
    }
}

async function loadUsers() {
    try {
        usersList = await loadUsersFromGitLab();
        populateUserSelect(usersList);
        populateSupervisorSelect(usersList);
    } catch (err) {
        showMessage('errorLoadingUsers', 'error');
        console.error(err);
    }
}

async function loadTasks() {
    try {
        tasksList = await loadTasksFromGitLab();
        populateTaskSelect(tasksList);
    } catch (err) {
        console.error('Fehler beim Laden der Tasks:', err);
    }
}

// ======================= selectUser mit sessionStorage =======================

async function selectUser(userId) {
    if (!userId) return;
    
    currentUser = parseInt(userId);
    currentUserData = usersList.find(u => u.id === currentUser);
    
    if (!currentUserData) {
        console.warn('User not found:', userId);
        return;
    }

    // Save to sessionStorage
    try {
        sessionStorage.setItem('selectedUser', String(currentUser));
        sessionStorage.setItem('selectedUserData', JSON.stringify({
            id: currentUserData.id,
            firstname: currentUserData.firstname,
            surname: currentUserData.surname,
            role: currentUserData.role
        }));
        console.log('✅ User saved to sessionStorage:', currentUserData.fullName);
    } catch (e) {
        console.warn('Could not save to sessionStorage:', e);
    }

    currentUserCard.style.display = 'inline-block';
    currentUserSpan.textContent = `👤 ${currentUserData.fullName}`;
    profileCreation.style.display = 'none';
    
    if (userSelect) {
        userSelect.value = currentUser;
    }
    
    if (currentUserData.role === 'developer') {
        developerControls.style.display = 'block';
        supervisorControls.style.display = 'none';
        await syncDeveloperState();
    } else {
        developerControls.style.display = 'none';
        supervisorControls.style.display = 'block';
        await loadUsers();
    }
    
    userErrorMsg.textContent = '';
    createErrorMsg.textContent = '';
}

function clearUser() {
    currentUser = null;
    currentUserData = null;
    
    try {
        sessionStorage.removeItem('selectedUser');
        sessionStorage.removeItem('selectedUserData');
        console.log('🗑️ User cleared from sessionStorage');
    } catch (e) {
        console.warn('Could not clear sessionStorage:', e);
    }
    
    currentUserCard.style.display = 'none';
    developerControls.style.display = 'none';
    supervisorControls.style.display = 'none';
    profileCreation.style.display = 'block';
    isRunning = false;
    updateUI();
    updateLastActionInfo();
    userErrorMsg.textContent = '';
    
    if (userSelect) {
        userSelect.value = '';
    }
}

async function syncDeveloperState() {
    if (!currentUser) return;
    
    const status = await getUserCurrentState(currentUser);
    if (status && status.isActive) {
        isRunning = true;
        currentTask = status.taskId;
        currentState = status.taskState;
        lastEntry = {
            taskId: currentTask,
            taskState: currentState,
            timestampUTC: status.timestampUTC
        };
    } else {
        isRunning = false;
        currentTask = null;
        currentState = "---";
        lastEntry = null;
    }
    updateUI();
    updateLastActionInfo();
}

// ======================= TIMER ACTIONS =======================

async function performStop() {
    try {
        const entry = new TrackingEntry(
            currentUser,
            'stop',
            currentTask || 0,
            currentState,
            "---"
        );
        
        await saveTrackingEntryToGitLab(entry);
        
        isRunning = false;
        lastEntry = null;
        currentState = "---";
        
        updateUI();
        updateLastActionInfo();
        showMessage('timerStopped', 'success');
    } catch (err) {
        console.error('Stop error:', err);
        showMessage('errorGeneric', 'error');
    }
}

async function confirmPopup() {
    let taskId = parseInt(popupTaskSelect.value);
    let taskState = popupTaskState.value.trim() || "---";
    const description = popupDescription.value.trim() || "---";
    
    if (!taskId) {
        const lastEntry = await getLastTrackingEntry(currentUser);
        if (lastEntry) {
            taskId = lastEntry.taskId;
        } else {
            showMessage('selectTaskOrCreate', 'warning');
            return;
        }
    }
    
    try {
        const entry = new TrackingEntry(
            currentUser,
            'start',
            taskId,
            taskState,
            description
        );
        
        await saveTrackingEntryToGitLab(entry);
        
        isRunning = true;
        currentTask = taskId;
        currentState = taskState;
        lastEntry = entry;
        
        updateUI();
        updateLastActionInfo();
        closePopup();
        
        const stateMsg = taskState === "---" ? getText('sameState') : `(${taskState})`;
        showMessage(`${getText('taskStarted')} ${stateMsg}`, 'success');
    } catch (err) {
        console.error('Start error:', err);
        showMessage('errorGeneric', 'error');
    }
}

async function handleStartStop() {
    if (!currentUser) {
        showMessage('selectProfileFirst', 'warning');
        return;
    }

    if (currentUserData.role === 'supervisor') {
        showMessage('supervisorNoTimer', 'warning');
        return;
    }

    const status = await getUserCurrentState(currentUser);
    
    if (isRunning && status) {
        await performStop();
    } else if (!isRunning) {
        popupTitle.textContent = getText('taskPopupTitle');
        popupConfirmBtn.textContent = getText('confirm');
        openPopup();
    } else {
        await syncDeveloperState();
        showMessage('timerSynced', 'info');
    }
}

// ======================= TASK CREATION =======================

async function createNewTask() {
    const taskName = newTaskNameInput.value.trim();
    const description = newTaskDescInput.value.trim() || "---";
    const definitionOfDone = newTaskDoDInput.value.trim() || "---";

    if (!taskName) {
        showMessage('fillTaskName', 'warning');
        return;
    }

    try {
        const maxId = tasksList.reduce((max, t) => Math.max(max, t.id || 0), 0);
        const newTask = new Task(maxId + 1, taskName, description, definitionOfDone);
        tasksList.push(newTask);
        await saveTasksToGitLab(tasksList);
        
        populateTaskSelect(tasksList);
        popupTaskSelect.value = newTask.id;
        
        closeNewTaskPopup();
        showMessage('taskCreated', 'success');
    } catch (err) {
        console.error('Task creation error:', err);
        showMessage('errorGeneric', 'error');
    }
}

// ======================= USER CREATION =======================

async function createNewUser() {
    if (isCreatingUser) return;
    
    const firstname = newUserFirstname.value.trim();
    const surname = newUserSurname.value.trim();
    const role = newUserRole.value;

    if (!firstname || !surname) {
        showMessage('fillFirstLast', 'error');
        return;
    }

    isCreatingUser = true;
    createUserBtn.disabled = true;
    createUserBtn.textContent = getText('creating');

    try {
        const maxId = usersList.reduce((max, u) => Math.max(max, u.id || 0), 0);
        const user = new User(maxId + 1, firstname, surname, role);
        usersList.push(user);
        await saveUsersToGitLab(usersList);
        await loadUsers();
        
        showMessage(`${getText('userCreated')} ${user.fullName} (${role}) ${getText('created')}`, 'success');
        
        newUserFirstname.value = '';
        newUserSurname.value = '';
        createErrorMsg.textContent = '';
        
        await selectUser(user.id);
    } catch (err) {
        createErrorMsg.textContent = `❌ Fehler: ${err.message}`;
        createErrorMsg.className = 'error-msg';
    } finally {
        isCreatingUser = false;
        createUserBtn.disabled = false;
        createUserBtn.textContent = getText('create');
    }
}

// ======================= LANGUAGE =======================

function updateLanguage() {
    const t = translations[currentLanguage];
    
    pageTitle.textContent = t.title;
    
    const selectOption = userSelect.querySelector('option[value=""]');
    if (selectOption) selectOption.textContent = t.selectProfile;
    
    const supervisorOption = supervisorUserSelect.querySelector('option[value=""]');
    if (supervisorOption) supervisorOption.textContent = t.selectDeveloper;
    
    // Update refresh button
    refreshBtn.textContent = t.refresh || '⟳ Aktualisieren';
    
    // Update view progress buttons
    viewProgressBtn.textContent = t.viewProgress || '📊 Fortschritt ansehen';
    viewSupervisorProgressBtn.textContent = t.viewProgress || '📊 Fortschritt ansehen';
    
    if (!isRunning) {
        startStopBtn.textContent = t.start;
    } else {
        startStopBtn.textContent = t.stop;
    }
    
    updateUI();
    updateLastActionInfo();
    
    const hintText = document.querySelector('.hint-text');
    if (hintText) hintText.textContent = t.supervisorHint;
    
    popupTitle.textContent = t.taskPopupTitle;
    popupConfirmBtn.textContent = t.confirm;
    popupCancelBtn.textContent = t.cancel;
    
    document.querySelectorAll('.popup-field label').forEach(label => {
        const forAttr = label.getAttribute('for');
        const keyMap = {
            'popupTaskSelect': 'selectTask',
            'popupTaskState': 'taskStatus',
            'popupDescription': 'description',
            'newTaskNameInput': 'taskName',
            'newTaskDescInput': 'taskDescription',
            'newTaskDoDInput': 'definitionOfDone'
        };
        if (keyMap[forAttr]) {
            label.textContent = t[keyMap[forAttr]];
        }
    });
    
    document.querySelectorAll('.field-hint').forEach(hint => {
        const parentField = hint.closest('.popup-field');
        if (parentField) {
            const label = parentField.querySelector('label');
            if (label) {
                const forAttr = label.getAttribute('for');
                if (forAttr === 'popupTaskSelect') {
                    hint.textContent = '💡 ' + (t.statusHint || 'Leer lassen = zuletzt verwendeten Task fortsetzen');
                } else if (forAttr === 'popupTaskState') {
                    hint.textContent = '💡 ' + (t.statusHint || 'Leer lassen = gleichen Status wie zuvor');
                }
            }
        }
    });
    
    const divider = document.querySelector('.popup-divider');
    if (divider) divider.textContent = t.or;
    
    document.querySelector('.git-note').innerHTML = `
        ${t.gitNote}<br>
        ${t.timeFormat}<br>
        <span style="font-size:0.65rem;">${t.configNote}</span>
    `;
    
    const creationHeader = document.querySelector('.creation-header span');
    if (creationHeader) creationHeader.textContent = t.createProfile;
    newUserFirstname.placeholder = t.firstname;
    newUserSurname.placeholder = t.surname;
    newUserRole.querySelectorAll('option').forEach(opt => {
        if (opt.value === 'developer') opt.textContent = t.developer;
        else if (opt.value === 'supervisor') opt.textContent = t.supervisor;
    });
    createUserBtn.textContent = t.create;
    
    const newTaskHeader = document.querySelector('#newTaskPopupOverlay .popup-header h2');
    if (newTaskHeader) newTaskHeader.textContent = t.newTask;
    newTaskConfirmBtn.textContent = t.confirm;
    newTaskCancelBtn.textContent = t.cancel;
    
    document.querySelectorAll('#newTaskPopupOverlay .popup-field label').forEach(label => {
        const forAttr = label.getAttribute('for');
        const keyMap = {
            'newTaskNameInput': 'taskName',
            'newTaskDescInput': 'taskDescription',
            'newTaskDoDInput': 'definitionOfDone'
        };
        if (keyMap[forAttr]) {
            label.textContent = t[keyMap[forAttr]];
        }
    });
    
    newTaskNameInput.placeholder = t.taskName || 'z.B. API Entwicklung';
    newTaskDescInput.placeholder = t.taskDescription || 'Kurze Beschreibung (optional)';
    newTaskDoDInput.placeholder = t.definitionOfDone || 'Wann ist der Task fertig? (optional)';
}

// ======================= RESTORE USER FROM SESSIONSTORAGE =======================

async function restoreSavedUser() {
    try {
        const savedUserId = sessionStorage.getItem('selectedUser');
        if (!savedUserId) return false;
        
        const savedUserData = JSON.parse(sessionStorage.getItem('selectedUserData') || 'null');
        if (!savedUserData) {
            sessionStorage.removeItem('selectedUser');
            sessionStorage.removeItem('selectedUserData');
            return false;
        }
        
        const userExists = usersList.some(u => u.id === parseInt(savedUserId));
        if (!userExists) {
            sessionStorage.removeItem('selectedUser');
            sessionStorage.removeItem('selectedUserData');
            return false;
        }
        
        console.log('🔄 Restoring user from sessionStorage:', savedUserData.fullName);
        await selectUser(parseInt(savedUserId));
        return true;
    } catch (e) {
        console.warn('Could not restore user from sessionStorage:', e);
        return false;
    }
}

// ======================= EVENT LISTENERS =======================

// Theme toggle - mit sessionStorage
themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    sessionStorage.setItem('theme', newTheme);
    themeIcon.textContent = newTheme === 'dark' ? '🌙' : '☀️';
});

// Language selector - mit sessionStorage
languageSelect.addEventListener('change', (e) => {
    currentLanguage = e.target.value;
    sessionStorage.setItem('language', currentLanguage);
    updateLanguage();
    populateUserSelect(usersList);
    populateSupervisorSelect(usersList);
    populateTaskSelect(tasksList);
});

// User selection
userSelect.addEventListener('change', async (e) => {
    const userId = e.target.value;
    if (userId) {
        await selectUser(userId);
    } else {
        clearUser();
    }
});

// Create user
createUserBtn.addEventListener('click', createNewUser);

// Refresh
refreshBtn.addEventListener('click', async () => {
    await loadUsers();
    await loadTasks();
    if (currentUser) {
        await selectUser(currentUser);
    }
    showMessage('dataRefreshed', 'success');
});

// Start/Stop
startStopBtn.addEventListener('click', handleStartStop);

// View progress button - Developer
viewProgressBtn.addEventListener('click', () => {
    if (currentUser && currentUserData) {
        try {
            sessionStorage.setItem('selectedUser', String(currentUser));
            sessionStorage.setItem('selectedUserData', JSON.stringify({
                id: currentUserData.id,
                firstname: currentUserData.firstname,
                surname: currentUserData.surname,
                role: currentUserData.role
            }));
            console.log('💾 Saved user before navigation:', currentUserData.fullName);
        } catch (e) {
            console.warn('Could not save user before navigation:', e);
        }
        window.location.href = 'calendar/calendar.html?user=' + encodeURIComponent(currentUser);
    }
});

// View progress button - Supervisor
viewSupervisorProgressBtn.addEventListener('click', () => {
    const selectedUserId = supervisorUserSelect.value;
    if (selectedUserId && currentUserData) {
        try {
            sessionStorage.setItem('selectedUser', String(currentUser));
            sessionStorage.setItem('selectedUserData', JSON.stringify({
                id: currentUserData.id,
                firstname: currentUserData.firstname,
                surname: currentUserData.surname,
                role: currentUserData.role
            }));
            console.log('💾 Saved supervisor before navigation:', currentUserData.fullName);
        } catch (e) {
            console.warn('Could not save user before navigation:', e);
        }
        window.location.href = 'calendar/calendar.html?user=' + encodeURIComponent(selectedUserId) + '&supervisor=true';
    } else {
        showMessage('selectDeveloperFirst', 'warning');
    }
});

// Popup events
popupConfirmBtn.addEventListener('click', confirmPopup);
popupCancelBtn.addEventListener('click', closePopup);
popupCloseBtn.addEventListener('click', closePopup);
popupCreateTaskBtn.addEventListener('click', openNewTaskPopup);

// New Task Popup events
newTaskConfirmBtn.addEventListener('click', createNewTask);
newTaskCancelBtn.addEventListener('click', closeNewTaskPopup);
newTaskPopupCloseBtn.addEventListener('click', closeNewTaskPopup);

// Close popups when clicking overlay
popupOverlay.addEventListener('click', (e) => {
    if (e.target === popupOverlay) closePopup();
});

newTaskPopupOverlay.addEventListener('click', (e) => {
    if (e.target === newTaskPopupOverlay) closeNewTaskPopup();
});

// Enter key support
popupTaskState.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') confirmPopup();
});

popupDescription.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') confirmPopup();
});

newTaskNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') createNewTask();
});

// ======================= INIT =======================

async function init() {
    // Load theme from sessionStorage
    const savedTheme = sessionStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    themeIcon.textContent = savedTheme === 'dark' ? '🌙' : '☀️';
    
    // Load language from sessionStorage
    const savedLanguage = sessionStorage.getItem('language') || 'de';
    currentLanguage = savedLanguage;
    languageSelect.value = savedLanguage;
    
    // Check config
    if (!CONFIG.GITLAB_URL) {
        console.error("config.js muss GITLAB_URL enthalten!");
        showMessage('configError', 'error');
        return;
    }
    if (!CONFIG.GITLAB_TOKEN || CONFIG.GITLAB_TOKEN === "DEIN_TOKEN") {
        console.error("Bitte config.js mit gültigem GitLab Token versehen!");
        showMessage('tokenError', 'error');
        return;
    }
    
    // Load data
    await loadUsers();
    await loadTasks();
    
    // Try to restore user from sessionStorage
    const restored = await restoreSavedUser();
    if (!restored) {
        console.log('ℹ️ No saved user found - showing profile selection');
        profileCreation.style.display = 'block';
        currentUserCard.style.display = 'none';
        developerControls.style.display = 'none';
        supervisorControls.style.display = 'none';
    }
    
    // Update language
    updateLanguage();
    
    console.log('✅ App initialized successfully');
    console.log('Current user:', currentUserData ? currentUserData.fullName : 'None');
    console.log('Theme:', savedTheme, 'Language:', savedLanguage);
}

// Start the app
init().catch(e => console.error("Init Fehler:", e));