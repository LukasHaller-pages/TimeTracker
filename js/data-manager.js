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
// ======================= ISSUES CSV =======================

const ISSUES_CSV_PATH = "issues.csv";

// JSON aus issues.json laden (von GitHub Action erstellt)
async function fetchIssuesJson() {
    try {
        const response = await fetch('issues.json');
        if (!response.ok) return null;
        return await response.json();
    } catch (err) {
        console.warn('Could not fetch issues.json:', err);
        return null;
    }
}

// Issues aus CSV laden
async function loadIssuesFromCsv() {
    try {
        const content = await fetchGitLabFileContent(ISSUES_CSV_PATH);
        if (!content || content.trim() === '') return [];
        const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length === 0) return [];
        
        const startIdx = lines[0].includes('id,issue_id,title,description,definition_of_done,state,assignee,created_at,updated_at,labels') ? 1 : 0;
        const issues = [];
        for (let i = startIdx; i < lines.length; i++) {
            const parts = lines[i].split(',').map(p => p.trim());
            if (parts.length >= 8) {
                issues.push({
                    id: parseInt(parts[0]),
                    issueId: parseInt(parts[1]),
                    title: parts[2],
                    description: parts[3] || "---",
                    definitionOfDone: parts[4] || "---",
                    state: parts[5] || "opened",
                    assignee: parts[6] || "---",
                    created_at: parts[7] || "",
                    updated_at: parts[8] || "",
                    labels: parts[9] || "---"
                });
            }
        }
        return issues;
    } catch (err) {
        console.warn("Fehler beim laden der Issues CSV:", err);
        return [];
    }
}

// Issues in CSV speichern
async function saveIssuesToCsv(issues) {
    const header = 'id,issue_id,title,description,definition_of_done,state,assignee,created_at,updated_at,labels';
    const rows = issues.map(i => {
        // Escape commas in fields
        const title = i.title.includes(',') ? `"${i.title}"` : i.title;
        const desc = i.description.includes(',') ? `"${i.description}"` : i.description;
        const dod = i.definitionOfDone.includes(',') ? `"${i.definitionOfDone}"` : i.definitionOfDone;
        const labels = i.labels.includes(',') ? `"${i.labels}"` : i.labels;
        return `${i.id},${i.issueId},${title},${desc},${dod},${i.state},${i.assignee},${i.created_at},${i.updated_at},${labels}`;
    });
    const content = [header, ...rows].join('\n');
    await updateGitLabFile(ISSUES_CSV_PATH, content, "Update issues list");
}

// Issues in tasks.csv übertragen
async function syncIssuesToTasks() {
    // 1. Lade Issues aus CSV
    const issues = await loadIssuesFromCsv();
    if (issues.length === 0) {
        console.log('ℹ️ Keine Issues zum Syncronisieren');
        return { added: 0, updated: 0 };
    }
    
    // 2. Lade bestehende Tasks
    const tasks = await loadTasksFromGitLab();
    const taskMap = {};
    tasks.forEach(t => { taskMap[t.id] = t; });
    
    // 3. Finde die höchste Task ID
    let maxTaskId = tasks.reduce((max, t) => Math.max(max, t.id || 0), 0);
    
    let added = 0;
    let updated = 0;
    const updatedTasks = [];
    
    // 4. Für jedes Issue: Task erstellen oder aktualisieren
    for (const issue of issues) {
        // Finde Task mit dieser Issue ID
        const existingTask = tasks.find(t => t.issueId === issue.issueId);
        
        if (existingTask) {
            // Task existiert - prüfe ob sich was geändert hat
            const taskName = issue.title;
            const description = issue.description || "---";
            const definitionOfDone = issue.definitionOfDone || "---";
            
            if (existingTask.taskName !== taskName || 
                existingTask.description !== description || 
                existingTask.definitionOfDone !== definitionOfDone) {
                // Update Task
                existingTask.taskName = taskName;
                existingTask.description = description;
                existingTask.definitionOfDone = definitionOfDone;
                updatedTasks.push(existingTask);
                updated++;
            }
        } else {
            // Neues Issue → Neue Task
            maxTaskId++;
            const newTask = new Task(
                maxTaskId,
                issue.title,
                issue.description || "---",
                issue.definitionOfDone || "---"
            );
            // Speichere Issue ID für späteren Abgleich
            newTask.issueId = issue.issueId;
            tasks.push(newTask);
            added++;
        }
    }
    
    // 5. Tasks speichern
    if (added > 0 || updated > 0) {
        await saveTasksToGitLab(tasks);
        console.log(`✅ ${added} neue Tasks erstellt, ${updated} aktualisiert`);
    }
    
    return { added, updated };
}

