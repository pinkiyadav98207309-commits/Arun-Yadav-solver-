const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ CORS Configuration (FIX)
app.use(cors());
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed'), false);
        }
    }
});

// Simple summarization function
function summarizeText(text, summaryLength) {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    
    if (sentences.length === 0) {
        return text;
    }

    const targetSentences = Math.max(1, Math.ceil((sentences.length * summaryLength) / 100));
    
    const scoredSentences = sentences.map((sentence, index) => {
        const words = sentence.trim().split(/\s+/).length;
        const score = words > 5 ? 1 : 0.5;
        return { text: sentence.trim(), score, index };
    });

    const importantSentences = scoredSentences
        .sort((a, b) => b.score - a.score)
        .slice(0, targetSentences)
        .sort((a, b) => a.index - b.index)
        .map(s => s.text)
        .join(' ');

    return importantSentences;
}

// Extract text from PDF
async function extractPDFText(pdfBuffer) {
    try {
        const data = await pdfParse(pdfBuffer);
        return data.text;
    } catch (error) {
        throw new Error('Failed to extract text from PDF: ' + error.message);
    }
}

// ✅ DEBUG: Check if server is running
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ✅ Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running' });
});

// ✅ API route for summarization
app.post('/api/summarize', upload.single('file'), async (req, res) => {
    try {
        console.log('📝 Received request for summarization');
        console.log('File:', req.file ? req.file.originalname : 'No file');

        if (!req.file) {
            console.error('❌ No file uploaded');
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const summaryLength = parseInt(req.body.summaryLength) || 50;

        if (summaryLength < 20 || summaryLength > 100) {
            return res.status(400).json({ error: 'Summary length must be between 20 and 100' });
        }

        // Extract text from PDF
        console.log('🔍 Extracting text from PDF...');
        const pdfText = await extractPDFText(req.file.buffer);

        if (!pdfText.trim()) {
            console.error('❌ Could not extract text from PDF');
            return res.status(400).json({ error: 'Could not extract text from PDF' });
        }

        // Generate summary
        console.log('✍️ Generating summary...');
        const summary = summarizeText(pdfText, summaryLength);

        // Calculate statistics
        const originalWords = pdfText.split(/\s+/).length;
        const summaryWords = summary.split(/\s+/).length;
        const compressionRatio = Math.round((summaryWords / originalWords) * 100);

        console.log('✅ Summarization complete');
        res.json({
            summary,
            originalWords,
            summaryWords,
            compressionRatio
        });
    } catch (error) {
        console.error('❌ Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ✅ Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// Start server
app.listen(PORT, () => {
    console.log(`\n🚀 PDF Summarizer Server Running`);
    console.log(`📍 URL: http://localhost:${PORT}`);
    console.log(`🔗 Health Check: http://localhost:${PORT}/health`);
    console.log(`\nServer is ready! Open http://localhost:${PORT} in your browser\n`);
});