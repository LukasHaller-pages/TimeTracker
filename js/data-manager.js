// ======================= DATA CONFIG =======================

const DATA_CONFIG = {
    USERS_FILE: "users.csv",
    TASKS_FILE: "tasks.csv",
    TRACKING_FILE: "tracking.csv"
};

// ======================= CSV HELPER =======================

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    
    return result.map(field => {
        let cleaned = field.trim();
        if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
            cleaned = cleaned.slice(1, -1);
        }
        return cleaned;
    });
}

function serializeCSVRow(row) {
    return row.map(field => {
        const str = String(field);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    }).join(',');
}

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

// ======================= USERS =======================

async function loadUsersFromGitLab() {
    try {
        const content = await fetchGitLabFileContent(DATA_CONFIG.USERS_FILE);
        if (!content || content.trim() === '') return [];
        const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length === 0) return [];
        
        const startIdx = lines[0].includes('id,firstname,surname,role') ? 1 : 0;
        const users = [];
        for (let i = startIdx; i < lines.length; i++) {
            const parts = parseCSVLine(lines[i]);
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
    const header = ['id', 'firstname', 'surname', 'role'];
    const rows = users.map(u => [u.id, u.firstname, u.surname, u.role]);
    const content = [header.join(','), ...rows.map(row => serializeCSVRow(row))].join('\n');
    await updateGitLabFile(DATA_CONFIG.USERS_FILE, content, "Update users list");
}

// ======================= TASKS =======================

// HILFSFUNKTION: Entfernt alle , ; und " aus Texten
function sanitizeForCSV(text) {
    if (!text) return "---";
    let cleaned = String(text);
    // Ersetze alle Kommas, Semikolons und Anführungszeichen durch Leerzeichen
    cleaned = cleaned.replace(/[,;"]/g, ' ');
    // Entferne mehrfache Leerzeichen
    cleaned = cleaned.replace(/\s+/g, ' ');
    return cleaned.trim();
}

async function loadTasksFromGitLab() {
    try {
        const content = await fetchGitLabFileContent(DATA_CONFIG.TASKS_FILE);
        if (!content || content.trim() === '') return [];
        const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length === 0) return [];
        
        const hasIssueId = lines[0].includes('issue_id');
        const tasks = [];
        for (let i = 1; i < lines.length; i++) {
            const parts = lines[i].split(',').map(p => p.trim());
            if (parts.length >= 4) {
                const task = new Task(
                    parseInt(parts[0]),
                    parts[1],
                    parts[2],
                    parts[3]
                );
                if (hasIssueId && parts.length >= 5 && parts[4] && parts[4] !== '') {
                    task.issueId = parseInt(parts[4]);
                }
                tasks.push(task);
            }
        }
        return tasks;
    } catch (err) {
        console.warn("Fehler beim laden der Tasks aus GitLab", err);
        return [];
    }
}

async function saveTasksToGitLab(tasks) {
    const header = 'id,task_name,description,definition_of_done,issue_id';
    const rows = tasks.map(t => {
        const issueId = t.issueId || '';
        // ALLE problematischen Zeichen entfernen!
        const taskName = sanitizeForCSV(t.taskName);
        const description = sanitizeForCSV(t.description);
        const definitionOfDone = sanitizeForCSV(t.definitionOfDone);
        return [t.id, taskName, description, definitionOfDone, issueId];
    });
    const content = [header, ...rows.map(row => row.join(','))].join('\n');
    await updateGitLabFile(DATA_CONFIG.TASKS_FILE, content, "Update tasks list");
}

// ======================= TRACKING =======================

async function loadTrackingFromGitLab() {
    try {
        const content = await fetchGitLabFileContent(DATA_CONFIG.TRACKING_FILE);
        if (!content || content.trim() === '') return [];
        const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length === 0) return [];
        
        const startIdx = lines[0].includes('id,user_id,action') ? 1 : 0;
        const entries = [];
        for (let i = startIdx; i < lines.length; i++) {
            const parts = lines[i].split(',').map(p => p.trim());
            if (parts.length >= 11) {
                const entry = new TrackingEntry(
                    parseInt(parts[1]),
                    parts[2],
                    parseInt(parts[8]),
                    parts[9],
                    parts[10]
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

// ======================= ISSUES SYNC =======================

async function fetchIssuesJson() {
    try {
        const response = await fetch('issues.json');
        if (!response.ok) {
            const fallbackResponse = await fetch('https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/issues.json');
            if (!fallbackResponse.ok) return null;
            return await fallbackResponse.json();
        }
        return await response.json();
    } catch (err) {
        console.warn('Could not fetch issues.json:', err);
        return null;
    }
}

async function syncIssuesToTasks() {
    try {
        const issuesJson = await fetchIssuesJson();
        if (!issuesJson || issuesJson.length === 0) {
            throw new Error('Keine Issues in issues.json gefunden');
        }
        
        console.log(`📥 ${issuesJson.length} Issues geladen`);
        
        // 2. Lade bestehende Tasks
        let tasks = await loadTasksFromGitLab();
        
        // 3. ALLE Tasks mit issueId entfernen (das sind die Sync-Tasks)
        const manualTasks = tasks.filter(t => !t.issueId);
        const oldIssueTasks = tasks.filter(t => t.issueId);
        
        console.log(`🗑️ ${oldIssueTasks.length} alte Issue-Tasks werden ersetzt`);
        console.log(`📝 ${manualTasks.length} manuelle Tasks bleiben erhalten`);
        
        // 4. Neue Tasks aus Issues erstellen
        let maxTaskId = manualTasks.reduce((max, t) => Math.max(max, t.id || 0), 0);
        let added = 0;
        const newTasks = [...manualTasks];
        
        for (const issue of issuesJson) {
            // Extrahiere DoD aus Description
            let description = issue.description || "";
            let definitionOfDone = "";
            if (description.includes('DoD:')) {
                const dodIndex = description.indexOf('DoD:');
                definitionOfDone = description.substring(dodIndex + 4).trim();
                description = description.substring(0, dodIndex).trim();
            }
            
            // Assigne Info für Beschreibung
            const assigneeName = issue.assignees && issue.assignees.length > 0 
                ? issue.assignees[0].name || issue.assignees[0].username || "---"
                : "---";
            const labels = issue.labels ? issue.labels.join(', ') : "---";
            const state = issue.state || "opened";
            const createdAt = issue.created_at || "";
            const updatedAt = issue.updated_at || "";
            
            // Baue Task Description mit allen Infos
            const fullDescription = [
                description || "---",
                `State: ${state}`,
                `Assignee: ${assigneeName}`,
                `Labels: ${labels}`,
                `Created: ${createdAt}`,
                `Updated: ${updatedAt}`
            ].filter(s => s && !s.includes('---')).join(' | ');
            
            // Neue Task erstellen
            maxTaskId++;
            const newTask = new Task(
                maxTaskId,
                issue.title || "---",
                fullDescription || "---",
                definitionOfDone || "---"
            );
            newTask.issueId = issue.id;
            newTasks.push(newTask);
            added++;
        }
        
        // 5. Tasks speichern (alte Issue-Tasks wurden gelöscht)
        await saveTasksToGitLab(newTasks);
        console.log(`✅ ${added} Issue-Tasks neu erstellt (${manualTasks.length} manuelle Tasks erhalten)`);
        
        return { added, total: issuesJson.length, manual: manualTasks.length };
    } catch (err) {
        console.error('Sync Issues Fehler:', err);
        throw err;
    }
}