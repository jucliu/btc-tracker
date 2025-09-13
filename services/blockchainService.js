const axios = require('axios');

class BlockchainService {
    constructor() {
        this.baseUrl = 'https://blockchain.info';
        this.timeout = 10000; // 10 seconds timeout
    }

    /**
     * Get address information including balance and transactions
     * @param {string} address - Bitcoin address
     * @param {number} limit - Number of transactions to fetch (max 50)
     * @param {number} offset - Number of transactions to skip
     */
    async getAddressInfo(address, limit = 50, offset = 0) {
        try {
            const url = `${this.baseUrl}/rawaddr/${address}`;
            const params = {
                limit: Math.min(limit, 50),
                offset: offset,
                cors: true
            };

            const response = await axios.get(url, {
                params,
                timeout: this.timeout,
                headers: {
                    'User-Agent': 'BTC-Tracker/1.0'
                }
            });

            return response.data;
        } catch (error) {
            console.error(`Error fetching address info for ${address}:`, error.message);
            throw new Error(`Failed to fetch address information: ${error.message}`);
        }
    }

    /**
     * Get balance for multiple addresses
     * @param {string[]} addresses - Array of Bitcoin addresses
     */
    async getMultipleBalances(addresses) {
        try {
            if (!addresses || addresses.length === 0) {
                return {};
            }

            const addressString = addresses.join('|');
            const url = `${this.baseUrl}/balance`;
            const params = {
                active: addressString,
                cors: true
            };

            const response = await axios.get(url, {
                params,
                timeout: this.timeout,
                headers: {
                    'User-Agent': 'BTC-Tracker/1.0'
                }
            });

            return response.data;
        } catch (error) {
            console.error('Error fetching multiple balances:', error.message);
            throw new Error(`Failed to fetch balances: ${error.message}`);
        }
    }

    /**
     * Get transactions for multiple addresses
     * @param {string[]} addresses - Array of Bitcoin addresses
     * @param {number} limit - Number of transactions to fetch (max 100)
     * @param {number} offset - Number of transactions to skip
     */
    async getMultipleAddressInfo(addresses, limit = 50, offset = 0) {
        try {
            if (!addresses || addresses.length === 0) {
                return { addresses: [], txs: [] };
            }

            const addressString = addresses.join('|');
            const url = `${this.baseUrl}/multiaddr`;
            const params = {
                active: addressString,
                n: Math.min(limit, 100),
                offset: offset,
                cors: true
            };

            const response = await axios.get(url, {
                params,
                timeout: this.timeout,
                headers: {
                    'User-Agent': 'BTC-Tracker/1.0'
                }
            });

            return response.data;
        } catch (error) {
            console.error('Error fetching multiple address info:', error.message);
            throw new Error(`Failed to fetch multiple address information: ${error.message}`);
        }
    }

    /**
     * Get latest block information
     */
    async getLatestBlock() {
        try {
            const url = `${this.baseUrl}/latestblock`;
            const params = { cors: true };

            const response = await axios.get(url, {
                params,
                timeout: this.timeout,
                headers: {
                    'User-Agent': 'BTC-Tracker/1.0'
                }
            });

            return response.data;
        } catch (error) {
            console.error('Error fetching latest block:', error.message);
            throw new Error(`Failed to fetch latest block: ${error.message}`);
        }
    }

    /**
     * Process transaction data to determine if it's incoming or outgoing for a specific address
     * @param {Object} tx - Transaction object
     * @param {string} address - Address to check against
     */
    async processTransaction(tx, address) {
        let isIncoming = false;
        let value = 0;

        // Check if address is in outputs (incoming)
        for (const output of tx.out) {
            if (output.addr === address) {
                isIncoming = true;
                value += output.value;
            }
        }

        // Check if address is in inputs (outgoing)
        if (!isIncoming) {
            for (const input of tx.inputs) {
                if (input.prev_out && input.prev_out.addr === address) {
                    value -= input.prev_out.value;
                }
            }
        }

        return {
            hash: tx.hash,
            block_height: tx.block_height,
            time: tx.time,
            value: Math.abs(value),
            fee: tx.fee || 0,
            confirmations: tx.block_height ? await this.calculateConfirmations(tx.block_height) : 0,
            is_incoming: isIncoming
        };
    }

    /**
     * Calculate confirmations for a transaction
     * @param {number} blockHeight - Block height of the transaction
     */
    async calculateConfirmations(blockHeight) {
        try {
            const latestBlock = await this.getLatestBlock();
            return Math.max(0, latestBlock.height - blockHeight + 1);
        } catch (error) {
            console.error('Error calculating confirmations:', error.message);
            return 0;
        }
    }

    /**
     * Convert satoshis to BTC
     * @param {number} satoshis - Amount in satoshis
     */
    satoshisToBTC(satoshis) {
        return satoshis / 100000000;
    }

    /**
     * Convert BTC to satoshis
     * @param {number} btc - Amount in BTC
     */
    btcToSatoshis(btc) {
        return Math.round(btc * 100000000);
    }

    /**
     * Validate Bitcoin address format
     * @param {string} address - Bitcoin address to validate
     */
    isValidBitcoinAddress(address) {
        // Basic validation - checks for common Bitcoin address formats
        const legacyPattern = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
        const segwitPattern = /^bc1[a-z0-9]{39,59}$/;
        const testnetPattern = /^[2mn][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
        const testnetSegwitPattern = /^tb1[a-z0-9]{39,59}$/;

        return legacyPattern.test(address) || 
               segwitPattern.test(address) || 
               testnetPattern.test(address) || 
               testnetSegwitPattern.test(address);
    }
}

module.exports = new BlockchainService();
