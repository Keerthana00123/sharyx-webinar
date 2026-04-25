require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8']);
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Use MongoDB Atlas URI from environment variable
const MONGODB_URI = process.env.MONGODB_URI;

if (MONGODB_URI) {
    mongoose.connect(MONGODB_URI, {
        family: 4 // Force IPv4 to avoid some common DNS/ECONNREFUSED issues
    })
        .then(() => console.log('Connected to MongoDB Atlas: sharyx_webinar'))
        .catch(err => console.error('MongoDB connection error:', err));
} else {
    console.warn('WARNING: MONGODB_URI not found. Registrations will NOT be saved.');
}

// Define Registration Schema
const registrationSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    mobileNumber: { type: String, required: true },
    emailId: { type: String, required: true },
    webinarSlot: String,
    webinarSlotFormatted: String,
    registeredAt: { type: Date, default: Date.now },
    webinarDate: String
});

const Registration = mongoose.model('Registration', registrationSchema, 'sharyx_webinar');

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

// Serve the landing page as the root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Endpoint to handle form registration using MongoDB
app.post('/api/register', async (req, res) => {
    try {
        if (!MONGODB_URI) {
            return res.status(503).json({ success: false, message: 'Database coupling missing. Please configure MONGODB_URI.' });
        }
        
        const newRecord = new Registration(req.body);
        await newRecord.save();
        
        const count = await Registration.countDocuments();
        res.json({ 
            success: true, 
            message: 'Registration saved successfully to MongoDB Atlas!', 
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
