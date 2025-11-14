// SERVER FILE - Express.js Backend for Homework Tracker
// This file should NOT import discord.js
console.log('Starting Homework Tracker Server...');

const { GoogleGenerativeAI } = require('@google/generative-ai');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { utcToZonedTime } = require('date-fns-tz');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const WINNIPEG_TIMEZONE = 'America/Winnipeg';

// ADD THIS LINE TO FIX THE RATE LIMIT PROXY ISSUE
app.set('trust proxy', 1);

// Discord webhook configuration
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const DISCORD_GUILD_ID = '1426102941970071634';
const DISCORD_CHANNEL_ID = '1427497933942685818';

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory');
}

// Rate limiting configuration - more lenient for better user experience
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per 15 minutes
  message: { error: 'Too many requests. Try again shortly.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health';
  }
});

const strictLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // limit each IP to 20 requests per minute for sensitive endpoints
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// More lenient rate limiter for contact form
const contactLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 requests per minute for contact form
  message: { error: 'Too many contact form submissions. Please wait a minute before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(cors({
  origin: [
    'https://sms-grade-9-homework-cu1a.onrender.com', // ← ADD THIS
    'https://sms-grade-9-homework.onrender.com',
    'http://localhost:3000',
    'http://localhost:3001',
    ...(process.env.NODE_ENV === 'development' ? ['*'] : [])
  ],
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));

// Configure multer for file uploads with better error handling
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Ensure directory exists
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit for documents
  },
  fileFilter: (req, file, cb) => {
    // Allow images and common document types
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|ppt|pptx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images and documents are allowed'));
    }
  }
});

// Separate multer instance for contact form images (PNG only)
const uploadContactImage = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit for PNG images
  },
  fileFilter: (req, file, cb) => {
    // Only allow PNG images for contact form
    const isPng = file.mimetype === 'image/png' || path.extname(file.originalname).toLowerCase() === '.png';
    
    if (isPng) {
      return cb(null, true);
    } else {
      cb(new Error('Only PNG images are allowed for contact form attachments'));
    }
  }
});

// MongoDB connection
let dbConnected = false;
mongoose
  .connect(process.env.MONGO_URI || 'mongodb://localhost:27017/homework-tracker')
  .then(() => {
    dbConnected = true;
    console.log('Connected to MongoDB');
  })
  .catch((err) => {
    dbConnected = false;
    console.error('MongoDB connection error (will continue running without DB):', err && err.message ? err.message : err);
  });

const db = mongoose.connection;
db.on('error', (err) => {
  dbConnected = false;
  console.error('MongoDB connection error:', err && err.message ? err.message : err);
});
db.once('open', () => {
  dbConnected = true;
  console.log('MongoDB connection opened');
});

