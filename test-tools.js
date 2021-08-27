const express = require('express');
require('dotenv').config();
const bitcoin = require('bitcoinjs-lib'); // v4.x.x
const bitcoinMessage = require('bitcoinjs-message');
const app = express();
const port = 3000;

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.listen(port, () => {
    console.log('--------------- test-tools ------------------------');
    // wallet address: 
    var address = process.env.WALLET_ADDRESS;
    console.log('address="' + address + '"');
    var privateKeyWif = process.env.PRIVATE_KEY_WIF;
    console.log('privateKeyWif="' + privateKeyWif + '"');

    var keyPair = bitcoin.ECPair.fromWIF(privateKeyWif, bitcoin.networks.testnet);
    privateKey = keyPair.privateKey;
    var message = 'This is an example of a signed message.';

    var signature = bitcoinMessage.sign(message, privateKey, keyPair.compressed);
    // var signature = bitcoinMessage.sign(message, privateKey, false);
    console.log(signature.toString('base64'));
    console.log(bitcoinMessage.verify(message, address, signature))

    console.log(`Example app listening at http://localhost:${port}`);
});