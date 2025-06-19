require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');

// Twilio configuration
const accountSid = 'AC76d4ef0a04362470b806dbf6015d32b0';
const authToken = '6a7400a2f12961d57add843b99931311';  // You should reset this!
const serviceId = 'VAa0da29407c3989fc404ea0ff418f0121';
const client = require('twilio')(accountSid, authToken);

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Send OTP endpoint
app.post('/send-otp', async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        
        // Ensure phone number is in E.164 format
        const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
        
        const verification = await client.verify.v2
            .services(serviceId)
            .verifications
            .create({ to: formattedPhone, channel: 'sms' });
        
        console.log('Verification status:', verification.status);  // Debug log
        res.json({ success: true, status: verification.status });
        
    } catch (error) {
        console.error('Twilio Error:', error);  // Debug log
        res.status(400).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Verify OTP endpoint
app.post('/verify-otp', async (req, res) => {
    try {
        const { phoneNumber, code } = req.body;
        
        // Ensure phone number is in E.164 format
        const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
        
        const verification_check = await client.verify.v2
            .services(serviceId)
            .verificationChecks
            .create({ to: formattedPhone, code: code });
        
        res.json({ 
            success: true, 
            status: verification_check.status 
        });
        
    } catch (error) {
        console.error('Verification Error:', error);  // Debug log
        res.status(400).json({ 
            success: false, 
            error: error.message 
        });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
}); 