// ======================= CALENDAR APP =======================

// State
let currentUserId = null;
let viewingUserId = null;
let currentUser = null;
let viewingUser = null;
let isSupervisor = false;
let selectedDate = null;
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let currentLanguage = 'de';
let allUsers = [];
let allTasks = [];
let allEntries = [];
let selectedComparisonUsers = [];
let userColors = {};

// DOM elements
const calendarDays = document.getElementById('calendarDays');
const currentMonthDisplay = document.getElementById('currentMonthDisplay');
const monthTotal = document.getElementById('monthTotal');
const dayDetailsContent = document.getElementById('dayDetailsContent');
const dayDetailsTitle = document.getElementById('dayDetailsTitle');
const totalTimeValue = document.getElementById('totalTimeValue');
const memberSelector = document.getElementById('memberSelector');
const memberSelectorOptions = document.getElementById('memberSelectorOptions');
const backBtn = document.getElementById('backBtn');
const prevMonthBtn = document.getElementById('prevMonthBtn');
const nextMonthBtn = document.getElementById('nextMonthBtn');
const firstMonthBtn = document.getElementById('firstMonthBtn');
const lastMonthBtn = document.getElementById('lastMonthBtn');

// ======================= INIT =======================

async function initCalendar() {
    const urlParams = new URLSearchParams(window.location.search);
    viewingUserId = parseInt(urlParams.get('user'));
    isSupervisor = urlParams.get('supervisor') === 'true';

    if (!viewingUserId) {
        window.location.href = '../index.html';
        return;
    }

    // Load theme from sessionStorage
    const savedTheme = sessionStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    document.getElementById('themeIcon').textContent = savedTheme === 'dark' ? '🌙' : '☀️';

    // Load language from sessionStorage
    const savedLanguage = sessionStorage.getItem('language') || 'de';
    currentLanguage = savedLanguage;
    document.getElementById('languageSelect').value = savedLanguage;

    await loadData();

    viewingUser = allUsers.find(u => u.id === viewingUserId);
    if (!viewingUser) {
        window.location.href = '../index.html';
        return;
    }

    if (isSupervisor) {
        currentUserId = viewingUserId;
        currentUser = viewingUser;
    } else {
        currentUserId = viewingUserId;
        currentUser = viewingUser;
    }

    if (isSupervisor) {
        selectedComparisonUsers = [];
        memberSelector.style.display = 'block';
        renderMemberSelector();
    } else {
        memberSelector.style.display = 'none';
        selectedComparisonUsers = [];
    }

    renderCalendar();
    renderTotalTime();
    setupEventListeners();
    updateLanguage();
    
    console.log('✅ Calendar initialized');
    console.log('Viewing user:', viewingUser.fullName);
    console.log('Theme:', savedTheme, 'Language:', savedLanguage);
}

// ======================= DATA LOADING =======================

async function loadData() {
    try {
        allUsers = await loadUsersFromGitLab();
        allTasks = await loadTasksFromGitLab();
        allEntries = await loadTrackingFromGitLab();
        
        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
        allUsers.forEach((user, index) => {
            userColors[user.id] = colors[index % colors.length];
        });
    } catch (err) {
        console.error('Error loading data:', err);
        alert('Fehler beim Laden der Daten');
    }
}

// ======================= UI HELPERS =======================

function getText(key) {
    return translations[currentLanguage][key] || key;
}

function getMonthName(month) {
    const names = getText('monthNames');
    return names[month] || month;
}

function getWeekdayName(index) {
    const names = getText('weekdays');
    return names[index] || ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'][index];
}

// ======================= MEMBER SELECTOR =======================

