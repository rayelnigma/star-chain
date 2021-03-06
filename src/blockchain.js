/**
 *                          Blockchain Class
 *  The Blockchain class contain the basics functions to create your own private blockchain
 *  It uses libraries like `crypto-js` to create the hashes for each block and `bitcoinjs-message` 
 *  to verify a message signature. The chain is stored in the array
 *  `this.chain = [];`. Of course each time you run the application the chain will be empty because and array
 *  isn't a persisten storage method.
 *  
 */

const SHA256 = require('crypto-js/sha256');
const BlockClass = require('./block.js');
const bitcoinMessage = require('bitcoinjs-message');
const hex2ascii = require('hex2ascii');

const { createLogger, format, transports } = require('winston');
const logger = createLogger({
    level: 'info',
    format: format.combine(
        format.label({ label: 'blockchain' }),
        format.timestamp({
            format: 'YYYYMMDD,HHmmss.SSS'
        }),
        format.errors({ stack: true }),
        format.splat(),
        format.colorize(),
        format.printf(({ level, message, label, timestamp, stack }) => {
            if (stack) return `${timestamp}:[${label}]:${level}: ${message} - ${stack}`;
            return `${timestamp}:[${label}]:${level}: ${message}`;
        })
    ),
    defaultMeta: { service: 'star-chain' },
    transports: [
        new transports.Console()
    ]
});

class Blockchain {

    /**
     * Constructor of the class, you will need to setup your chain array and the height
     * of your chain (the length of your chain array).
     * Also everytime you create a Blockchain class you will need to initialized the chain creating
     * the Genesis Block.
     * The methods in this class will always return a Promise to allow client applications or
     * other backends to call asynchronous functions.
     */
    constructor() {
        this.chain = [];
        this.height = -1;
        this.initializeChain();
    }

    /**
     * This method will check for the height of the chain and if there isn't a Genesis Block it will create it.
     * You should use the `addBlock(block)` to create the Genesis Block
     * Passing as a data `{data: 'Genesis Block'}`
     */
    async initializeChain() {
        if (this.height === -1) {
            logger.info('----------------------------------------------------------------------');
            let block = new BlockClass.Block({ data: 'Genesis Block' });
            await this._addBlock(block);
        }
    }

    /**
     * Utility method that return a Promise that will resolve with the height of the chain
     */
    getChainHeight() {
        let self = this;
        return new Promise((resolve, reject) => {
            resolve(self.height);
        });
    }

    /**
     * _addBlock(block) will store a block in the chain
     * @param {*} block 
     * The method will return a Promise that will resolve with the block added
     * or reject if an error happen during the execution.
     * You will need to check for the height to assign the `previousBlockHash`,
     * assign the `timestamp` and the correct `height`...At the end you need to 
     * create the `block hash` and push the block into the chain array. Don't for get 
     * to update the `this.height`
     * Note: the symbol `_` in the method name indicates in the javascript convention 
     * that this method is a private method. 
     */
    _addBlock(block) {
        let self = this;
        return new Promise(async (resolve, reject) => {
            block.time = new Date().getTime().toString().slice(0, -3);
            let chainHeight = await self.getChainHeight().catch(error => {
                logger.error('_addBlock > getChainHeight() > Error: ', error);
                reject('Error: an error ocurred while getting the chain height during the add block process');
            });
            block.height = chainHeight + 1;
            if (chainHeight >= 0) {
                block.previousBlockHash = self.chain[chainHeight].hash;
            }
            block.hash = SHA256(JSON.stringify(block)).toString();
            self.chain.push(block);
            self.height++;
            await self.validateChain();
            resolve(block);
        });
    }

    /**
     * The requestMessageOwnershipVerification(address) method
     * will allow you  to request a message that you will use to
     * sign it with your Bitcoin Wallet (Electrum or Bitcoin Core)
     * This is the first step before submit your Block.
     * The method return a Promise that will resolve with the message to be signed
     * @param {*} address 
     */
    requestMessageOwnershipVerification(address) {
        return new Promise((resolve) => {
            let message = address + ':' + new Date().getTime().toString().slice(0, -3) + ':starRegistry';
            logger.info('requestMessageOwnershipVerification.message=' + message);
            resolve(message);
        });
    }

