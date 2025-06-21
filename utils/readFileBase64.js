import fs from 'fs';

export const readFileBase64 = (filepath, prompt, mimeType) => (
    {
        data: fs.readFileSync(filepath, {encoding: 'base64'}),
        mimeType: mimeType
    }
)