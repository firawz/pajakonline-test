import express from "express";
import * as dotenv from "dotenv";
import multer from "multer";
import fs from "fs";
import path from "path";
import { readFileBase64 } from "./utils/readFileBase64.js";
import pdf from 'pdf-parse/lib/pdf-parse.js';
import jsQR from "jsqr";
import { Jimp } from "jimp";
import sharp from "sharp";
import bodyParser from 'body-parser';
import bodyParserXml from 'body-parser-xml';
import { dateValidator, numberValidator, parseText } from "./utils/validator.js";


dotenv.config();
const upload = multer({ dest: "uploads/" });
const PORT = 3000;

const app = express();
const router = express.Router()

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

bodyParserXml(bodyParser);

app.use(bodyParser.json());
app.use(bodyParser.xml({
  limit: '1MB',
  xmlParseOptions: {
    explicitArray: false,
  }
}));

app.use((err, req, res, next) => {
  console.error(err.message, '<== ini error');
  return res.status(400).json({ error: 'Invalid input' });
});

app.use('/api/v1', router);


router.get("/", (req, res) => {
  res.send("Hello World!");
});

router.post("/upload", upload.single("image"), async (req, res) => {
  const file = readFileBase64(req.file.path, req.file.mimetype);
  const data = file
  try {
    return res.status(200).send({
      status: "success",
      data,
    });
  } catch (error) {
    return res.status(500).json({ error: "Error processing request" });
  } finally {
    // Clean up the uploaded file
    fs.unlinkSync(req.file.path, (err) => {
      if (err) console.error("Error deleting file:", err);
    });
  }
});

router.post('/data', (req, res) => {
  const contentType = req.headers['content-type'];
  if (contentType.includes('application/json')) {
  } else if (contentType.includes('application/xml') || contentType.includes('text/xml')) {
    const data = req.body.resValidateFakturPm;

    const parsed = {
      'NPWP Penjual': numberValidator(data.npwpPenjual),
      'Nama Penjual': data.namaPenjual,
      'NPWP Pembeli': numberValidator(data.npwpLawanTransaksi),
      'Nama Pembeli': data.namaLawanTransaksi,
      'Nomor Faktur': data.nomorFaktur,
      'Tanggal Faktur': dateValidator(data.tanggalFaktur),
      'Jumlah DPP': data.jumlahDpp,
      'Jumlah PPN': data.jumlahPpn,
    };

    const result = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = value;

      if (key === 'npwpPenjual') {
        result['NPWP Penjual'] = numberValidator(value);
        delete result[key]
      }

      if (key === 'namaPenjual') {
        result['Nama Penjual'] = value;
        delete result[key]
      }

      if (key === 'namaPenjual') {
        result['Nama Penjual'] = value;
        delete result[key]
      }

      if (key === 'npwpLawanTransaksi') {
        result['NPWP Pembeli'] = numberValidator(value);
        delete result[key]
      }

      if (key === 'namaLawanTransaksi') {
        result['Nama Pembeli'] = value;
        delete result[key]
      }

      if (key === 'nomorFaktur') {
        result['Nomor Faktur'] = numberValidator(value);
        delete result[key]
      }

      if (key === 'tanggalFaktur') {
        result['Tanggal Faktur'] = dateValidator(value);
        delete result[key]
      }

      if (key === 'jumlahDpp') {
        result['Jumlah DPP'] = numberValidator(value);
        delete result[key]
      }

      if (key === 'jumlahPpn') {
        result['Jumlah PPN'] = numberValidator(value);
        delete result[key]
      }
    }

    return res.status(200).send({ status: 'success', data: result });
  } else {
    return res.status(400).send({ error: 'Unsupported Content-Type' });
  }

  res.send('Payload received');
});

router.post("/validate-efaktur", upload.single("pdf"), async (req, res) => {
  if (!req.file.mimetype.includes('pdf')) {
    return res.status(400).json({ error: "File is not a PDF." });
  }
  try {
    const filePath = path.join("uploads", req.file.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found." });
    }
    const dataBuffer = fs.readFileSync(req.file.path);
    const data = await pdf(dataBuffer);
    const text = data.text.replace(/\n+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
    const parsed = parseText(text)

    const result = {
      text: parsed,
      metadata: {
        numpages: data.numpages,
        numrender: data.numrender,
        info: data.info,
        metadata: data.metadata,
      },
    };
    res.status(200).send({ data: result })
  } catch (error) {
    return res.status(500).json({ error: "Error processing request" });
  } finally {
    fs.unlinkSync(req.file.path, (err) => {
      if (err) console.error("Error deleting file:", err);
    });
  }
})

router.post("/qr-validator", upload.single("file"), async (req, res) => {
  const mimeType = req.file.mimetype;

  try {
    if (mimeType.includes('image') || mimeType.includes('pdf')) {

      const filePath = path.join("uploads", req.file.filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "File not found." });
      }
      let file = filePath
      if (mimeType.includes('image')) {
        const dataBuffer = fs.readFileSync(req.file.path)
        file = await sharp(dataBuffer).png({ quality: 30 }).toBuffer()
      }
      const image = await Jimp.read(file);
      if (!image) {
        return res.status(400).json({ error: "Invalid image file." });
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
        res.status(200).send({ data: code.data });
      } else {
        res.status(404).send({ error: "No QR code found." });
      }
    } else {
      return res.status(400).json({ error: "File is not an image or PDF." });
    }

  } catch (error) {
    console.error("Error processing QR code:", error);
    return res.status(500).json({ error: "Error processing request" });
  } finally {
    fs.unlinkSync(req.file.path, (err) => {
      if (err) console.error("Error deleting file:", err);
    });
  }
})


router.use((err, req, res, next) => {
  console.error(err, '<== ini error apa?')
  res.status(404).send({ error: '404 Not Found' });
});



app.listen(PORT, () => {
  console.log(`Application running on port ${PORT}`);
});
