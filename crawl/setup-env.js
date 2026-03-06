const fs = require('fs');
const path = require('path');

const envExamplePath = path.join(__dirname, '.env.example');
const envPath = path.join(__dirname, '.env');

if (fs.existsSync(envPath)) {
    console.log('.env file already exists. Skipping creation.');
    process.exit(0);
}

if (!fs.existsSync(envExamplePath)) {
    console.error('.env.example file not found. Please create it manually.');
    process.exit(1);
}

try {
    fs.copyFileSync(envExamplePath, envPath);
    console.log('.env file created successfully from .env.example');
    console.log('Please update the .env file with your actual database credentials.');
} catch (error) {
    console.error('Error creating .env file:', error.message);
    process.exit(1);
}