function renderMemberSelector() {
    const developers = allUsers.filter(u => 
        u.role === 'developer' && u.id !== viewingUserId
    );
    
    if (developers.length === 0) {
        memberSelectorOptions.innerHTML = `<span style="color: var(--text-muted); font-size: 0.75rem;">${getText('noDevelopers') || 'Keine weiteren Entwickler verfügbar'}</span>`;
        return;
    }
    
    memberSelectorOptions.innerHTML = '';
    
    developers.forEach(user => {
        const label = document.createElement('label');
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = user.id;
        checkbox.checked = selectedComparisonUsers.includes(user.id);
        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
                if (!selectedComparisonUsers.includes(user.id)) {
                    selectedComparisonUsers.push(user.id);
                }
            } else {
                selectedComparisonUsers = selectedComparisonUsers.filter(id => id !== user.id);
            }
            renderCalendar();
            renderTotalTime();
            if (selectedDate) {
                renderDayDetails(selectedDate);
            }
        });
        
        const colorDot = document.createElement('span');
        colorDot.className = 'member-color';
        colorDot.style.background = '#9ca3af';
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'member-name';
        nameSpan.textContent = user.fullName;
        
        const roleSpan = document.createElement('span');
        roleSpan.className = 'member-role';
        roleSpan.textContent = user.role === 'developer' ? '👨‍💻' : '👁️';
        
        label.appendChild(checkbox);
        label.appendChild(colorDot);
        label.appendChild(nameSpan);
        label.appendChild(roleSpan);
        
        if (selectedComparisonUsers.includes(user.id)) {
            label.className = 'comparison';
        }
        
        memberSelectorOptions.appendChild(label);
    });
}

// ======================= CALENDAR RENDERING =======================

function renderCalendar() {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();
    let startOffset = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
    
    currentMonthDisplay.textContent = `${getMonthName(currentMonth)} ${currentYear}`;
    
    const allViewingUsers = [viewingUserId, ...selectedComparisonUsers];
    const monthEntries = getEntriesForMonth(currentYear, currentMonth, allViewingUsers);
    const viewingUserEntries = monthEntries.filter(e => e.userId === viewingUserId);
    const monthTotalMinutes = calculateMonthTotal(viewingUserEntries);
    const hours = Math.floor(monthTotalMinutes / 60);
    const minutes = monthTotalMinutes % 60;
    monthTotal.textContent = `${getText('monthTotal')} ${hours}h ${minutes}m`;
    
    let html = '';
    const today = new Date();
    const todayDate = today.getDate();
    const todayMonth = today.getMonth();
    const todayYear = today.getFullYear();
    
    for (let i = 0; i < startOffset; i++) {
        html += `<div class="calendar-day empty"></div>`;
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(currentYear, currentMonth, day);
        const dateStr = date.toISOString().split('T')[0];
        const isToday = day === todayDate && currentMonth === todayMonth && currentYear === todayYear;
        const isSelected = selectedDate === dateStr;
        
        const dayEntries = monthEntries.filter(e => {
            if (!e.timestampISO) return false;
            const entryDate = e.timestampISO.split('T')[0];
            return entryDate === dateStr;
        });
        
        const primaryEntries = dayEntries.filter(e => e.userId === viewingUserId);
        const comparisonEntries = dayEntries.filter(e => e.userId !== viewingUserId);
        
        const dayTotalMinutes = calculateDayTotal(primaryEntries);
        const hasEntries = dayTotalMinutes > 0 || comparisonEntries.length > 0;
        
        let barsHtml = '';
        
        if (primaryEntries.length > 0) {
            const total = calculateDayTotal(primaryEntries);
            const hours = Math.floor(total / 60);
            const minutes = total % 60;
            const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
            
            barsHtml += `
                <div class="day-bar primary" style="background: ${userColors[viewingUserId] || '#3b82f6'}">
                    <div class="bar-tooltip">${viewingUser.fullName}: ${timeStr}</div>
                </div>
            `;
        }
        
        if (comparisonEntries.length > 0) {
            const userGroups = {};
            comparisonEntries.forEach(entry => {
                if (!userGroups[entry.userId]) {
                    userGroups[entry.userId] = [];
                }
                userGroups[entry.userId].push(entry);
            });
            
            for (const uid in userGroups) {
                const userId = parseInt(uid);
                const user = allUsers.find(u => u.id === userId);
                const entries = userGroups[uid];
                const total = calculateDayTotal(entries);
                const hours = Math.floor(total / 60);
                const minutes = total % 60;
                const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
                
                barsHtml += `
                    <div class="day-bar comparison" style="background: #9ca3af">
                        <div class="bar-tooltip">${user ? user.fullName : 'Unknown'}: ${timeStr}</div>
                    </div>
                `;
            }
        }
        
        let totalText = '';
        if (hasEntries) {
            const total = calculateDayTotal(primaryEntries);
            if (total > 0) {
                const hours = Math.floor(total / 60);
                const minutes = total % 60;
                totalText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
            }
        }
        
        const classes = `calendar-day${hasEntries ? ' has-entries' : ''}${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}`;
        
        html += `
            <div class="${classes}" data-date="${dateStr}" data-day="${day}" data-has-entries="${hasEntries}">
                <span class="day-number">${day}</span>
                ${barsHtml ? `<div class="day-bars">${barsHtml}</div>` : ''}
                ${totalText ? `<span class="day-total">${totalText}</span>` : ''}
            </div>
        `;
    }
    
    calendarDays.innerHTML = html;
    
    document.querySelectorAll('.calendar-day:not(.empty)').forEach(el => {
        el.addEventListener('click', () => {
            const dateStr = el.dataset.date;
            const hasEntries = el.dataset.hasEntries === 'true';
            selectedDate = dateStr;
            
            document.querySelectorAll('.calendar-day').forEach(d => d.classList.remove('selected'));
            el.classList.add('selected');
            
            renderDayDetails(dateStr);
        });
    });
}

