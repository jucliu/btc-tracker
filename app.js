const express = require('express');
const cors = require('cors');
const path = require('path');

// Import routes
const addressRoutes = require('./routes/wallets');
const syncRoutes = require('./routes/sync');

// Import database (this will initialize the connection)
const db = require('./database/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Basic security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

// CORS configuration
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://yourdomain.com'] // Replace with your domain
        : ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'],
    credentials: true
}));


// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - IP: ${req.ip}`);
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'BTC Tracker API is running',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// API routes
app.use('/api/addresses', addressRoutes);
app.use('/api/sync', syncRoutes);

// API documentation endpoint
app.get('/api', (req, res) => {
    res.json({
        success: true,
        message: 'BTC Tracker API',
        version: '1.0.0',
        endpoints: {
            addresses: {
                'GET /api/addresses': 'Get all addresses for a user (requires user-id header)',
                'POST /api/addresses': 'Add a new address (body: {address, label?})',
                'GET /api/addresses/:address': 'Get specific address',
                'DELETE /api/addresses/:address': 'Remove address',
                'GET /api/addresses/:address/transactions': 'Get address transactions (query: limit, offset)',
                'GET /api/addresses/user/transactions': 'Get all transactions for a user'
            },
            sync: {
                'GET /api/sync/address/:address': 'Get live data for specific address (query: limit, offset)',
                'GET /api/sync/user': 'Get live data for all user addresses (query: limit)',
                'GET /api/sync/user/balances': 'Get live balances for user addresses',
                'GET /api/sync/status': 'Get blockchain status and API info'
            },
            utility: {
                'GET /health': 'Health check',
                'GET /api': 'This documentation'
            }
        },
        authentication: {
            note: 'All endpoints require user identification via header "user-id" or query parameter "user_id"'
        },
        blockchain_api: 'https://blockchain.info',
        features: [
            'Multi-user Bitcoin address tracking',
            'Add/Remove Bitcoin addresses per user',
            'Live blockchain data fetching',
            'Real-time balance queries',
            'Live transaction history',
            'Multi-address balance queries',
            'User-based data isolation',
            'No local data storage - always fresh from blockchain',
            'Basic security headers'
        ]
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        message: 'The requested endpoint does not exist. Visit /api for documentation.'
    });
});

// Global error handler
app.use((error, req, res, next) => {
    console.error('Global error handler:', error);
    
    // Handle specific error types
    if (error.type === 'entity.parse.failed') {
        return res.status(400).json({
            success: false,
            error: 'Invalid JSON in request body'
        });
    }
    
    if (error.type === 'entity.too.large') {
        return res.status(413).json({
            success: false,
            error: 'Request body too large'
        });
    }

    // Default error response
    res.status(error.status || 500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' 
            ? 'Internal server error' 
            : error.message,
        ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
    });
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nReceived SIGINT. Graceful shutdown...');
    
    db.close();
    
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('Received SIGTERM. Graceful shutdown...');
    
    db.close();
    
    process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    
    db.close();
    
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    
    db.close();
    
    process.exit(1);
});

// Start server
app.listen(PORT, () => {
    console.log(`
🚀 BTC Tracker API Server Started
📡 Port: ${PORT}
🌍 Environment: ${process.env.NODE_ENV || 'development'}
📖 API Documentation: http://localhost:${PORT}/api
❤️  Health Check: http://localhost:${PORT}/health

Available endpoints:
• GET    /api/addresses                     - Get all addresses for user (live balances)
• POST   /api/addresses                     - Add new address
• DELETE /api/addresses/:address            - Remove address
• GET    /api/addresses/:address            - Get specific address (live data)
• GET    /api/addresses/:address/transactions - Get address transactions (live)
• GET    /api/addresses/user/transactions    - Get all user transactions (live)
• GET    /api/sync/address/:address         - Get live address data
• GET    /api/sync/user                     - Get live data for all user addresses
• GET    /api/sync/user/balances            - Get live balances only
• GET    /api/sync/status                   - Get blockchain status

Note: All endpoints require user-id header or user_id parameter
Note: All data is fetched live from blockchain - no local caching
    `);
});

module.exports = app;
