import path from "path";
import fs from "fs";
import { pdfToPng } from "pdf-to-png-converter";
import sharp from "sharp";
import { Jimp } from "jimp";
import jsQR from "jsqr";

export const qrScanner = async (mimeType, req, res) => {
    const filePath = path.join("uploads", req.file.filename);
    if (!fs.existsSync(filePath)) {
        return { error: "File not found." };
    }
    try {
        if (mimeType.includes('image') || mimeType.includes('pdf')) {
            let file = filePath
            if (mimeType.includes('pdf')) {
                const dataBuffer = fs.readFileSync(req.file.path);
                const png = await pdfToPng(dataBuffer)
                file = await sharp(png[0].content).png({ quality: 90 }).toBuffer()
            }
            if (mimeType.includes('image')) {
                const dataBuffer = fs.readFileSync(req.file.path)
                file = await sharp(dataBuffer).png({ quality: 30 }).toBuffer()
            }
            const image = await Jimp.read(file);
            if (!image) {
                return { error: "Invalid image file." }
            }

            const imageData = {
                data: new Uint8ClampedArray(image.bitmap.data),
                width: image.bitmap.width,
                height: image.bitmap.height,
            };
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: "attemptBoth",
            });

            if (code) {
                return { data: code.data, error: null }
            } else {
                return { error: "No QR code found." }
            }
        } else {
            return { error: "File is not supported." }
        }

    } catch (error) {
        return { error: "Error processing qr code" }
    }
}