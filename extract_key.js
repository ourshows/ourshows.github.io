
const fs = require('fs');
const path = require('path');

const filesToTry = ['public/firebase-config.js', 'firebase-config.js'];

filesToTry.forEach(file => {
    try {
        if (fs.existsSync(file)) {
            console.log(`Reading ${file}...`);
            const content = fs.readFileSync(file, 'utf8');
            const match = content.match(/apiKey:\s*"([^"]+)"/);
            if (match) {
                console.log(`FOUND KEY IN ${file}: ${match[1]}`);
            } else {
                // Try single quotes
                const matchSingle = content.match(/apiKey:\s*'([^']+)'/);
                if (matchSingle) {
                    console.log(`FOUND KEY IN ${file}: ${matchSingle[1]}`);
                } else {
                    console.log(`No key found in ${file}`);
                    // Print first 100 chars to debug
                    console.log('Snippet:', content.substring(0, 100));
                }
            }
        }
    } catch (e) {
        console.error(`Error reading ${file}:`, e.message);
    }
});
