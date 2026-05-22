require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8']);
const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');

const nodemailer = require('nodemailer');
const reminderQueue = require('./emailQueue');

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

// Helper: Schedule Reminders using Redis/Bull
const scheduleReminders = async (email, name) => {
    // Target Webinar Time: May 30th, 2026, 11:00 AM IST
    // IST is UTC+5:30. ISO format: 2026-05-30T11:00:00+05:30
    const now = Date.now();
    const reminders = [
        { type: '3-days', time: new Date('2026-05-27T11:00:00+05:30').getTime() },
        { type: '1-day', time: new Date('2026-05-29T11:00:00+05:30').getTime() },
        { type: '2-hours', time: new Date('2026-05-30T09:00:00+05:30').getTime() }
    ];

    for (const reminder of reminders) {
        const delay = reminder.time - now;
        if (delay > 0) {
            await reminderQueue.add(
                { email, name, type: reminder.type },
                {
                    delay,
                    jobId: `${email}-${reminder.type}`, // Unique ID to prevent double scheduling
                    removeOnComplete: true
                }
            );
            console.log(`[SCHEDULED] ${reminder.type} reminder for ${email} (Delay: ${Math.round(delay / 3600000)} hours)`);
        } else {
            console.log(`[SKIPPED] ${reminder.type} reminder for ${email} (Time already passed)`);
        }
    }
};

// Email Transporter Configuration
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// Helper: Send Confirmation Email
const sendConfirmationEmail = async (email, name, webinarDate, webinarSlot) => {
    if (!process.env.EMAIL_USER || process.env.EMAIL_USER === 'your_email@gmail.com') {
        console.warn('Email registration skipped: SMTP not configured in .env');
        return;
    }

    const mailOptions = {
        from: `"Sharyx Webinar" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "🎉 Your Webinar Registration is Confirmed!",
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 30px; color: #334155;">
                <h2 style="color: #8D5EFF; margin-bottom: 20px;">Registration Confirmed!</h2>
                <p>Hi <strong>${name}</strong>,</p>
                <p>Thank you for registering for our upcoming webinar:</p>
                <p style="font-size: 1.1rem; font-weight: 700; color: #1e293b; margin: 15px 0;"><i>How AI Voice Agents Help Businesses Generate Leads & Increase Sales</i></p>
                
                <p>We’re excited to have you join us. In this session, you’ll learn:</p>
                <ul style="line-height: 1.8;">
                    <li>How AI Voice Agents generate quality leads</li>
                    <li>Reduce cold calling and manual follow-ups</li>
                    <li>Increase revenue without hiring more staff</li>
                    <li>Automate customer conversations and sales calls</li>
                </ul>
                
                <div style="background: #f8fafc; padding: 20px; border-radius: 12px; margin: 25px 0; border: 1px solid #e2e8f0;">
                    <p style="margin: 5px 0;">📅 <strong>Date:</strong> May 30th, 2026</p>
                    <p style="margin: 5px 0;">⏰ <strong>Time:</strong> 11:00 AM IST</p>
                    <p style="margin: 15px 0 5px;">📍 <strong>Join Google Meet:</strong> <a href="${process.env.GOOGLE_MEET_LINK || '#'}" style="color: #8D5EFF; text-decoration: none; font-weight: 600;">Click here to join</a></p>
                </div>
                
                <p style="font-style: italic; font-size: 0.9rem; color: #64748b;">Please join a few minutes early to avoid any last-minute issues.</p>
                
                <p style="margin-top: 30px;">Looking forward to seeing you at the webinar.</p>
                
                <p style="margin-bottom: 0;">Best Regards,<br><strong>Sharyx VoiceAI</strong></p>
                
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
                <p style="font-size: 11px; color: #94a3b8; text-align: center;">© 2026 Sharyx · Elite Webinar Series</p>
            </div>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Confirmation email sent successfully to: ${email}`);
    } catch (error) {
        console.error('Error sending confirmation email:', error);
    }
};

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

// Serve the admin page
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// API to fetch all registrations (for admin dashboard)
app.get('/api/registrations', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM registrations ORDER BY registered_at DESC');
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Error fetching registrations:', err);
        res.status(500).json({ success: false, message: 'Server error fetching data.' });
    }
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

        // Send instant confirmation email (non-blocking)
        sendConfirmationEmail(emailId, fullName, webinarDate, webinarSlotFormatted);

        // Schedule future reminders via Redis/Bull
        scheduleReminders(emailId, fullName);

        const countResult = await pool.query('SELECT COUNT(*) FROM registrations');
        const count = parseInt(countResult.rows[0].count);

        res.json({
            success: true,
            message: 'Registration saved successfully! Automated reminders have been scheduled.',
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
