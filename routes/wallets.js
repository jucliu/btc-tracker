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
 * GET /api/addresses
 * Get all addresses for a user with live balance data
 */
router.get('/', getUserId, async (req, res) => {
    try {
        const addresses = await db.getUserAddresses(req.userId);
        
        if (addresses.length === 0) {
            return res.json({
                success: true,
                data: []
            });
        }

        // Get live balance data from blockchain API
        const addressStrings = addresses.map(a => a.address);
        let balances = {};
        
        try {
            balances = await blockchainService.getMultipleBalances(addressStrings);
        } catch (apiError) {
            console.warn('Could not fetch balances from API:', apiError.message);
        }

        // Combine address data with live balances
        const formattedAddresses = addresses.map(address => ({
            id: address.id,
            user_id: address.user_id,
            address: address.address,
            label: address.label,
            created_at: address.created_at,
            updated_at: address.updated_at,
            balance: balances[address.address] ? {
                final_balance: blockchainService.satoshisToBTC(balances[address.address].final_balance),
                total_received: blockchainService.satoshisToBTC(balances[address.address].total_received),
                total_sent: blockchainService.satoshisToBTC(balances[address.address].total_sent),
                n_tx: balances[address.address].n_tx
            } : null
        }));

        res.json({
            success: true,
            data: formattedAddresses
        });
    } catch (error) {
        console.error('Error fetching addresses:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch addresses'
        });
    }
});

/**
 * POST /api/addresses
 * Add a new Bitcoin address for a user
 */
router.post('/', getUserId, async (req, res) => {
    try {
        const { address, label } = req.body;

        if (!address) {
            return res.status(400).json({
                success: false,
                error: 'Address is required'
            });
        }

        // Validate Bitcoin address format
        if (!blockchainService.isValidBitcoinAddress(address)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid Bitcoin address format'
            });
        }

        // Check if address already exists for this user
        const existingAddress = await db.getAddressByUserAndAddress(req.userId, address);
        if (existingAddress) {
            return res.status(409).json({
                success: false,
                error: 'Address already exists for this user'
            });
        }

        // Add address to database
        const addressRecord = await db.addAddress(req.userId, address, label);

        // Try to fetch initial balance and basic info
        try {
            const balances = await blockchainService.getMultipleBalances([address]);
            if (balances[address]) {
                addressRecord.balance = {
                    final_balance: blockchainService.satoshisToBTC(balances[address].final_balance),
                    total_received: blockchainService.satoshisToBTC(balances[address].total_received),
                    total_sent: blockchainService.satoshisToBTC(balances[address].total_sent),
                    n_tx: balances[address].n_tx
                };
            } else {
                addressRecord.balance = null;
            }
        } catch (apiError) {
            console.warn(`Could not fetch initial balance for ${address}:`, apiError.message);
            addressRecord.balance = null;
        }

        res.status(201).json({
            success: true,
            data: addressRecord
        });
    } catch (error) {
        console.error('Error adding address:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to add address'
        });
    }
});

/**
 * DELETE /api/addresses/:address
 * Remove a Bitcoin address for a user
 */
router.delete('/:address', getUserId, async (req, res) => {
    try {
        const { address } = req.params;

        if (!address) {
            return res.status(400).json({
                success: false,
                error: 'Address is required'
            });
        }

        const result = await db.removeAddress(req.userId, address);
        
        if (!result.deleted) {
            return res.status(404).json({
                success: false,
                error: 'Address not found for this user'
            });
        }

        res.json({
            success: true,
            message: 'Address removed successfully'
        });
    } catch (error) {
        console.error('Error removing address:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to remove address'
        });
    }
});

/**
 * GET /api/addresses/:address
 * Get specific address information for a user with live data
 */
router.get('/:address', getUserId, async (req, res) => {
    try {
        const { address } = req.params;

        const addressRecord = await db.getAddressByUserAndAddress(req.userId, address);
        if (!addressRecord) {
            return res.status(404).json({
                success: false,
                error: 'Address not found for this user'
            });
        }

        // Get live balance information from API
        let balance = null;
        try {
            const balances = await blockchainService.getMultipleBalances([address]);
            if (balances[address]) {
                balance = {
                    final_balance: blockchainService.satoshisToBTC(balances[address].final_balance),
                    total_received: blockchainService.satoshisToBTC(balances[address].total_received),
                    total_sent: blockchainService.satoshisToBTC(balances[address].total_sent),
                    n_tx: balances[address].n_tx
                };
            }
        } catch (apiError) {
            console.warn(`Could not fetch balance for ${address}:`, apiError.message);
        }

        res.json({
            success: true,
            data: {
                ...addressRecord,
                balance: balance
            }
        });
    } catch (error) {
        console.error('Error fetching address:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch address'
        });
    }
});

/**
 * GET /api/addresses/:address/transactions
 * Get live transactions for a specific address
 */
router.get('/:address/transactions', getUserId, async (req, res) => {
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

        // Get live transaction data from blockchain API
        const addressInfo = await blockchainService.getAddressInfo(
            address, 
            parseInt(limit), 
            parseInt(offset)
        );

        // Format transactions for display
        const formattedTransactions = addressInfo.txs ? await Promise.all(addressInfo.txs.map(async tx => ({
            hash: tx.hash,
            block_height: tx.block_height,
            time: tx.time,
            fee: tx.fee ? blockchainService.satoshisToBTC(tx.fee) : 0,
            confirmations: tx.block_height ? await blockchainService.calculateConfirmations(tx.block_height) : 0,
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
        }))) : [];

        res.json({
            success: true,
            data: {
                address: address,
                total_transactions: addressInfo.n_tx || 0,
                transactions: formattedTransactions
            }
        });
    } catch (error) {
        console.error('Error fetching address transactions:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch address transactions'
        });
    }
});

/**
 * GET /api/addresses/user/transactions
 * Get all transactions for a user across all addresses
 */
router.get('/user/transactions', getUserId, async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;

        // Get user's addresses
        const addresses = await db.getUserAddresses(req.userId);
        
        if (addresses.length === 0) {
            return res.json({
                success: true,
                data: {
                    user_id: req.userId,
                    total_addresses: 0,
                    transactions: []
                }
            });
        }

        // Get transactions for all addresses using multi-address API
        const addressStrings = addresses.map(a => a.address);
        const multiAddressInfo = await blockchainService.getMultipleAddressInfo(
            addressStrings,
            parseInt(limit),
            parseInt(offset)
        );

        // Format transactions for display
        const formattedTransactions = multiAddressInfo.txs ? await Promise.all(multiAddressInfo.txs.map(async tx => ({
            hash: tx.hash,
            block_height: tx.block_height,
            time: tx.time,
            fee: tx.fee ? blockchainService.satoshisToBTC(tx.fee) : 0,
            confirmations: tx.block_height ? await blockchainService.calculateConfirmations(tx.block_height) : 0,
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
        }))) : [];

        res.json({
            success: true,
            data: {
                user_id: req.userId,
                total_addresses: addresses.length,
                transactions: formattedTransactions
            }
        });
    } catch (error) {
        console.error('Error fetching user transactions:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch user transactions'
        });
    }
});

module.exports = router;