    /**
     * The submitStar(address, message, signature, star) method
     * will allow users to register a new Block with the star object
     * into the chain. This method will resolve with the Block added or
     * reject with an error.
     * Algorithm steps:
     * 1. Get the time from the message sent as a parameter example: `parseInt(message.split(':')[1])`
     * 2. Get the current time: `let currentTime = parseInt(new Date().getTime().toString().slice(0, -3));`
     * 3. Check if the time elapsed is less than 5 minutes
     * 4. Verify the message with wallet address and signature: `bitcoinMessage.verify(message, address, signature)`
     * 5. Create the block and add it to the chain
     * 6. Resolve with the block added.
     * @param {*} address 
     * @param {*} message 
     * @param {*} signature 
     * @param {*} star 
     */
    submitStar(address, message, signature, star) {
        let self = this;
        return new Promise(async (resolve, reject) => {
            let time = parseInt(message.split(':')[1]);
            let currentTime = parseInt(new Date().getTime().toString().slice(0, -3));
            let timeDifference = currentTime - time;
            logger.info('submitted time=', time, ', current time=', currentTime, ', diff=', timeDifference);
            if (timeDifference > (5 * 60)) reject('Error: more than 5 minutes has elapsed beyond owners timestamp within message');
            try {
                if (!bitcoinMessage.verify(message, address, signature)) reject('Error: signature does not match');
            } catch (error) {
                logger.error(error);
                reject('An error was encountered while trying to verify the signature: ' + error.toString());
            }
            let newBlock = new BlockClass.Block({
                'address': address,
                'message': message,
                'signature': signature,
                'star': star
            });
            resolve(await self._addBlock(newBlock).catch((error) => reject(error)));
        });
    }

    /**
     * This method will return a Promise that will resolve with the Block
     *  with the hash passed as a parameter.
     * Search on the chain array for the block that has the hash.
     * @param {*} hash 
     */
    getBlockByHash(hash) {
        let self = this;
        return new Promise((resolve, reject) => {
            resolve(self.chain.find(block => block.hash === hash));
        });
    }

    /**
     * This method will return a Promise that will resolve with the Block object 
     * with the height equal to the parameter `height`
     * @param {*} height 
     */
    getBlockByHeight(height) {
        let self = this;
        return new Promise(async (resolve, reject) => {
            let block = self.chain.filter(p => p.height === height)[0];
            if (block) {
                try {
                    logger.info('getBlockByHeight > block.getBData(): ', await block.getBData());
                } catch (error) {
                    logger.error('getBlockByHeight > block.getBData(): ', error);
                }
                resolve(block);
            } else {
                resolve(null);
            }
        });
    }

    /**
     * This method will return a Promise that will resolve with an array of Stars objects existing in the chain 
     * and are belongs to the owner with the wallet address passed as parameter.
     * Remember the star should be returned decoded.
     * @param {*} address 
     */
    getStarsByWalletAddress(address) {
        let self = this;
        let stars = [];
        return new Promise((resolve, reject) => {
            this.chain.slice(1).forEach((block) => {
                let blockDataPromise = block.getBData();
                blockDataPromise.then(blockData => {
                    logger.info('getStarsByWalletAddress() > address: ', address, ', blockData: ', blockData, ', blockAddress: ', blockData.address);
                    if (address === blockData.address) {
                        stars.push(blockData.star);
                    }
                });
            });
            resolve(stars);
        });
    }

    /**
     * This method will return a Promise that will resolve with the list of errors when validating the chain.
     * Steps to validate:
     * 1. You should validate each block using `validateBlock`
     * 2. Each Block should check the with the previousBlockHash
     */
    validateChain() {
        let self = this;
        let errorLog = [];
        return new Promise(async (resolve, reject) => {
            let previousHash = null;
            self.chain.forEach(async (block) => {
                if (!(await block.validate().catch(error => errorLog.push(error)))) errorLog.push('block did not validate, for block.hash=' + block.hash);
                if (block.height > 0 && previousHash !== block.previousBlockHash) errorLog.push('previousHash does not match, for block.hash=' + block.hash);
                previousHash = block.hash;
            });
            resolve(errorLog);
        });
    }

}

// TODO: review rubric: https://review.udacity.com/#!/rubrics/2546/view 
module.exports.Blockchain = Blockchain;