# BTC Tracker

A Node.js Express application for tracking Bitcoin addresses with multi-user support, synchronizing wallet transactions, and retrieving current balances using the Blockchain.info API.

## Project Scope

This project is designed as a **server-side API** focused on simplicity and real-time data accuracy:

- **Server-side only**: RESTful API without frontend interface
- **Live data approach**: All balance and transaction data is fetched directly from Blockchain.info API
- **No local transaction storage**: Transactions are not stored in the database to ensure always-fresh data
- **Minimal database footprint**: Only user addresses and labels are stored locally
- **Real-time accuracy**: Every request returns current blockchain data

## Features

- ✅ **Multi-user support** - Each user can track their own Bitcoin addresses
- ✅ Add/Remove Bitcoin addresses per user
- ✅ Synchronize Bitcoin wallet transactions
- ✅ Retrieve current balances and transaction history
- ✅ Multi-address balance queries
- ✅ User-based data isolation
- ✅ SQLite database for persistent storage
- ✅ Basic security headers
- ✅ RESTful API with comprehensive error handling

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd btc-tracker
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
# Development mode with auto-reload
npm run dev
```

The server will start on `http://localhost:3000`

## Security Considerations

### **Important Security Notes:**

- ⚠️ **No Authentication**: This API does not implement user authentication or authorization
- ⚠️ **User ID Validation**: User IDs are not validated - any string can be used as a user identifier
- ⚠️ **Public API**: All endpoints are publicly accessible without authentication
- ⚠️ **Data Privacy**: User addresses and labels are stored in plain text in the database

### **Production Deployment Recommendations:**

- **Implement proper authentication** (JWT, API keys, OAuth, etc.)
- **Add user registration and login system**
- **Implement rate limiting** to prevent API abuse
- **Use HTTPS/TLS** for all communications
- **Add input sanitization** beyond basic validation
- **Implement logging and monitoring** for security events
- **Consider encrypting sensitive data** in the database
- **Add API versioning** for future updates
- **Implement proper error handling** that doesn't leak sensitive information

### **Network Security:**

- Deploy behind a reverse proxy (nginx, Apache)
- Use firewall rules to restrict database access
- Consider VPN access for administrative functions
- Implement proper backup and disaster recovery procedures

## API Endpoints

**Important**: All endpoints require user identification via:
- Header: `user-id: your-user-id` (recommended)
- Query parameter: `?user_id=your-user-id`

### Address Management

- `GET /api/addresses` - Get all addresses for a user
- `POST /api/addresses` - Add a new Bitcoin address
  ```json
  {
    "address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
    "label": "Genesis Block Address"
  }
  ```
- `GET /api/addresses/:address` - Get specific address information
- `DELETE /api/addresses/:address` - Remove an address
- `GET /api/addresses/:address/transactions?limit=50&offset=0` - Get address transactions
- `GET /api/addresses/user/transactions?limit=50&offset=0` - Get all transactions for a user

### Live Data Endpoints

- `GET /api/sync/address/:address?limit=50&offset=0` - Get live data for specific address
- `GET /api/sync/user?limit=50` - Get live data for all user addresses  
- `GET /api/sync/user/balances` - Get live balances for all user addresses
- `GET /api/sync/status` - Get blockchain status and API info

### Utility

- `GET /health` - Health check endpoint
- `GET /api` - API documentation

## Database Schema

### Addresses Table (Only Local Storage)
- `id` - Primary key
- `user_id` - User identifier (string)
- `address` - Bitcoin address
- `label` - Optional label for the address
- `created_at` - Timestamp
- `updated_at` - Timestamp
- **Unique constraint**: `(user_id, address)` - Same address can be tracked by multiple users

**Note**: Only address information is stored locally. All balance and transaction data is fetched live from the Blockchain.info API to ensure real-time accuracy.

## Blockchain.info API Integration

The application uses the following Blockchain.info API endpoints:

- **Single Address**: `https://blockchain.info/rawaddr/$bitcoin_address`
- **Multi Address**: `https://blockchain.info/multiaddr?active=$address|$address`
- **Balance**: `https://blockchain.info/balance?active=$address`
- **Latest Block**: `https://blockchain.info/latestblock`

## Example Usage

### Add an address:
```bash
curl -X POST http://localhost:3000/api/addresses \
  -H "Content-Type: application/json" \
  -H "user-id: user123" \
  -d '{"address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa", "label": "Genesis"}'
```

### Get live address data:
```bash
curl "http://localhost:3000/api/sync/address/1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa?limit=10" \
  -H "user-id: user123"
```

### Get address balance:
```bash
curl http://localhost:3000/api/addresses/1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa \
  -H "user-id: user123"
```

### Get all addresses for a user:
```bash
curl http://localhost:3000/api/addresses \
  -H "user-id: user123"
```

### Get live data for all user addresses:
```bash
curl "http://localhost:3000/api/sync/user?limit=10" \
  -H "user-id: user123"
```

### Get live balances for all user addresses:
```bash
curl http://localhost:3000/api/sync/user/balances \
  -H "user-id: user123"
```

## Development

The project uses:
- **Express.js** - Web framework
- **SQLite3** - Database
- **Axios** - HTTP client for blockchain API
- **CORS** - Cross-origin resource sharing

