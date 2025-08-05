const fs = require('fs');
const path = require('path');
const bs58 = require('bs58').default;
const { Keypair } = require('@solana/web3.js');

const envPath = path.resolve(__dirname, '../.env');

// 1. Generate keypair
const keypair = Keypair.generate();
const encodedKey = bs58.encode(keypair.secretKey);

// 2. Read existing .env
let envContent = '';
if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf-8');
}

// 3. Remove old BACKEND_AUTH if present
envContent = envContent
  .split('\n')
  .filter(line => !line.startsWith('BACKEND_AUTH='))
  .join('\n');

// 4. Append new key
envContent += `\nBACKEND_AUTH=${encodedKey}\n`;

// 5. Write to .env
fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf-8');

console.log('✅ BACKEND_AUTH key added to .env');
