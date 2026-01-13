const fs = require('fs');
const path = require('path');

function getAllFiles(dirPath, arrayOfFiles) {
    const files = fs.readdirSync(dirPath);

    arrayOfFiles = arrayOfFiles || [];

    files.forEach(function (file) {
        if (fs.statSync(dirPath + "/" + file).isDirectory()) {
            if (file !== 'node_modules' && file !== '.next' && file !== '.git') {
                arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
            }
        } else {
            if (file.endsWith('.tsx') || file.endsWith('.ts')) {
                arrayOfFiles.push(path.join(dirPath, "/", file));
            }
        }
    });

    return arrayOfFiles;
}

const allFiles = getAllFiles(__dirname);

allFiles.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    if (content.includes("from 'lucide-react'")) {
        console.log(`Updating ${file}`);
        // Replace import { ... } from 'lucide-react' with ... from '@/components/ui/icons'
        // Also handle possible multi-line imports if regex matches
        content = content.replace(/from ['"]lucide-react['"]/g, "from '@/components/ui/icons'");

        // Also remove explicit LucideIcon imports if they become unused, or change them to any
        // But for now, just changing the import source is enough as icons.tsx exports mostly everything compatible
        // Note: Some types like LucideIcon might rely on lucide-react. We should check that.

        fs.writeFileSync(file, content);
    }
});
