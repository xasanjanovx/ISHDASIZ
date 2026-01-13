
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

console.log('All Environment Keys:', Object.keys(process.env));
