import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'otp-data.json');

interface OtpRecord {
    phone: string;
    code: string;
    expires_at: number; // timestamp
    attempts: number;
}

// Simple file-based store for development
export const otpStore = {
    save: (phone: string, code: string) => {
        let data: Record<string, OtpRecord> = {};
        try {
            if (fs.existsSync(DB_PATH)) {
                data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
            }
        } catch (e) {
            // ignore corrupt file
        }

        data[phone] = {
            phone,
            code,
            expires_at: Date.now() + 5 * 60 * 1000, // 5 min
            attempts: 0
        };

        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    },

    get: (phone: string): OtpRecord | null => {
        try {
            if (!fs.existsSync(DB_PATH)) return null;
            const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
            return data[phone] || null;
        } catch (e) {
            return null;
        }
    },

    incrementAttempts: (phone: string) => {
        try {
            if (!fs.existsSync(DB_PATH)) return;
            const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
            if (data[phone]) {
                data[phone].attempts += 1;
                fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
            }
        } catch (e) { }
    },

    delete: (phone: string) => {
        try {
            if (!fs.existsSync(DB_PATH)) return;
            const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
            if (data[phone]) {
                delete data[phone];
                fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
            }
        } catch (e) { }
    }
};