// ======================= DATA PROCESSING =======================

function getEntriesForMonth(year, month, userIds) {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];
    
    return allEntries.filter(e => {
        if (!e.timestampISO) return false;
        if (!userIds.includes(e.userId)) return false;
        const date = e.timestampISO.split('T')[0];
        return date >= startStr && date <= endStr;
    });
}

function calculateDayTotal(entries) {
    let totalMinutes = 0;
    let currentStart = null;
    
    const sorted = [...entries].sort((a, b) => {
        if (!a.timestampISO) return 1;
        if (!b.timestampISO) return -1;
        return a.timestampISO.localeCompare(b.timestampISO);
    });
    
    for (const entry of sorted) {
        if (entry.action === 'start') {
            currentStart = entry;
        } else if (entry.action === 'stop' && currentStart) {
            const startTime = new Date(currentStart.timestampISO);
            const stopTime = new Date(entry.timestampISO);
            const diffMinutes = (stopTime - startTime) / (1000 * 60);
            if (diffMinutes > 0) {
                totalMinutes += diffMinutes;
            }
            currentStart = null;
        }
    }
    
    return Math.round(totalMinutes);
}

function calculateMonthTotal(entries) {
    const dayGroups = {};
    entries.forEach(entry => {
        if (!entry.timestampISO) return;
        const date = entry.timestampISO.split('T')[0];
        if (!dayGroups[date]) {
            dayGroups[date] = [];
        }
        dayGroups[date].push(entry);
    });
    
    let totalMinutes = 0;
    for (const date in dayGroups) {
        totalMinutes += calculateDayTotal(dayGroups[date]);
    }
    return Math.round(totalMinutes);
}

// ======================= RENDER TOTAL TIME =======================