// GitHub Action ausführen (via API)
async function triggerGitHubAction() {
    // GitHub API Token aus config
    const GITHUB_TOKEN = CONFIG.GITHUB_TOKEN;
    const REPO_OWNER = CONFIG.REPO_OWNER;
    const REPO_NAME = CONFIG.REPO_NAME;
    const WORKFLOW_ID = "update-issues.yml";
    
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_ID}/dispatches`;
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify({
                ref: 'main'
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`GitHub API error: ${response.status} - ${errorText}`);
        }
        
        console.log('✅ GitHub Action triggered successfully');
        return true;
    } catch (err) {
        console.error('Fehler beim Ausführen der GitHub Action:', err);
        throw err;
    }
}

// Hauptfunktion: Update Issues
async function updateIssues() {
    try {
        // 1. GitHub Action ausführen
        await triggerGitHubAction();
        
        // 2. Warten bis die Action fertig ist (max 30 Sekunden)
        let attempts = 0;
        const maxAttempts = 30;
        let issuesJson = null;
        
        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1 Sekunde warten
            issuesJson = await fetchIssuesJson();
            if (issuesJson && issuesJson.length > 0) {
                break;
            }
            attempts++;
        }
        
        if (!issuesJson || issuesJson.length === 0) {
            throw new Error('Keine Issues in issues.json gefunden nach Ausführung der Action');
        }
        
        // 3. Issues aus JSON importieren
        const imported = await importIssuesFromJson(issuesJson);
        
        // 4. Issues in Tasks syncronisieren
        const result = await syncIssuesToTasks();
        
        return {
            imported: imported.length,
            added: result.added,
            updated: result.updated,
            total: imported.length + result.added
        };
    } catch (err) {
        console.error('Update Issues Fehler:', err);
        throw err;
    }
}

// ======================= ISSUES SYNC (DIREKT IN TASKS.CSV) =======================

// Lade issues.json (von GitHub Action erstellt)
async function fetchIssuesJson() {
    try {
        const response = await fetch('issues.json');
        if (!response.ok) {
            // Fallback: Von GitHub raw laden
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

// HAUPTFUNKTION: issues.json → tasks.csv
async function syncIssuesToTasks() {
    try {
        // 1. Lade issues.json
        const issuesJson = await fetchIssuesJson();
        if (!issuesJson || issuesJson.length === 0) {
            throw new Error('Keine Issues in issues.json gefunden');
        }
        
        console.log(`📥 ${issuesJson.length} Issues geladen`);
        
        // 2. Lade bestehende Tasks
        const tasks = await loadTasksFromGitLab();
        const taskMap = {};
        tasks.forEach(t => { taskMap[t.issueId] = t; });
        
        let maxTaskId = tasks.reduce((max, t) => Math.max(max, t.id || 0), 0);
        let added = 0;
        let updated = 0;
        let newTasks = [];
        
        // 3. Für jedes Issue: Task erstellen oder aktualisieren
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
            
            // Prüfe ob Task mit dieser issueId existiert
            const existingTask = tasks.find(t => t.issueId === issue.id);
            
            if (existingTask) {
                // Task existiert - prüfe ob sich was geändert hat
                if (existingTask.taskName !== issue.title || 
                    existingTask.description !== fullDescription || 
                    existingTask.definitionOfDone !== definitionOfDone) {
                    
                    existingTask.taskName = issue.title || "---";
                    existingTask.description = fullDescription || "---";
                    existingTask.definitionOfDone = definitionOfDone || "---";
                    updated++;
                }
            } else {
                // Neues Issue → Neue Task
                maxTaskId++;
                const newTask = new Task(
                    maxTaskId,
                    issue.title || "---",
                    fullDescription || "---",
                    definitionOfDone || "---"
                );
                newTask.issueId = issue.id;  // Speichere Issue ID für späteren Abgleich
                tasks.push(newTask);
                added++;
            }
        }
        
        // 4. Tasks speichern
        if (added > 0 || updated > 0) {
            await saveTasksToGitLab(tasks);
            console.log(`✅ ${added} neue Tasks, ${updated} aktualisiert`);
        }
        
        return { added, updated, total: issuesJson.length };
    } catch (err) {
        console.error('Sync Issues Fehler:', err);
        throw err;
    }
}