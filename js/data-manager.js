// ======================= DATA CONFIG =======================

const DATA_CONFIG = {
    USERS_FILE: "users.csv",
    TASKS_FILE: "tasks.csv",
    TRACKING_FILE: "tracking.csv"
};

// ======================= GITLAB API HELPER =======================

const PROJECT_ID_ENC = encodeURIComponent(CONFIG.PROJECT_ID);
const BASE_URL = `${CONFIG.GITLAB_URL}/api/v4/projects/${PROJECT_ID_ENC}/repository/files`;

async function fetchGitLabFileContent(filePath) {
    const fileEnc = encodeURIComponent(filePath);
    const url = `${BASE_URL}/${fileEnc}/raw?ref=${CONFIG.BRANCH}`;
    try {
        const resp = await fetch(url, {
            headers: { "PRIVATE-TOKEN": CONFIG.GITLAB_TOKEN }
        });
        if (resp.status === 404) return null;
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return await resp.text();
    } catch (err) {
        console.warn(`fetch ${filePath} failed:`, err);
        return null;
    }
}

async function updateGitLabFile(filePath, content, commitMsg) {
    const fileEnc = encodeURIComponent(filePath);
    const url = `${BASE_URL}/${fileEnc}`;
    const payload = {
        branch: CONFIG.BRANCH,
        content: content,
        commit_message: commitMsg,
        encoding: "text"
    };
    try {
        const resp = await fetch(url, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "PRIVATE-TOKEN": CONFIG.GITLAB_TOKEN
            },
            body: JSON.stringify(payload)
        });
        if (!resp.ok) {
            const errText = await resp.text();
            throw new Error(`GitLab PUT error ${resp.status}: ${errText}`);
        }
        return true;
    } catch (err) {
        console.error(`Fehler beim Schreiben von ${filePath}:`, err);
        throw err;
    }
}

// ======================= DATA ACCESS =======================

async function loadUsersFromGitLab() {
    try {
        const content = await fetchGitLabFileContent(DATA_CONFIG.USERS_FILE);
        if (!content || content.trim() === '') return [];
        const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length === 0) return [];
        
        const startIdx = lines[0].includes('id,firstname,surname,role') ? 1 : 0;
        const users = [];
        for (let i = startIdx; i < lines.length; i++) {
            const parts = lines[i].split(',').map(p => p.trim());
            if (parts.length >= 4) {
                users.push(new User(
                    parseInt(parts[0]),
                    parts[1],
                    parts[2],
                    parts[3]
                ));
            }
        }
        return users;
    } catch (err) {
        console.warn("Fehler beim laden der Benutzer aus GitLab", err);
        return [];
    }
}

async function saveUsersToGitLab(users) {
    const header = 'id,firstname,surname,role';
    const rows = users.map(u => `${u.id},${u.firstname},${u.surname},${u.role}`);
    const content = [header, ...rows].join('\n');
    await updateGitLabFile(DATA_CONFIG.USERS_FILE, content, "Update users list");
}

async function loadTasksFromGitLab() {
    try {
        const content = await fetchGitLabFileContent(DATA_CONFIG.TASKS_FILE);
        if (!content || content.trim() === '') return [];
        const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length === 0) return [];
        
        const startIdx = lines[0].includes('id,task_name,description,definition_of_done') ? 1 : 0;
        const tasks = [];
        for (let i = startIdx; i < lines.length; i++) {
            const parts = lines[i].split(',').map(p => p.trim());
            if (parts.length >= 4) {
                tasks.push(new Task(
                    parseInt(parts[0]),
                    parts[1],
                    parts[2],
                    parts[3]
                ));
            }
        }
        return tasks;
    } catch (err) {
        console.warn("Fehler beim laden der Tasks aus GitLab", err);
        return [];
    }
}

async function saveTasksToGitLab(tasks) {
    const header = 'id,task_name,description,definition_of_done';
    const rows = tasks.map(t => `${t.id},${t.taskName},${t.description},${t.definitionOfDone}`);
    const content = [header, ...rows].join('\n');
    await updateGitLabFile(DATA_CONFIG.TASKS_FILE, content, "Update tasks list");
}

async function loadTrackingFromGitLab() {
    try {
        const content = await fetchGitLabFileContent(DATA_CONFIG.TRACKING_FILE);
        if (!content || content.trim() === '') return [];
        const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length === 0) return [];
        
        // Check if header exists
        const startIdx = lines[0].includes('id,user_id,action') ? 1 : 0;
        const entries = [];
        for (let i = startIdx; i < lines.length; i++) {
            const parts = lines[i].split(',').map(p => p.trim());
            if (parts.length >= 11) {
                const entry = new TrackingEntry(
                    parseInt(parts[1]),  // user_id
                    parts[2],            // action
                    parseInt(parts[8]),  // task_id
                    parts[9],            // task_state
                    parts[10]            // description
                );
                entry.id = parseInt(parts[0]);
                entry.timestampBrowser = parts[3];
                entry.timestampUTC = parts[4];
                entry.timestampISO = parts[5];
                entry.browserTimezone = parts[6];
                entry.browserOffset = parseInt(parts[7]);
                entries.push(entry);
            }
        }
        return entries;
    } catch (err) {
        console.warn("Fehler beim laden der Tracking-Daten aus GitLab", err);
        return [];
    }
}

async function saveTrackingEntryToGitLab(entry) {
    console.log('Saving tracking entry:', entry);
    
    const entries = await loadTrackingFromGitLab();
    const maxId = entries.reduce((max, e) => Math.max(max, e.id || 0), 0);
    entry.id = maxId + 1;
    entries.push(entry);
    
    const header = 'id,user_id,action,timestamp_browser,timestamp_utc,timestamp_iso,browser_timezone,browser_offset,task_id,task_state,description';
    const rows = entries.map(e => 
        `${e.id},${e.userId},${e.action},${e.timestampBrowser},${e.timestampUTC},${e.timestampISO},${e.browserTimezone},${e.browserOffset},${e.taskId},${e.taskState},${e.description}`
    );
    const content = [header, ...rows].join('\n');
    
    console.log('CSV content to save:', content);
    
    await updateGitLabFile(DATA_CONFIG.TRACKING_FILE, content, `Track ${entry.action} for user ${entry.userId}`);
    return entry;
}

async function getLastTrackingEntry(userId) {
    const entries = await loadTrackingFromGitLab();
    const userEntries = entries.filter(e => e.userId === userId);
    if (userEntries.length === 0) return null;
    return userEntries[userEntries.length - 1];
}

async function getUserCurrentState(userId) {
    const entries = await loadTrackingFromGitLab();
    const userEntries = entries.filter(e => e.userId === userId);
    if (userEntries.length === 0) return null;
    
    const lastEntry = userEntries[userEntries.length - 1];
    if (lastEntry.action === 'start') {
        let taskState = lastEntry.taskState;
        if (taskState === "---") {
            for (let i = userEntries.length - 2; i >= 0; i--) {
                if (userEntries[i].taskId === lastEntry.taskId && 
                    userEntries[i].taskState !== "---") {
                    taskState = userEntries[i].taskState;
                    break;
                }
            }
        }
        return {
            userId: userId,
            taskId: lastEntry.taskId,
            taskState: taskState,
            timestampUTC: lastEntry.timestampUTC,
            timestampISO: lastEntry.timestampISO,
            isActive: true
        };
    }
    return null;
}