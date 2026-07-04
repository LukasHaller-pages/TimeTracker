// ======================= DATA MODELS =======================

class User {
    constructor(id, firstname, surname, role) {
        this.id = id;
        this.firstname = firstname;
        this.surname = surname;
        this.role = role;
    }
    
    get fullName() {
        return `${this.firstname} ${this.surname}`;
    }
    
    get displayShort() {
        const firstLetter = this.surname.charAt(0).toUpperCase();
        return `${this.firstname} ${firstLetter}. (${this.role})`;
    }
}

class Task {
    constructor(id, taskName, description, definitionOfDone) {
        this.id = id;
        this.taskName = taskName;  // ← Das ist der Titel!
        this.description = description || "---";
        this.definitionOfDone = definitionOfDone || "---";
        this.issueId = null;
    }
}

class TrackingEntry {
    constructor(userId, action, taskId, taskState, description) {
        this.id = null;
        this.userId = userId;
        this.action = action;
        this.taskId = taskId;
        this.taskState = taskState || "---";
        this.description = description || "---";
        this.timestampBrowser = getBrowserTimestamp();
        this.timestampUTC = getUTCTimestamp();
        this.timestampISO = getISOForStorage();
        this.browserTimezone = getBrowserTimezone();
        this.browserOffset = getBrowserTimezoneOffset();
    }
}