function renderTotalTime() {
    const viewingUserEntries = allEntries.filter(e => e.userId === viewingUserId);
    const viewingTotalMinutes = calculateMonthTotal(viewingUserEntries);
    const viewingHours = Math.floor(viewingTotalMinutes / 60);
    const viewingMinutes = viewingTotalMinutes % 60;
    
    let comparisonTotalMinutes = 0;
    let comparisonUserNames = [];
    for (const userId of selectedComparisonUsers) {
        const userEntries = allEntries.filter(e => e.userId === userId);
        const total = calculateMonthTotal(userEntries);
        comparisonTotalMinutes += total;
        const user = allUsers.find(u => u.id === userId);
        if (user) {
            comparisonUserNames.push(user.fullName);
        }
    }
    
    const compHours = Math.floor(comparisonTotalMinutes / 60);
    const compMinutes = comparisonTotalMinutes % 60;
    
    let displayText = `<span style="font-weight: 700;">${viewingHours}h ${viewingMinutes}m</span>`;
    
    if (selectedComparisonUsers.length > 0) {
        const compText = `${compHours}h ${compMinutes}m`;
        displayText += `<span style="font-size: 0.8rem; font-weight: 400; color: var(--text-muted);">  |  ⚪ ${compText}</span>`;
        
        if (comparisonTotalMinutes > 0 || viewingTotalMinutes > 0) {
            const diff = viewingTotalMinutes - comparisonTotalMinutes;
            const diffHours = Math.floor(Math.abs(diff) / 60);
            const diffMinutes = Math.abs(diff) % 60;
            const diffStr = diffHours > 0 ? `${diffHours}h ${diffMinutes}m` : `${diffMinutes}m`;
            
            let diffDisplay = '';
            if (diff > 10) {
                diffDisplay = `<span style="color: #34d399; font-size: 0.75rem;">(+${diffStr} ${getText('more')})</span>`;
            } else if (diff < -10) {
                diffDisplay = `<span style="color: #ef4444; font-size: 0.75rem;">(-${diffStr} ${getText('less')})</span>`;
            } else if (Math.abs(diff) <= 10) {
                diffDisplay = `<span style="color: #fbbf24; font-size: 0.75rem;">(≈ ${getText('equal')})</span>`;
            }
            
            if (diffDisplay) {
                displayText += ` <span style="font-size: 0.75rem;">${diffDisplay}</span>`;
            }
        }
        
        if (comparisonUserNames.length > 0) {
            displayText += `<div style="font-size: 0.6rem; color: var(--text-muted); font-weight: 400; margin-top: 2px;">
                ${comparisonUserNames.join(' & ')}
            </div>`;
        }
    }
    
    totalTimeValue.innerHTML = displayText;
}

// ======================= DAY DETAILS =======================

function renderDayDetails(dateStr) {
    const date = new Date(dateStr);
    const day = date.getDate();
    const month = date.getMonth();
    const year = date.getFullYear();
    
    dayDetailsTitle.textContent = `📅 ${day}. ${getMonthName(month)} ${year}`;
    
    const allViewingUsers = [viewingUserId, ...selectedComparisonUsers];
    const dayEntries = allEntries.filter(e => {
        if (!e.timestampISO) return false;
        if (!allViewingUsers.includes(e.userId)) return false;
        const entryDate = e.timestampISO.split('T')[0];
        return entryDate === dateStr;
    });
    
    if (dayEntries.length === 0) {
        dayDetailsContent.innerHTML = `
            <p style="color: var(--text-muted); text-align: center; padding: 20px;">
                ${getText('noEntries')}
            </p>
        `;
        return;
    }
    
    const sessions = [];
    let currentSession = null;
    const sorted = [...dayEntries].sort((a, b) => {
        if (!a.timestampISO) return 1;
        if (!b.timestampISO) return -1;
        return a.timestampISO.localeCompare(b.timestampISO);
    });
    
    for (const entry of sorted) {
        if (entry.action === 'start') {
            currentSession = {
                start: entry,
                stop: null,
                user: allUsers.find(u => u.id === entry.userId),
                task: allTasks.find(t => t.id === entry.taskId),
                isPrimary: entry.userId === viewingUserId
            };
        } else if (entry.action === 'stop' && currentSession) {
            currentSession.stop = entry;
            sessions.push(currentSession);
            currentSession = null;
        }
    }
    
    if (currentSession) {
        sessions.push(currentSession);
    }
    
    let html = '';
    const primarySessions = sessions.filter(s => s.isPrimary);
    const comparisonSessions = sessions.filter(s => !s.isPrimary);
    
    for (const session of primarySessions) {
        html += renderSessionItem(session, false);
    }
    
    if (comparisonSessions.length > 0) {
        html += `<div style="margin: 8px 0 4px; font-size: 0.7rem; color: var(--text-muted); border-top: 1px dashed var(--border-color); padding-top: 8px;">
            ${getText('forComparison')}
        </div>`;
        for (const session of comparisonSessions) {
            html += renderSessionItem(session, true);
        }
    }
    
    const primaryTotal = primarySessions.reduce((sum, s) => {
        const start = new Date(s.start.timestampISO);
        const stop = s.stop ? new Date(s.stop.timestampISO) : new Date();
        return sum + Math.round((stop - start) / (1000 * 60));
    }, 0);
    const totalHours = Math.floor(primaryTotal / 60);
    const totalMins = primaryTotal % 60;
    const totalStr = totalHours > 0 ? `${totalHours}h ${totalMins}m` : `${totalMins}m`;
    
    html = `
        <div style="margin-bottom: 10px; padding: 6px 10px; background: var(--bg-input); border-radius: 6px; display: flex; justify-content: space-between; font-size: 0.85rem;">
            <span>${getText('total')} (${viewingUser.fullName})</span>
            <span style="font-weight: 600;">${totalStr}</span>
        </div>
        ${html}
    `;
    
    dayDetailsContent.innerHTML = html;
}