// Homework Schema
const homeworkSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  dueDate: {
    type: Date,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  creator: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['Not Done', 'Done'],
    default: 'Not Done'
  },
  completedBy: [{
    username: String,
    completedAt: { type: Date, default: Date.now }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Homework = mongoose.model('Homework', homeworkSchema);

// Study Links Schema
const studyLinkSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
    trim: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  addedBy: {
    type: String,
    required: true,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const StudyLink = mongoose.model('StudyLink', studyLinkSchema);

// Contact Form Schema
const contactFormSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['suggestion', 'issue'],
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  attachments: [{
    filename: String,
    url: String,
    mimetype: String
  }],
  submittedBy: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'resolved'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const ContactForm = mongoose.model('ContactForm', contactFormSchema);

// Announcement Schema
const announcementSchema = new mongoose.Schema({
  message: {
    type: String,
    required: true,
    trim: true
  },
  createdBy: {
    type: String,
    required: true,
    trim: true
  },
  viewCount: {
    type: Number,
    default: 0
  },
  maxViews: {
    type: Number,
    default: 5
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Announcement = mongoose.model('Announcement', announcementSchema);

// Discord webhook function
async function sendDiscordWebhook(contactForm) {
  if (!DISCORD_WEBHOOK_URL) {
    console.log('Discord webhook URL not configured, skipping webhook send');
    return;
  }

  try {
    const isSuggestion = contactForm.type === 'suggestion';
    const emoji = isSuggestion ? '💡' : '🐛';
    const color = isSuggestion ? 0x00ff00 : 0xff0000; // Green for suggestions, red for issues
    
    const embed = {
      title: `${emoji} ${contactForm.title}`,
      description: contactForm.description,
      color: color,
      thumbnail: {
        url: 'https://sms-grade-9-homework.onrender.com/sms_logo.svg'
      },
      fields: [
        {
          name: 'Type',
          value: isSuggestion ? 'Homework Suggestion' : 'Issue Report',
          inline: true
        },
        {
          name: 'Submitted By',
          value: contactForm.submittedBy,
          inline: true
        },
        {
          name: 'Timestamp',
          value: new Date(contactForm.createdAt).toLocaleString(),
          inline: true
        }
      ],
      footer: {
        text: 'SMS Grade 9 Homework Tracker',
        icon_url: 'https://sms-grade-9-homework.onrender.com/sms_logo.svg'
      },
      timestamp: new Date().toISOString()
    };

    // Add attachments field if there are any
    if (contactForm.attachments && contactForm.attachments.length > 0) {
      embed.fields.push({
        name: 'Attachments',
        value: contactForm.attachments.map(att => att.filename).join(', '),
        inline: false
      });

      // If there are image attachments, add the first PNG image to the embed
      const imageAttachment = contactForm.attachments.find(att => 
        att.mimetype && (att.mimetype === 'image/png' || att.mimetype.startsWith('image/'))
      );
      
      if (imageAttachment && imageAttachment.url) {
        // Check if URL is valid (not a placeholder) and is PNG
        const isPng = imageAttachment.mimetype === 'image/png' || 
                     imageAttachment.filename.toLowerCase().endsWith('.png');
        
        if (isPng && !imageAttachment.url.startsWith('placeholder-') && imageAttachment.url.startsWith('http')) {
          // Use the image URL directly in the embed
          embed.image = {
            url: imageAttachment.url
          };
          // Also add it as a field for better visibility
          embed.fields.push({
            name: '📎 PNG Image Attachment',
            value: `[View Image](${imageAttachment.url})`,
            inline: false
          });
        } else if (isPng) {
          // If placeholder or invalid URL, just mention the file
          embed.fields.push({
            name: '📎 PNG Image Attachment',
            value: `PNG file: ${imageAttachment.filename}`,
            inline: false
          });
        }
      }
    }

    const webhookData = {
      content: `New ${isSuggestion ? 'suggestion' : 'issue report'} submitted!`,
      embeds: [embed]
    };

    await axios.post(DISCORD_WEBHOOK_URL, webhookData);
    console.log(`Discord webhook sent for ${contactForm.type}: ${contactForm.title}`);
  } catch (error) {
    console.error('Error sending Discord webhook:', error);
  }
}

// Function to clean up completed homework after 2 days
async function cleanupCompletedHomework() {
  try {
    // If DB isn't connected, skip cleanup to avoid unhandled errors
    if (!dbConnected || mongoose.connection.readyState !== 1) {
      // Not connected: skip cleanup run
      // console.log('Skipping cleanup - DB not connected');
      return;
    }
    const nowWinnipeg = utcToZonedTime(new Date(), WINNIPEG_TIMEZONE);
    const twoDaysAgo = new Date(nowWinnipeg);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    
    // Find homework that has been completed by someone and the completion was more than 2 days ago
    const homeworkToDelete = await Homework.find({
      'completedBy.0': { $exists: true }, // Has at least one completion
      'completedBy.completedAt': { $lt: twoDaysAgo }
    });
    
    if (homeworkToDelete.length > 0) {
      console.log(`Cleaning up ${homeworkToDelete.length} completed homework items older than 2 days`);
      
      // Delete homework where all completions are older than 2 days
      for (const homework of homeworkToDelete) {
        const recentCompletions = homework.completedBy.filter(completion => 
          new Date(completion.completedAt) > twoDaysAgo
        );
        
        if (recentCompletions.length === 0) {
          // All completions are older than 2 days, delete the homework
          await Homework.findByIdAndDelete(homework._id);
          console.log(`Deleted homework: ${homework.title}`);
        } else {
          // Some completions are recent, keep the homework but remove old completions
          homework.completedBy = recentCompletions;
          await homework.save();
          console.log(`Updated homework: ${homework.title} - removed old completions`);
        }
      }
    }
  } catch (error) {
    console.error('Error cleaning up completed homework:', error);
  }
}

// Run cleanup every hour
setInterval(cleanupCompletedHomework, 60 * 60 * 1000);

// Run initial cleanup on server start
setTimeout(cleanupCompletedHomework, 5000); // Wait 5 seconds after server start

// Middleware to short-circuit requests if DB isn't connected (except health check)
app.use((req, res, next) => {
  if (req.path === '/health') return next();
  if (!dbConnected || mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Service temporarily unavailable - database not connected' });
  }
  return next();
});

// Routes
app.get('/api/homework', async (req, res) => {
  try {
    if (!dbConnected) {
      // DB is not connected; return empty list to keep frontend usable
      console.warn('GET /api/homework requested but DB not connected — returning empty array');
      return res.json([]);
    }

    const homework = await Homework.find().sort({ dueDate: 1 });
    res.json(homework);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/homework', strictLimiter, async (req, res) => {
  try {
    const { title, subject, dueDate, description, creator } = req.body;
    
    if (!title || !subject || !dueDate || !creator) {
      return res.status(400).json({ error: 'Title, subject, due date, and creator are required' });
    }

    const homework = new Homework({
      title,
      subject,
      dueDate: new Date(dueDate),
      description: description || '',
      creator
    });

    await homework.save();
    res.status(201).json(homework);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/homework/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const homework = await Homework.findByIdAndDelete(id);
    
    if (!homework) {
      return res.status(404).json({ error: 'Homework not found' });
    }
    
    res.json({ message: 'Homework deleted successfully', homework });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/homework/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const homework = await Homework.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );
    
    if (!homework) {
      return res.status(404).json({ error: 'Homework not found' });
    }
    
    res.json(homework);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/homework/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const allowedFields = ['title', 'subject', 'description', 'dueDate'];
    const invalidFields = Object.keys(updateData).filter(field => !allowedFields.includes(field));
    
    if (invalidFields.length > 0) {
      return res.status(400).json({ error: `Invalid fields: ${invalidFields.join(', ')}` });
    }
    
    const homework = await Homework.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!homework) {
      return res.status(404).json({ error: 'Homework not found' });
    }
    
    res.json(homework);
  } catch (error) {
    console.error('Error updating homework:', error);
    res.status(500).json({ error: error.message });
  }
});

// Personal completion route (PATCH - preferred)
app.patch('/api/homework/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    
    const homework = await Homework.findById(id);
    
    if (!homework) {
      return res.status(404).json({ error: 'Homework not found' });
    }
    
    // Check if user already completed this homework
    const alreadyCompleted = homework.completedBy.some(completion => completion.username === username);
    
    if (alreadyCompleted) {
      // Remove completion
      homework.completedBy = homework.completedBy.filter(completion => completion.username !== username);
    } else {
      // Add completion
      homework.completedBy.push({ username, completedAt: new Date() });
    }
    
    await homework.save();
    res.json({ success: true, homework });
  } catch (error) {
    console.error('Error marking homework complete:', error);
    res.status(500).json({ error: 'Server error updating homework' });
  }
});

// Personal completion route (POST - fallback)
app.post('/api/homework/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    
    const homework = await Homework.findById(id);
    
    if (!homework) {
      return res.status(404).json({ error: 'Homework not found' });
    }
    
    // Check if user already completed this homework
    const alreadyCompleted = homework.completedBy.some(completion => completion.username === username);
    
    if (alreadyCompleted) {
      // Remove completion
      homework.completedBy = homework.completedBy.filter(completion => completion.username !== username);
    } else {
      // Add completion
      homework.completedBy.push({ username, completedAt: new Date() });
    }
    
    await homework.save();
    res.json({ success: true, homework });
  } catch (error) {
    console.error('Error marking homework complete:', error);
    res.status(500).json({ error: 'Server error updating homework' });
  }
});

// Study Links API endpoints
app.get('/api/study-links', async (req, res) => {
  try {
    if (!dbConnected) {
      console.warn('GET /api/study-links requested but DB not connected — returning empty array');
      return res.json([]);
    }

    const studyLinks = await StudyLink.find().sort({ createdAt: -1 });
    res.json(studyLinks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/study-links', strictLimiter, async (req, res) => {
  try {
    const { url, title, description, addedBy } = req.body;
    
    if (!url || !title || !addedBy) {
      return res.status(400).json({ error: 'URL, title, and addedBy are required' });
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    const studyLink = new StudyLink({
      url,
      title,
      description: description || '',
      addedBy
    });

    await studyLink.save();
    res.status(201).json(studyLink);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/study-links/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const studyLink = await StudyLink.findByIdAndDelete(id);
    
    if (!studyLink) {
      return res.status(404).json({ error: 'Study link not found' });
    }
    
    res.json({ message: 'Study link deleted successfully', studyLink });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// File upload endpoint (for contact form - PNG only, single file)
app.post('/api/upload', uploadContactImage.single('files'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Verify file is PNG
    const isPng = req.file.mimetype === 'image/png' || path.extname(req.file.originalname).toLowerCase() === '.png';
    
    if (!isPng) {
      // Delete non-PNG file
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ error: 'Only PNG images are allowed' });
    }

    const uploadedFile = {
      filename: req.file.originalname,
      url: `${req.protocol}://${req.get('host')}/${req.file.filename}`,
      mimetype: 'image/png', // Force PNG mimetype
      size: req.file.size
    };

    res.json({ success: true, files: [uploadedFile] });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: error.message || 'Failed to upload file' });
  }
});

// File text extraction endpoint
app.post('/api/extract-text', upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const extractedTexts = [];
    const errors = [];

    for (const file of req.files) {
      try {
        const filePath = file.path;
        const fileExt = path.extname(file.originalname).toLowerCase();
        let text = '';

        if (fileExt === '.pdf') {
          const dataBuffer = fs.readFileSync(filePath);
          const pdfData = await pdfParse(dataBuffer);
          text = pdfData.text;
        } else if (fileExt === '.docx') {
          const result = await mammoth.extractRawText({ path: filePath });
          text = result.value;
        } else if (fileExt === '.txt') {
          text = fs.readFileSync(filePath, 'utf-8');
        } else if (fileExt === '.doc') {
          text = '[.doc files are not supported. Please convert to .docx or .pdf]';
          errors.push(`${file.originalname}: .doc format not supported. Please convert to .docx or .pdf`);
        } else if (fileExt === '.ppt' || fileExt === '.pptx') {
          text = '[PowerPoint files are not supported. Please convert to .pdf or copy text to .txt]';
          errors.push(`${file.originalname}: PowerPoint format not supported. Please convert to .pdf or copy text to .txt`);
        } else {
          text = '[Unsupported file format. Please use .pdf, .docx, or .txt]';
          errors.push(`${file.originalname}: Unsupported format. Please use .pdf, .docx, or .txt`);
        }

        extractedTexts.push({
          filename: file.originalname,
          text: text,
          size: file.size
        });

        // Clean up uploaded file
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (fileError) {
        console.error(`Error processing file ${file.originalname}:`, fileError);
        errors.push(`${file.originalname}: ${fileError.message}`);
        
        // Clean up on error
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      }
    }

    // Combine all extracted text
    const combinedText = extractedTexts.map(item => `=== ${item.filename} ===\n${item.text}`).join('\n\n');

    res.json({
      success: true,
      text: combinedText,
      files: extractedTexts.map(item => ({
        filename: item.filename,
        size: item.size,
        textLength: item.text.length
      })),
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error extracting text from files:', error);
    res.status(500).json({ error: 'Failed to extract text from files' });
  }
});

// Contact Form API endpoints
app.post('/api/contact', contactLimiter, async (req, res) => {
  try {
    const { type, title, description, attachments, submittedBy } = req.body;
    
    if (!type || !title || !description || !submittedBy) {
      return res.status(400).json({ error: 'Type, title, description, and submittedBy are required' });
    }

    if (!['suggestion', 'issue'].includes(type)) {
      return res.status(400).json({ error: 'Type must be either "suggestion" or "issue"' });
    }

    const contactForm = new ContactForm({
      type,
      title,
      description,
      attachments: attachments || [],
      submittedBy
    });

    await contactForm.save();
    
    // Send Discord webhook
    await sendDiscordWebhook(contactForm);
    
    res.status(201).json(contactForm);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/contact', async (req, res) => {
  try {
    if (!dbConnected) {
      console.warn('GET /api/contact requested but DB not connected — returning empty array');
      return res.json([]);
    }

    const contactForms = await ContactForm.find().sort({ createdAt: -1 });
    res.json(contactForms);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bobby AI Chat endpoint - Using Gemini 2.0/2.5 models
app.post('/api/bobby/chat', strictLimiter, upload.single('image'), async (req, res) => {
  let imageFile = req.file;
  
  try {
    const { message } = req.body;

    console.log('Bobby chat request received:', {
      hasMessage: !!message,
      messageLength: message?.length,
      hasImage: !!imageFile,
      imageFile: imageFile ? {
        originalname: imageFile.originalname,
        size: imageFile.size,
        mimetype: imageFile.mimetype
      } : null
    });

    // Allow empty message if image is provided
    if ((!message || typeof message !== 'string' || message.trim().length === 0) && !imageFile) {
      // Clean up if no valid input
      if (imageFile && fs.existsSync(imageFile.path)) {
        fs.unlinkSync(imageFile.path);
      }
      return res.status(400).json({ error: 'Message or image is required' });
    }

    // Check if API keys are configured
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim();
    const TAVILY_API_KEY = process.env.TAVILY_API_KEY?.trim();

    if (!GEMINI_API_KEY || GEMINI_API_KEY === '' || GEMINI_API_KEY === 'your_gemini_api_key_here') {
      console.error('GEMINI_API_KEY is missing or not set properly');
      // Clean up before returning error
      if (imageFile && fs.existsSync(imageFile.path)) {
        fs.unlinkSync(imageFile.path);
      }
      return res.status(500).json({ 
        response: 'Sorry, Bobby is not configured yet. Please contact the administrator.'
      });
    }

    // Handle image if uploaded
    let imageBase64 = null;
    let imageMimeType = 'image/jpeg';
    if (imageFile) {
      try {
        console.log('Processing image file:', imageFile.path);
        
        // Check if file exists and is readable
        if (!fs.existsSync(imageFile.path)) {
          throw new Error('Uploaded file not found at path: ' + imageFile.path);
        }

        const imageBuffer = fs.readFileSync(imageFile.path);
        console.log('Image buffer size:', imageBuffer.length);
        
        if (imageBuffer.length === 0) {
          throw new Error('Image file is empty');
        }

        imageBase64 = imageBuffer.toString('base64');
        imageMimeType = imageFile.mimetype || 'image/jpeg';
        
        console.log('Image processed successfully:', {
          base64Length: imageBase64.length,
          mimeType: imageMimeType
        });
        
      } catch (imageError) {
        console.error('Error processing image:', imageError);
        // Clean up on image processing error
        if (imageFile && fs.existsSync(imageFile.path)) {
          fs.unlinkSync(imageFile.path);
        }
        return res.status(500).json({ 
          response: 'Sorry, I had trouble reading the image. Please try again with a different image format (JPEG, PNG, GIF, WebP).'
        });
      }
    }

    // Web research (Tavily)
    const messageLower = (message || '').toLowerCase();
    const needsResearch = messageLower.includes('search') || 
                         messageLower.includes('research') ||
                         messageLower.includes('find') ||
                         messageLower.includes('look up') ||
                         messageLower.includes('what is') ||
                         messageLower.includes('who is') ||
                         messageLower.includes('when did');

    let researchResults = null;
    
    if (needsResearch && TAVILY_API_KEY) {
      try {
        const searchQuery = (message || '').replace(/search|research|find|look up/gi, '').trim() || (message || '');
        const searchResponse = await axios.post(
          'https://api.tavily.com/search',
          {
            api_key: TAVILY_API_KEY,
            query: searchQuery || message || 'homework help',
            search_depth: 'basic',
            max_results: 5
          },
          {
            headers: {
              'Content-Type': 'application/json'
            },
            timeout: 10000
          }
        );

        if (searchResponse.data && searchResponse.data.results) {
          researchResults = searchResponse.data.results.map((result) => ({
            title: result.title,
            url: result.url,
            content: result.content
          }));
          console.log('Research results found:', researchResults.length);
        }
      } catch (searchError) {
        console.error('Web search error:', searchError);
      }
    }

    // Construct the prompt for Bobby
    let systemPrompt = `You are Bobby, a friendly and helpful AI homework assistant cat for Grade 9 students. 🐱
You help students with their homework, explain concepts clearly, answer questions, and provide educational support.
Be encouraging, clear, and age-appropriate in your responses.

Important guidelines:
- Be warm, friendly, and supportive like a helpful tutor
- Break down complex problems into manageable steps
- Provide explanations, not just answers
- If analyzing an image, carefully examine it and provide detailed help
- Use simple language appropriate for Grade 9 students
- Be encouraging and patient
- Sign off as Bobby the homework helper cat`;

    let userPrompt = message || '';

    if (researchResults && researchResults.length > 0) {
      systemPrompt += `\n\nYou have access to recent web search results. Use them to provide accurate and up-to-date information.`;
      userPrompt = `Based on the following web search results, answer the user's question:\n\n`;
      
      researchResults.forEach((result, index) => {
        userPrompt += `Result ${index + 1}:\nTitle: ${result.title}\nURL: ${result.url}\nContent: ${result.content}\n\n`;
      });
      
      userPrompt += `User's original question: ${message || 'Please help with this homework'}\n\nPlease provide a comprehensive answer based on the search results and your knowledge.`;
    }

    // Use the correct Gemini 2.0/2.5 models
    const modelNames = [
      'gemini-2.0-flash',           // Fast and versatile
      'gemini-2.0-flash-001',       // Stable version
      'gemini-2.5-flash',           // Latest with thinking capability
      'gemini-2.0-flash-lite',      // Lite version
      'gemini-2.5-flash-lite'       // Latest lite version
    ];

    let lastError = null;

    for (const modelName of modelNames) {
      try {
        console.log(`Trying Gemini model: ${modelName} with ${imageBase64 ? 'image' : 'text'}`);
        
        const apiUrl = `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`;
        
        const requestBody = {
          contents: [{
            parts: []
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH", 
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            }
          ]
        };

        // Build the content parts
        const fullPrompt = `${systemPrompt}\n\nUser's question: ${userPrompt || (imageBase64 ? "Please analyze this homework image and help me with it." : "")}`;
        
        requestBody.contents[0].parts.push({
          text: fullPrompt
        });

        // Add image if available
        if (imageBase64) {
          requestBody.contents[0].parts.push({
            inlineData: {
              mimeType: imageMimeType,
              data: imageBase64
            }
          });
        }

        console.log('Sending request to Gemini API...');
        const response = await axios.post(
          apiUrl,
          requestBody,
          {
            headers: {
              'Content-Type': 'application/json'
            },
            timeout: 45000 // Longer timeout for image processing
          }
        );

        console.log(`Success with model: ${modelName}`);

        if (!response.data.candidates || !response.data.candidates[0] || !response.data.candidates[0].content) {
          throw new Error('Invalid response format from Gemini API');
        }

        let aiResponse = response.data.candidates[0].content.parts[0].text;

        // Add research citations if available
        if (researchResults && researchResults.length > 0) {
          aiResponse += '\n\n📚 Sources:\n';
          researchResults.slice(0, 3).forEach((result, index) => {
            aiResponse += `${index + 1}. [${result.title}](${result.url})\n`;
          });
        }

        console.log('Successfully generated response from Gemini');
        
        // Final cleanup - remove uploaded file after successful processing
        if (imageFile && fs.existsSync(imageFile.path)) {
          fs.unlinkSync(imageFile.path);
          console.log('Temp file cleaned up after successful response');
        }
        
        return res.json({ 
          response: aiResponse,
          researchUsed: !!researchResults,
          modelUsed: modelName
        });

      } catch (error) {
        console.log(`Model ${modelName} failed:`, error.response?.data?.error?.message || error.message);
        lastError = error;
        // Continue to next model
      }
    }

    // If all models failed
    console.error('All Gemini models failed. Last error details:', {
      status: lastError?.response?.status,
      statusText: lastError?.response?.statusText,
      error: lastError?.response?.data?.error || lastError?.message
    });
    
    // Clean up on failure
    if (imageFile && fs.existsSync(imageFile.path)) {
      fs.unlinkSync(imageFile.path);
    }
    
    return res.status(500).json({ 
      response: 'Sorry, Bobby is currently unavailable. Please try again in a few moments.'
    });

  } catch (error) {
    console.error('Chat endpoint general error:', error);
    console.error('Error stack:', error.stack);
    
    // Clean up uploaded file if there was an error
    if (imageFile && fs.existsSync(imageFile.path)) {
      try {
        fs.unlinkSync(imageFile.path);
        console.log('Cleaned up temp file after error');
      } catch (err) {
        console.error('Error cleaning up temp file:', err);
      }
    }
    
    let errorMessage = 'Sorry, I encountered an unexpected error. Please try again.';
    
    if (error.message?.includes('File too large')) {
      errorMessage = 'The image file is too large. Please use an image smaller than 10MB.';
    } else if (error.message?.includes('image') || error.message?.includes('file')) {
      errorMessage = 'There was a problem with the image upload. Please try again with a different image.';
    }
    
    res.status(500).json({ 
      response: errorMessage
    });
  }
});

// Test endpoint for image uploads
app.post('/api/test-upload', upload.single('image'), (req, res) => {
  try {
    console.log('Test upload received:', {
      file: req.file ? {
        originalname: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        path: req.file.path
      } : 'No file',
      body: req.body
    });

    if (req.file) {
      // Clean up
      fs.unlinkSync(req.file.path);
    }

    res.json({ 
      success: true, 
      message: 'Upload test successful',
      fileInfo: req.file 
    });
  } catch (error) {
    console.error('Test upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Announcement API endpoints
app.get('/api/announcement', async (req, res) => {
  try {
    if (!dbConnected) {
      return res.json(null);
    }

    // Get active announcement that hasn't reached max views
    const announcement = await Announcement.findOne({
      isActive: true,
      $expr: { $lt: ['$viewCount', '$maxViews'] }
    }).sort({ createdAt: -1 });

    if (announcement) {
      // Increment view count
      announcement.viewCount += 1;
      await announcement.save();

      // Check if it should be deactivated
      if (announcement.viewCount >= announcement.maxViews) {
        announcement.isActive = false;
        await announcement.save();
      }
    }

    res.json(announcement);
  } catch (error) {
    console.error('Error fetching announcement:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/announcement', strictLimiter, async (req, res) => {
  try {
    const { message, createdBy } = req.body;

    if (!message || !createdBy) {
      return res.status(400).json({ error: 'Message and createdBy are required' });
    }

    // Deactivate all existing announcements
    await Announcement.updateMany({ isActive: true }, { isActive: false });

    const announcement = new Announcement({
      message,
      createdBy,
      maxViews: 5,
      viewCount: 0,
      isActive: true
    });

    await announcement.save();
    res.status(201).json(announcement);
  } catch (error) {
    console.error('Error creating announcement:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/announcement/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const announcement = await Announcement.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!announcement) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    res.json({ message: 'Announcement removed successfully', announcement });
  } catch (error) {
    console.error('Error removing announcement:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/announcement', async (req, res) => {
  try {
    // Deactivate all active announcements
    const result = await Announcement.updateMany(
      { isActive: true },
      { isActive: false }
    );

    res.json({ message: 'All announcements removed successfully', count: result.modifiedCount });
  } catch (error) {
    console.error('Error removing announcements:', error);
    res.status(500).json({ error: error.message });
  }
});

// Bobby AI Health Check endpoint
app.get('/api/bobby/health', async (req, res) => {
  try {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim();
    
    const status = {
      gemini: {
        configured: !!GEMINI_API_KEY && GEMINI_API_KEY !== '' && GEMINI_API_KEY !== 'your_gemini_api_key_here',
        keyLength: GEMINI_API_KEY ? GEMINI_API_KEY.length : 0
      },
      server: {
        status: 'running',
        timestamp: new Date().toISOString()
      }
    };
    
    // Test API key with a simple call
    if (status.gemini.configured) {
      try {
        const testResponse = await axios.get(
          `https://generativelanguage.googleapis.com/v1/models?key=${GEMINI_API_KEY}`,
          { timeout: 10000 }
        );
        status.gemini.working = true;
        status.gemini.availableModels = testResponse.data.models?.map(m => m.name) || [];
      } catch (testError) {
        status.gemini.working = false;
        status.gemini.error = testError.response?.data?.error?.message || testError.message;
      }
    }
    
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint (enhanced)
app.get('/health', async (req, res) => {
  const startedAt = Date.now();
  try {
    const dbState = mongoose.connection.readyState; // 1 connected, 2 connecting, 0 disconnected, 3 disconnecting
    const isDbUp = dbState === 1;

    // Basic metrics
    const [totalHomework, upcomingCount, overdueCount] = await Promise.all([
      Homework.countDocuments({}),
      Homework.countDocuments({ dueDate: { $gte: new Date() } }),
      Homework.countDocuments({ dueDate: { $lt: new Date() } })
    ]);

    const latencyMs = Date.now() - startedAt;

    res.json({
      status: 'OK',
      api: { up: true, latencyMs },
      db: { up: isDbUp, state: dbState },
      metrics: {
        totalHomework,
        upcomingCount,
        overdueCount
      },
      serverTimeUtc: new Date().toISOString(),
      timezone: WINNIPEG_TIMEZONE
    });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Keep-alive ping to prevent Render from sleeping
setInterval(() => {
  console.log('Keep-alive ping - server is running');
}, 5 * 60 * 1000); // Every 5 minutes
