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
            <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; padding: 40px 30px; color: #1e293b; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);">
                <!-- Header / Logo Area -->
                <div style="text-align: center; margin-bottom: 30px;">
                    <img src="cid:sharyxlogo" alt="Sharyx Logo" style="height: 46px; width: auto; max-width: 100%; display: block; margin: 0 auto;" />
                </div>
                
                <h3 style="color: #0f172a; font-size: 20px; font-weight: 700; margin-top: 0; margin-bottom: 15px; border-bottom: 2px solid #f1f5f9; padding-bottom: 15px;">🎉 Registration Confirmed!</h3>
                
                <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px; color: #334155;">Hi <strong>${name}</strong>,</p>
                
                <p style="font-size: 16px; line-height: 1.6; color: #334155; margin-bottom: 25px;">Just a quick reminder that our exclusive webinar is only <strong>3 days away!</strong></p>
                
                <!-- Webinar Details Card -->
                <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); padding: 24px; border-radius: 12px; margin: 25px 0; border: 1px solid #e2e8f0;">
                    <table border="0" cellpadding="0" cellspacing="0" style="width: 100%;">
                        <tr>
                            <td style="padding-bottom: 10px; font-size: 16px; color: #334155;">
                                <span style="font-size: 20px; margin-right: 8px; vertical-align: middle;">📅</span> 
                                <strong>Date:</strong> May 30, 2026
                            </td>
                        </tr>
                        <tr>
                            <td style="font-size: 16px; color: #334155;">
                                <span style="font-size: 20px; margin-right: 8px; vertical-align: middle;">⏰</span> 
                                <strong>Time:</strong> 11:00 AM IST
                            </td>
                        </tr>
                    </table>
                </div>
                
                <!-- Key Learnings Section -->
                <p style="font-size: 16px; font-weight: 600; color: #0f172a; margin-top: 25px; margin-bottom: 15px;">In this session, you'll learn how to:</p>
                <table border="0" cellpadding="0" cellspacing="0" style="width: 100%; margin-bottom: 25px;">
                    <tr>
                        <td style="width: 30px; vertical-align: top; padding-bottom: 12px; font-size: 18px;">✅</td>
                        <td style="font-size: 15px; line-height: 1.5; color: #334155; padding-bottom: 12px; padding-left: 8px;">
                            Generate quality leads using AI Voice Agents
                        </td>
                    </tr>
                    <tr>
                        <td style="width: 30px; vertical-align: top; padding-bottom: 12px; font-size: 18px;">✅</td>
                        <td style="font-size: 15px; line-height: 1.5; color: #334155; padding-bottom: 12px; padding-left: 8px;">
                            Reduce cold calling and manual follow-ups
                        </td>
                    </tr>
                    <tr>
                        <td style="width: 30px; vertical-align: top; padding-bottom: 12px; font-size: 18px;">✅</td>
                        <td style="font-size: 15px; line-height: 1.5; color: #334155; padding-bottom: 12px; padding-left: 8px;">
                            Increase revenue without hiring additional staff
                        </td>
                    </tr>
                    <tr>
                        <td style="width: 30px; vertical-align: top; padding-bottom: 12px; font-size: 18px;">✅</td>
                        <td style="font-size: 15px; line-height: 1.5; color: #334155; padding-bottom: 12px; padding-left: 8px;">
                            Automate customer conversations and sales calls
                        </td>
                    </tr>
                </table>
                
                <!-- Notice and Sign-off -->
                <p style="font-size: 15px; line-height: 1.6; color: #475569; background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 12px 16px; border-radius: 0 8px 8px 0; margin-bottom: 25px;">
                    ℹ️ The Zoom Meet joining link will be shared shortly before the webinar.
                </p>
                
                <p style="font-size: 16px; line-height: 1.6; color: #334155; margin-bottom: 30px;">We look forward to having you with us!</p>
                
                <p style="font-size: 15px; margin-bottom: 0; color: #64748b; line-height: 1.5;">
                    Best Regards,<br>
                    <strong style="color: #8D5EFF;">Sharyx Team</strong>
                </p>
                
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 35px 0 25px 0;" />
                <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">© 2026 Sharyx · Webinar Series</p>
            </div>
        `,
        attachments: [{
            filename: 'sharyxblack.png',
            path: path.join(__dirname, 'sharyxblack.png'),
            cid: 'sharyxlogo'
        }]
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
                registered_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
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