function renderSessionItem(session, isComparison) {
    const startTime = new Date(session.start.timestampISO);
    const stopTime = session.stop ? new Date(session.stop.timestampISO) : new Date();
    const duration = Math.round((stopTime - startTime) / (1000 * 60));
    const hours = Math.floor(duration / 60);
    const minutes = duration % 60;
    const durationStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    
    const timeStr = session.stop 
        ? `${startTime.toLocaleTimeString()} - ${stopTime.toLocaleTimeString()}`
        : `${startTime.toLocaleTimeString()} - ${getText('running')}`;
    
    const userColor = session.isPrimary ? userColors[session.user.id] : '#9ca3af';
    const taskName = session.task ? session.task.taskName : `Task ${session.start.taskId}`;
    const stateDisplay = session.start.taskState === '---' 
        ? getText('sameState')
        : session.start.taskState;
    
    const comparisonClass = isComparison ? 'comparison' : '';
    
    return `
        <div class="entry-item ${comparisonClass}" style="border-left-color: ${userColor}">
            <div class="entry-header">
                <span>
                    <strong>${taskName}</strong>
                    <span style="font-size: 0.7rem; color: var(--text-muted);"> (${stateDisplay})</span>
                </span>
                <span style="font-weight: 600; font-size: 0.8rem;">${durationStr}</span>
            </div>
            <div class="entry-time">${timeStr}</div>
            ${session.user && session.user.id !== viewingUserId 
                ? `<div class="entry-user">👤 ${session.user.fullName}</div>` 
                : ''}
            ${session.start.description && session.start.description !== '---' 
                ? `<div class="entry-desc">📝 ${session.start.description}</div>` 
                : ''}
        </div>
    `;
}

// ======================= NAVIGATION =======================

function navigateMonth(delta) {
    const newDate = new Date(currentYear, currentMonth + delta, 1);
    currentMonth = newDate.getMonth();
    currentYear = newDate.getFullYear();
    selectedDate = null;
    renderCalendar();
    renderTotalTime();
    dayDetailsTitle.textContent = getText('selectDay');
    dayDetailsContent.innerHTML = `
        <p style="color: var(--text-muted); text-align: center; padding: 20px;">
            ${getText('clickDayForDetails')}
        </p>
    `;
}

