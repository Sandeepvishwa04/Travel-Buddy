import express from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import dotenv from 'dotenv';
import pg from 'pg';
import bcrypt from 'bcrypt';
import multer from 'multer';
import fs from 'fs';
import cors from 'cors';
import admin from 'firebase-admin';
import twilio from 'twilio';
import session from 'express-session';

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    secret: 'your-secret-key-here',
    resave: true,
    saveUninitialized: true,
    cookie: {
        secure: false,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// Set up PostgreSQL connection
const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "Travel Buddy",
  password: "sqlvaradha",
  port: 5432,
});

db.connect()
  .then(() => console.log('Database connected successfully'))
  .catch(err => console.error('Database connection error:', err));

// Ensure 'uploads' directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Set up file storage for uploads
const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Serve static files for uploads and public directory
app.use('/uploads', express.static(uploadsDir));
app.use(express.static(path.join(process.cwd(), 'public')));

// Serve guide and traveler HTML files
app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'guide.html'));
});
app.get('/traveler', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'traveler.html'));
});

// Guide Registration
app.post('/submit_guide_registration', upload.single('guide_id_card'), async (req, res) => {
  const { guide_name, guide_phone, guide_id, guide_password, gender } = req.body;
  const guideIdCardPath = req.file ? `uploads/${req.file.filename}` : null;

  try {
    // Log the received password (for debugging)
    console.log('Received password:', guide_password);

    if (!guide_password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required'
      });
    }

    // Hash the password with bcrypt
    const hashedPassword = await bcrypt.hash(guide_password, 10);
    
    // Log the hashed password (for debugging)
    console.log('Hashed password:', hashedPassword);

    const query = `
      INSERT INTO guide (name, ph_no, guide_id, password, gender, guide_id_card)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;
    
    await db.query(query, [guide_name, guide_phone, guide_id, hashedPassword, gender, guideIdCardPath]);

    res.json({ 
      success: true, 
      message: 'Registration successful! Please login with your credentials.'
    });
  } catch (error) {
    console.error('Error saving guide data:', error);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again later.'
    });
  }
});

// Buddy Details Submission
app.post('/submit_buddy_details', upload.single('profile_picture'), async (req, res) => {
    try {
        const { 
            guide_name, 
            guide_phone, 
            country, 
            state, 
            district, 
            place, 
            price_per_hour, 
            gender,
            available_from,
            available_to,
            languages
        } = req.body;

        const profilePicturePath = req.file ? `uploads/${req.file.filename}` : null;

        // Validate dates
        const fromDate = new Date(available_from);
        const toDate = new Date(available_to);
        
        if (fromDate > toDate) {
            return res.status(400).json({
                success: false,
                message: 'Available From date must be before Available To date'
            });
        }

        // Parse languages from JSON string
        let languagesArray = [];
        try {
            languagesArray = JSON.parse(languages);
        } catch (e) {
            console.error('Error parsing languages:', e);
            languagesArray = Array.isArray(languages) ? languages : [languages];
        }

        const query = `
            INSERT INTO buddy_posts (
                buddy_name, 
                mobile_no, 
                country, 
                state, 
                district, 
                place, 
                price_per_hour, 
                profile_picture, 
                gender,
                available_from,
                available_to,
                languages
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *`;

        const values = [
            guide_name,
            guide_phone,
            country,
            state,
            district,
            place,
            price_per_hour,
            profilePicturePath,
            gender,
            available_from,
            available_to,
            languagesArray
        ];

        const result = await db.query(query, values);
        
        if (req.session) {
            req.session.buddyId = result.rows[0].post_id;
            res.redirect('/buddy_profile');
        } else {
            res.status(500).send('Session not initialized');
        }
    } catch (error) {
        console.error('Error saving buddy details:', error);
        res.status(500).json({
            success: false,
            message: 'Server error. Please try again later.'
        });
    }
});

// Traveler Registration
app.post('/submit_traveler_registration', async (req, res) => {
  const { traveller_name, traveller_email, traveller_password, traveller_phone, gender } = req.body;

  try {
    if (!traveller_password) return res.status(400).send('Password is required');
    const hashedPassword = await bcrypt.hash(traveller_password, 10);

    const query = `
      INSERT INTO traveler (name, email, password, ph_no, gender)
      VALUES ($1, $2, $3, $4, $5)
    `;
    await db.query(query, [traveller_name, traveller_email, hashedPassword, traveller_phone, gender]);

    res.send('Traveler registered successfully!');
  } catch (error) {
    console.error('Error saving traveler data:', error);
    res.status(500).send('Server error. Please try again later.');
  }
});

// Traveler Login
app.post('/submit_traveler_login', async (req, res) => {
    const { traveller_email, traveller_password } = req.body;

    try {
        const query = 'SELECT * FROM traveler WHERE email = $1';
        const result = await db.query(query, [traveller_email]);

        if (result.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No traveler found with that email'
            });
        }

        const traveller = result.rows[0];
        const isMatch = await bcrypt.compare(traveller_password, traveller.password);
        
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: 'Invalid password'
            });
        }

        res.json({
            success: true,
            travelerData: {
                name: traveller.name,
                phone: traveller.ph_no
            }
        });

    } catch (error) {
        console.error('Error during traveler login:', error);
        res.status(500).json({
            success: false,
            message: 'Server error. Please try again.'
        });
    }
});

// Fetch buddy posts
app.get('/api/buddy_posts', async (req, res) => {
    try {
        const query = `
            SELECT 
                post_id,
                buddy_name,
                mobile_no,
                country,
                state,
                district,
                place,
                price_per_hour,
                profile_picture,
                gender,
                available_from,
                available_to,
                languages
            FROM buddy_posts
            ORDER BY post_id DESC
        `;
        
        const result = await db.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching buddy posts:', error);
        res.status(500).json({ error: 'Failed to fetch buddy posts' });
    }
});

// Serve guide profiles HTML on successful login
app.get('/guide_profiles', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'guide_profiles.html'));
});



app.get('/buddy_profile', async (req, res) => {
    if (!req.session.guideId) {
        // If not logged in, redirect to guide.html
        return res.redirect('/guide.html');
    }

    try {
        const query = `
            SELECT * FROM buddy_posts 
            WHERE buddy_name = $1
            ORDER BY post_id DESC 
            LIMIT 1`;
        
        const result = await db.query(query, [req.session.guideName]);
        
        if (result.rows.length === 0) {
            return res.redirect('/buddy_post.html');
        }

        res.sendFile(path.join(process.cwd(), 'public', 'buddy_profile.html'));
    } catch (error) {
        console.error('Error fetching buddy profile:', error);
        res.status(500).send('Error loading profile');
    }
});

// Add a new route to fetch buddy profile data
app.get('/api/buddy_profile', async (req, res) => {
    try {
        const query = `
            SELECT 
                post_id,
                buddy_name,
                mobile_no,
                country,
                state,
                district,
                place,
                profile_picture,
                price_per_hour,
                gender,
                available_from,
                available_to,
                languages
            FROM buddy_posts 
            WHERE buddy_name = $1
            ORDER BY post_id DESC 
            LIMIT 1`;
        
        const result = await db.query(query, [req.session.guideName]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching buddy profile:', error);
        res.status(500).json({ error: 'Error loading profile' });
    }
});

// Add this route to handle edit profile page
app.get('/edit_buddy_profile', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public', 'edit_buddy_profile.html'));
});

// Add API route to fetch current buddy details
app.get('/api/current_buddy_profile', async (req, res) => {
    try {
        const query = `
            SELECT * FROM buddy_posts 
            WHERE post_id = $1`;
            
        const result = await db.query(query, [req.session.buddyId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching buddy profile:', error);
        res.status(500).json({ error: 'Error loading profile' });
    }
});

// Add route to handle profile updates
app.post('/api/update_buddy_profile', upload.single('profile_picture'), async (req, res) => {
    try {
        const { guide_name, guide_phone, country, state, district, price_per_hour, gender, place } = req.body;
        const profilePicturePath = req.file ? `uploads/${req.file.filename}` : null;

        const query = `
            UPDATE buddy_posts 
            SET buddy_name = $1,
                mobile_no = $2,
                country = $3,
                state = $4,
                district = $5,
                price_per_hour = $6,
                gender = $7,
                place = $8
                ${profilePicturePath ? ', profile_picture = $9' : ''}
            WHERE post_id = $${profilePicturePath ? '10' : '9'}
            RETURNING *`;

        const values = [
            guide_name,
            guide_phone,
            country,
            state,
            district,
            price_per_hour,
            gender,
            place,
            req.session.buddyId
        ];

        if (profilePicturePath) {
            values.splice(8, 0, profilePicturePath);
        }

        const result = await db.query(query, values);
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Your Twilio credentials
const accountSid = 'ACdd9960897a426c2345159a5cffe463b1';
const authToken = '9b5ab9ac4a87ebcabf3ee0777d8f963a';
const verifySid = 'VA37ede4b1f53b949267f82d21cbdd16b9';
const client = twilio(accountSid, authToken);

// Make sure this route is properly defined
app.post('/api/generate-otp', async (req, res) => {
    try {
        let { phoneNumber } = req.body;
        
        // Format phone number
        phoneNumber = phoneNumber.replace(/\D/g, '');
        if (!phoneNumber.startsWith('+91')) {
            phoneNumber = '+91' + phoneNumber;
        }

        console.log('Attempting to send OTP to:', phoneNumber); // Debug log

        const verification = await client.verify.v2
            .services(verifySid)
            .verifications
            .create({
                to: phoneNumber,
                channel: 'sms'
            });

        console.log('Verification status:', verification.status); // Debug log

        res.json({
            success: true,
            message: 'OTP sent successfully',
            status: verification.status
        });
    } catch (error) {
        console.error('Error sending OTP:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to send OTP'
        });
    }
});

// Add this route for verification
app.post('/api/verify-otp', async (req, res) => {
    try {
        let { phoneNumber, code } = req.body;
        
        // Format phone number
        phoneNumber = phoneNumber.replace(/\D/g, '');
        if (!phoneNumber.startsWith('+91')) {
            phoneNumber = '+91' + phoneNumber;
        }

        console.log('Verifying OTP:', { phoneNumber, code }); // Debug log

        const verificationCheck = await client.verify.v2
            .services(verifySid)
            .verificationChecks
            .create({
                to: phoneNumber,
                code: code
            });

        console.log('Verification result:', verificationCheck); // Debug log

        res.json({
            success: true,
            valid: verificationCheck.status === 'approved',
            status: verificationCheck.status
        });
    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to verify OTP'
        });
    }
});

// Start server
const port = 3001;

app.listen(3001, () => {
    console.log('Server running on port 3001');
});

app.post('/guide_login', async (req, res) => {
    const { login_guide_id, login_password } = req.body;

    try {
        // Check if guide exists
        const query = 'SELECT * FROM guide WHERE guide_id = $1';
        const result = await db.query(query, [login_guide_id]);

        if (result.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No guide found with that ID'
            });
        }

        const guide = result.rows[0];
        
        // Compare passwords
        const isMatch = await bcrypt.compare(login_password, guide.password);

        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: 'Invalid password'
            });
        }

        // Store guide info in session
        req.session.guideId = guide.guide_id;
        req.session.guideName = guide.name;

        // Check if guide has already posted details
        const buddyQuery = 'SELECT * FROM buddy_posts WHERE buddy_name = $1';
        const buddyResult = await db.query(buddyQuery, [guide.name]);

        // If guide has a profile, redirect to buddy_profile
        if (buddyResult.rows.length > 0) {
            return res.json({
                success: true,
                redirectUrl: '/buddy_profile'
            });
        }

        // If no profile exists, redirect to buddy_post.html
        return res.json({
            success: true,
            redirectUrl: '/buddy_post.html'
        });

    } catch (error) {
        console.error('Error during guide login:', error);
        res.status(500).json({
            success: false,
            message: 'Server error. Please try again later.'
        });
    }
});

// Update the check-profile route
app.get('/api/check-profile', async (req, res) => {
    try {
        // First check if user is logged in
        if (!req.session.guideId) {
            return res.json({ 
                isLoggedIn: false,
                hasProfile: false 
            });
        }

        // Check if guide has a profile
        const result = await db.query(
            'SELECT * FROM buddy_posts WHERE buddy_name = $1',
            [req.session.guideName]
        );

        res.json({ 
            isLoggedIn: true,
            hasProfile: result.rows.length > 0 
        });
    } catch (error) {
        console.error('Error checking profile:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
            return res.status(500).json({ success: false });
        }
        res.json({ success: true });
    });
});

// Handle new guide request
app.post('/api/guide-requests', async (req, res) => {
    try {
        const { post_id, traveler_name, traveler_phone } = req.body;
        
        if (!traveler_name || !traveler_phone) {
            return res.status(400).json({
                success: false,
                message: 'Missing traveler details'
            });
        }

        const query = `
            INSERT INTO guide_requests 
            (post_id, traveler_name, traveler_phone, status) 
            VALUES ($1, $2, $3, 'pending')
            RETURNING *
        `;

        const result = await db.query(query, [post_id, traveler_name, traveler_phone]);
        
        console.log('Created request:', result.rows[0]); // Debug log

        res.json({
            success: true,
            request: result.rows[0]
        });
    } catch (error) {
        console.error('Error creating request:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create request'
        });
    }
});

// Update the fetch requests endpoint with better error handling
app.get('/api/guide-requests/:post_id', async (req, res) => {
    try {
        const { post_id } = req.params;
        
        // Validate post_id
        if (!post_id) {
            return res.status(400).json({ 
                success: false,
                error: 'Post ID is required' 
            });
        }

        const query = `
            SELECT 
                gr.request_id,
                gr.traveler_name,
                gr.traveler_phone,
                gr.status,
                gr.created_at
            FROM guide_requests gr
            WHERE gr.post_id = $1
            ORDER BY gr.created_at DESC
        `;
        
        const result = await db.query(query, [post_id]);
        
        // Debug logs
        console.log('Post ID:', post_id);
        console.log('Query result:', result.rows);
        
        return res.json({
            success: true,
            requests: result.rows
        });
    } catch (error) {
        console.error('Detailed error in fetching requests:', error);
        return res.status(500).json({ 
            success: false,
            error: 'Error loading requests. Please try again later.',
            details: error.message 
        });
    }
});

// Add a new endpoint to verify if the post exists
app.get('/api/verify-post/:post_id', async (req, res) => {
    try {
        const { post_id } = req.params;
        const query = 'SELECT post_id FROM buddy_posts WHERE post_id = $1';
        const result = await db.query(query, [post_id]);
        
        return res.json({
            success: true,
            exists: result.rows.length > 0
        });
    } catch (error) {
        console.error('Error verifying post:', error);
        return res.status(500).json({ 
            success: false,
            error: 'Error verifying post existence' 
        });
    }
});

// Update request status
app.put('/api/guide-requests/:request_id', async (req, res) => {
    try {
        const { request_id } = req.params;
        const { status } = req.body;
        
        const query = `
            UPDATE guide_requests 
            SET status = $1 
            WHERE request_id = $2 
            RETURNING *
        `;
        
        const result = await db.query(query, [status, request_id]);
        res.json({ success: true, request: result.rows[0] });
    } catch (error) {
        console.error('Error updating request:', error);
        res.status(500).json({ success: false, message: 'Failed to update request' });
    }
});

// Add endpoint to check request status
app.get('/api/guide-requests/:request_id/status', async (req, res) => {
    try {
        const { request_id } = req.params;
        const query = `
            SELECT status 
            FROM guide_requests 
            WHERE request_id = $1
        `;
        const result = await db.query(query, [request_id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Request not found' });
        }
        
        res.json({ status: result.rows[0].status });
    } catch (error) {
        console.error('Error fetching request status:', error);
        res.status(500).json({ error: 'Failed to fetch request status' });
    }
});

// Add this new endpoint to get current traveler details
app.get('/api/current-traveler', async (req, res) => {
    try {
        if (!req.session.travelerId) {
            return res.status(401).json({ error: 'Not logged in' });
        }

        const query = `
            SELECT name, ph_no as phone, email
            FROM traveler
            WHERE traveler_id = $1
        `;
        
        const result = await db.query(query, [req.session.travelerId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Traveler not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching traveler details:', error);
        res.status(500).json({ error: 'Failed to fetch traveler details' });
    }
});

// Add this new endpoint to check session
app.get('/api/check-session', (req, res) => {
    res.json({
        isLoggedIn: !!req.session.travelerId,
        travelerName: req.session.travelerName,
        travelerPhone: req.session.travelerPhone
    });
});
