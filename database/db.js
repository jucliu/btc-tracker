const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor() {
        this.db = new sqlite3.Database(path.join(__dirname, 'btc_tracker.db'), (err) => {
            if (err) {
                console.error('Error opening database:', err.message);
            } else {
                console.log('Connected to SQLite database.');
                this.initTables();
            }
        });
    }

    initTables() {
        const createAddressTable = `
            CREATE TABLE IF NOT EXISTS addresses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                address TEXT NOT NULL,
                label TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, address)
            )
        `;

        this.db.serialize(() => {
            this.db.run(createAddressTable);
        });
    }

    // Address operations
    addAddress(userId, address, label = null) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare('INSERT INTO addresses (user_id, address, label) VALUES (?, ?, ?)');
            stmt.run([userId, address, label], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, user_id: userId, address, label });
                }
            });
            stmt.finalize();
        });
    }

    removeAddress(userId, address) {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM addresses WHERE user_id = ? AND address = ?', [userId, address], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ deleted: this.changes > 0 });
                }
            });
        });
    }

    getAllAddresses(userId = null) {
        return new Promise((resolve, reject) => {
            let query = 'SELECT * FROM addresses ORDER BY created_at DESC';
            let params = [];
            
            if (userId) {
                query = 'SELECT * FROM addresses WHERE user_id = ? ORDER BY created_at DESC';
                params = [userId];
            }
            
            this.db.all(query, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    getAddressByUserAndAddress(userId, address) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM addresses WHERE user_id = ? AND address = ?', [userId, address], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    getAddressById(addressId) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM addresses WHERE id = ?', [addressId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    getUserAddresses(userId) {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM addresses WHERE user_id = ? ORDER BY created_at DESC', [userId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    close() {
        this.db.close((err) => {
            if (err) {
                console.error('Error closing database:', err.message);
            } else {
                console.log('Database connection closed.');
            }
        });
    }
}

module.exports = new Database();
