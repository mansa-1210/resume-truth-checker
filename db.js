const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const databaseFolder = path.join(__dirname, 'database');

// Create database folder if it doesn’t exist
if (!fs.existsSync(databaseFolder)) {
    fs.mkdirSync(databaseFolder, { recursive: true });
    console.log('Database folder created.');
}

const dbPath = path.join(databaseFolder, 'resume_checker.db');

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to database at', dbPath);
        db.run(`CREATE TABLE IF NOT EXISTS resumes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT
        )`);
    }
});

module.exports = db;
