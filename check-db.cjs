const db = require('better-sqlite3')('src/data/nntp.db');
console.log(db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table'").all());
