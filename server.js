const express = require('express');
const cors = require('cors');
// Use native fetch (Node.js 18+) instead of node-fetch to avoid punycode deprecation warning

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Proxy endpoint for Anthropic API
app.post('/api/anthropic/messages', async (req, res) => {
    try {
        const { apiKey, ...requestBody } = req.body;

        if (!apiKey) {
            return res.status(400).json({ error: 'API key is required' });
        }

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Anthropic API error:', response.status, JSON.stringify(data, null, 2));
            return res.status(response.status).json(data);
        }

        res.json(data);
    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).json({ error: 'Proxy server error', message: error.message });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.listen(PORT, () => {
    console.log(`Proxy server running on http://localhost:${PORT}`);
    console.log(`Make sure your frontend calls http://localhost:${PORT}/api/anthropic/messages`);
});

