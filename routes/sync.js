const express = require('express');
const router = express.Router();
const db = require('../database/db');
const blockchainService = require('../services/blockchainService');

// Middleware to extract user_id from headers or query params
const getUserId = (req, res, next) => {
    const userId = req.headers['user-id'] || req.query.user_id || req.body.user_id;
    
    if (!userId) {
        return res.status(400).json({
            success: false,
            error: 'User ID is required. Provide it in headers (user-id) or query parameter (user_id)'
        });
    }
    
    req.userId = userId;
    next();
};

/**
 * GET /api/sync/address/:address
 * Get live data for a specific address (no local storage)
 */
router.get('/address/:address', getUserId, async (req, res) => {
    try {
        const { address } = req.params;
        const { limit = 50, offset = 0 } = req.query;

        const addressRecord = await db.getAddressByUserAndAddress(req.userId, address);
        if (!addressRecord) {
            return res.status(404).json({
                success: false,
                error: 'Address not found for this user'
            });
        }

        // Fetch live address information from blockchain
        const addressInfo = await blockchainService.getAddressInfo(address, limit, offset);

        res.json({
            success: true,
            data: {
                address: address,
                user_id: req.userId,
                label: addressRecord.label,
                balance: {
                    final_balance: blockchainService.satoshisToBTC(addressInfo.final_balance),
                    total_received: blockchainService.satoshisToBTC(addressInfo.total_received),
                    total_sent: blockchainService.satoshisToBTC(addressInfo.total_sent),
                    n_tx: addressInfo.n_tx
                },
                transactions: addressInfo.txs ? await Promise.all(addressInfo.txs.map(async tx => ({
                    hash: tx.hash,
                    block_height: tx.block_height,
                    time: tx.time,
                    fee: tx.fee ? blockchainService.satoshisToBTC(tx.fee) : 0,
                    inputs: tx.inputs.map(input => ({
                        prev_out: input.prev_out ? {
                            addr: input.prev_out.addr,
                            value: blockchainService.satoshisToBTC(input.prev_out.value)
                        } : null
                    })),
                    out: tx.out.map(output => ({
                        addr: output.addr,
                        value: blockchainService.satoshisToBTC(output.value)
                    }))
                }))) : [],
                fetched_at: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error fetching address data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch address data: ' + error.message
        });
    }
});

/**
 * GET /api/sync/user
 * Get live data for all addresses of a specific user
 */
router.get('/user', getUserId, async (req, res) => {
    try {
        const { limit = 50 } = req.query;
        
        const addresses = await db.getUserAddresses(req.userId);
        if (addresses.length === 0) {
            return res.json({
                success: true,
                data: {
                    user_id: req.userId,
                    total_addresses: 0,
                    addresses: []
                }
            });
        }

        // Get live data for all addresses using multi-address API
        const addressStrings = addresses.map(a => a.address);
        const multiAddressInfo = await blockchainService.getMultipleAddressInfo(addressStrings, parseInt(limit));
        const balances = await blockchainService.getMultipleBalances(addressStrings);

        const addressResults = addresses.map(addressRecord => {
            const balance = balances[addressRecord.address];
            return {
                address: addressRecord.address,
                label: addressRecord.label,
                balance: balance ? {
                    final_balance: blockchainService.satoshisToBTC(balance.final_balance),
                    total_received: blockchainService.satoshisToBTC(balance.total_received),
                    total_sent: blockchainService.satoshisToBTC(balance.total_sent),
                    n_tx: balance.n_tx
                } : null
            };
        });

        res.json({
            success: true,
            data: {
                user_id: req.userId,
                total_addresses: addresses.length,
                addresses: addressResults,
                recent_transactions: multiAddressInfo.txs ? await Promise.all(multiAddressInfo.txs.slice(0, parseInt(limit)).map(async tx => ({
                    hash: tx.hash,
                    block_height: tx.block_height,
                    time: tx.time,
                    fee: tx.fee ? blockchainService.satoshisToBTC(tx.fee) : 0,
                    inputs: tx.inputs.map(input => ({
                        prev_out: input.prev_out ? {
                            addr: input.prev_out.addr,
                            value: blockchainService.satoshisToBTC(input.prev_out.value)
                        } : null
                    })),
                    out: tx.out.map(output => ({
                        addr: output.addr,
                        value: blockchainService.satoshisToBTC(output.value)
                    }))
                }))) : [],
                fetched_at: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error fetching user data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch user data: ' + error.message
        });
    }
});

/**
 * GET /api/sync/user/balances
 * Get live balances for all user addresses (faster than full data)
 */
router.get('/user/balances', getUserId, async (req, res) => {
    try {
        const addresses = await db.getUserAddresses(req.userId);
        if (addresses.length === 0) {
            return res.json({
                success: true,
                data: {
                    user_id: req.userId,
                    total_addresses: 0,
                    balances: []
                }
            });
        }

        // Get live balances for all addresses
        const addressStrings = addresses.map(a => a.address);
        const balances = await blockchainService.getMultipleBalances(addressStrings);

        const balanceResults = addresses.map(addressRecord => {
            const balance = balances[addressRecord.address];
            return {
                address: addressRecord.address,
                label: addressRecord.label,
                balance: balance ? {
                    final_balance: blockchainService.satoshisToBTC(balance.final_balance),
                    total_received: blockchainService.satoshisToBTC(balance.total_received),
                    total_sent: blockchainService.satoshisToBTC(balance.total_sent),
                    n_tx: balance.n_tx
                } : null
            };
        });

        res.json({
            success: true,
            data: {
                user_id: req.userId,
                total_addresses: addresses.length,
                balances: balanceResults,
                fetched_at: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error fetching balances:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch balances: ' + error.message
        });
    }
});

/**
 * GET /api/sync/status
 * Get latest block information and API status
 */
router.get('/status', async (req, res) => {
    try {
        const latestBlock = await blockchainService.getLatestBlock();

        res.json({
            success: true,
            data: {
                latest_block: {
                    height: latestBlock.height,
                    hash: latestBlock.hash,
                    time: latestBlock.time,
                    timestamp: new Date(latestBlock.time * 1000).toISOString()
                },
                api_status: 'operational',
                blockchain_api: 'https://blockchain.info',
                note: 'All data is fetched live from blockchain API - no local storage',
                checked_at: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error getting status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get status: ' + error.message
        });
    }
});

module.exports = router;
