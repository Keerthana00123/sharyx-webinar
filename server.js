require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8']);
const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL connection pool
const pool = new Pool({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: process.env.PGPORT,
});

// Test connection and initialize table
const initDb = async () => {
    try {
        await pool.query('SELECT NOW()');
        console.log('Connected to PostgreSQL database');
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS registrations (
                id SERIAL PRIMARY KEY,
                full_name TEXT NOT NULL,
                mobile_number TEXT NOT NULL,
                email_id TEXT NOT NULL,
                webinar_slot TEXT,
                webinar_slot_formatted TEXT,
                registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                webinar_date TEXT
            )
        `);
        console.log('PostgreSQL table "registrations" is ready');
    } catch (err) {
        console.error('PostgreSQL initialization error:', err);
    }
};

initDb();

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

// Serve the landing page as the root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Endpoint to handle form registration using PostgreSQL
app.post('/api/register', async (req, res) => {
    try {
        const { fullName, mobileNumber, emailId, webinarSlot, webinarSlotFormatted, webinarDate } = req.body;
        
        const insertQuery = `
            INSERT INTO registrations (full_name, mobile_number, email_id, webinar_slot, webinar_slot_formatted, webinar_date)
            VALUES ($1, $2, $3, $4, $5, $6)
        `;
        const values = [fullName, mobileNumber, emailId, webinarSlot, webinarSlotFormatted, webinarDate];
        
        await pool.query(insertQuery, values);
        
        const countResult = await pool.query('SELECT COUNT(*) FROM registrations');
        const count = parseInt(countResult.rows[0].count);
        
        res.json({ 
            success: true, 
            message: 'Registration saved successfully to PostgreSQL!', 
            count 
        });
    } catch (err) {
        console.error('Error saving registration:', err);
        res.status(500).json({ success: false, message: 'Server error saving registration.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
