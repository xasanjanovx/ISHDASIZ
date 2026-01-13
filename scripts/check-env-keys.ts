
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

console.log('Environment Keys:', Object.keys(process.env).filter(k => k.includes('URL') || k.includes('DB') || k.includes('POSTGRES')));
