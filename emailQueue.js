const Bull = require('bull');
const nodemailer = require('nodemailer');
require('dotenv').config();

// Create a Bull queue for reminders
const reminderQueue = new Bull('reminderQueue', {
    redis: {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: process.env.REDIS_PORT || 6379,
    }
});

// Email Transporter
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// Helper: Get Template
const getTemplate = (type, name) => {
    let subject = "";
    let message = "";

    switch (type) {
        case '3-days':
            subject = "⏳ Only 3 days left! Sharyx Webinar";
            message = `<p>Hi <strong>${name}</strong>, just a quick reminder that our webinar is in 3 days!</p><p>Mark your calendar for May 30th, 11:00 AM IST.</p>`;
            break;
        case '1-day':
            subject = "🚨 Tomorrow! Sharyx Webinar is happening";
            message = `<p>Hi <strong>${name}</strong>, we're just 24 hours away from the Sharyx Elite Webinar.</p><p>See you tomorrow at 11:00 AM IST!</p>`;
            break;
        case '2-hours':
            subject = "🔥 Starting in 2 hours! Sharyx Webinar";
            message = `<p>Hi <strong>${name}</strong>, get ready! We go live in just 2 hours.</p><p>Joining link will be sent 15 minutes before the start.</p>`;
            break;
    }

    return {
        from: `"Sharyx Webinar" <${process.env.EMAIL_USER}>`,
        subject,
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 30px; color: #334155;">
                <h2 style="color: #8D5EFF; margin-bottom: 20px;">Webinar Reminder</h2>
                <p>Hi <strong>${name}</strong>,</p>
                ${message}
                
                <p>In this session, we will cover:</p>
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
                
                <p style="margin-top: 30px;">Best Regards,<br><strong>Sharyx VoiceAI</strong></p>
                
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
                <p style="font-size: 11px; color: #94a3b8; text-align: center;">© 2026 Sharyx · Webinar Series</p>
            </div>
        `
    };
};

// Process the queue
reminderQueue.process(async (job) => {
    const { email, name, type } = job.data;
    console.log(`[QUEUE] Processing ${type} reminder for ${email}...`);

    const mailOptions = getTemplate(type, name);
    mailOptions.to = email;

    try {
        await transporter.sendMail(mailOptions);
        console.log(`[QUEUE] Sent ${type} reminder successfully to ${email}`);
    } catch (error) {
        console.error(`[QUEUE] Failed to send ${type} reminder to ${email}:`, error);
        throw error;
    }
});

console.log('Reminder queue processor initialized');

module.exports = reminderQueue;