function goToFirstMonth() {
    const viewingUserEntries = allEntries.filter(e => e.userId === viewingUserId);
    if (viewingUserEntries.length === 0) return;
    const sorted = [...viewingUserEntries].filter(e => e.timestampISO).sort((a, b) => a.timestampISO.localeCompare(b.timestampISO));
    if (sorted.length === 0) return;
    const firstDate = new Date(sorted[0].timestampISO);
    currentMonth = firstDate.getMonth();
    currentYear = firstDate.getFullYear();
    selectedDate = null;
    renderCalendar();
    renderTotalTime();
    dayDetailsTitle.textContent = getText('selectDay');
    dayDetailsContent.innerHTML = `
        <p style="color: var(--text-muted); text-align: center; padding: 20px;">
            ${getText('clickDayForDetails')}
        </p>
    `;
}

function goToLastMonth() {
    const viewingUserEntries = allEntries.filter(e => e.userId === viewingUserId);
    if (viewingUserEntries.length === 0) return;
    const sorted = [...viewingUserEntries].filter(e => e.timestampISO).sort((a, b) => b.timestampISO.localeCompare(a.timestampISO));
    if (sorted.length === 0) return;
    const lastDate = new Date(sorted[0].timestampISO);
    currentMonth = lastDate.getMonth();
    currentYear = lastDate.getFullYear();
    selectedDate = null;
    renderCalendar();
    renderTotalTime();
    dayDetailsTitle.textContent = getText('selectDay');
    dayDetailsContent.innerHTML = `
        <p style="color: var(--text-muted); text-align: center; padding: 20px;">
            ${getText('clickDayForDetails')}
        </p>
    `;
}

// ======================= LANGUAGE =======================

function updateLanguage() {
    const t = translations[currentLanguage];
    
    document.getElementById('calendarTitle').textContent = t.calendarTitle || '📅 Zeitkalender';
    document.getElementById('memberSelectorLabel').textContent = isSupervisor 
        ? (t.compareMembers || '👥 Zum Vergleich hinzufügen')
        : '';
    document.querySelector('.total-time-label').textContent = t.totalTime || '⏱️ Gesamtzeit';
    
    // Update weekday labels
    document.querySelectorAll('.calendar-weekdays span').forEach((el, index) => {
        el.textContent = getWeekdayName(index);
    });
    
    // Update month display
    renderCalendar();
    
    // Update day details if selected
    if (selectedDate) {
        renderDayDetails(selectedDate);
    } else {
        dayDetailsTitle.textContent = t.selectDay || '📅 Tag auswählen';
        dayDetailsContent.innerHTML = `
            <p style="color: var(--text-muted); text-align: center; padding: 20px;">
                ${t.clickDayForDetails || 'Klicke auf einen Tag im Kalender<br>um Details zu sehen'}
            </p>
        `;
    }
}

// ======================= EVENT LISTENERS =======================

function setupEventListeners() {
    // Theme toggle - mit sessionStorage
    document.getElementById('themeToggle').addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        sessionStorage.setItem('theme', newTheme);
        document.getElementById('themeIcon').textContent = newTheme === 'dark' ? '🌙' : '☀️';
    });

    // Language selector - mit sessionStorage
    document.getElementById('languageSelect').addEventListener('change', (e) => {
        currentLanguage = e.target.value;
        sessionStorage.setItem('language', currentLanguage);
        updateLanguage();
    });

    backBtn.addEventListener('click', () => {
        window.location.href = '../index.html';
    });

    prevMonthBtn.addEventListener('click', () => navigateMonth(-1));
    nextMonthBtn.addEventListener('click', () => navigateMonth(1));
    firstMonthBtn.addEventListener('click', goToFirstMonth);
    lastMonthBtn.addEventListener('click', goToLastMonth);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') navigateMonth(-1);
        else if (e.key === 'ArrowRight') navigateMonth(1);
        else if (e.key === 'Escape') {
            window.location.href = '../index.html';
        }
    });
}

// ======================= START =======================

// Start the app
initCalendar().catch(e => console.error('Calendar init error:', e));