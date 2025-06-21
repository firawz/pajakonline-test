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
import { pdfToPng } from "pdf-to-png-converter";
import { parsedDataMapping, parseText } from "./utils/data-mapping.js";
import { qrScanner } from "./utils/qr-code-scanner.js";

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
  return res.status(400).json({ error: 'Invalid input' });
});

app.use('/api/v1', router);

router.post('/data', (req, res) => {
  const contentType = req.headers['content-type'];
  if (contentType.includes('application/json')) {
  } else if (contentType.includes('application/xml') || contentType.includes('text/xml')) {
    const data = req.body.resValidateFakturPm;

    // const parsed = {
    //   'NPWP Penjual': numberValidator(data.npwpPenjual),
    //   'Nama Penjual': data.namaPenjual,
    //   'NPWP Pembeli': numberValidator(data.npwpLawanTransaksi),
    //   'Nama Pembeli': data.namaLawanTransaksi,
    //   'Nomor Faktur': data.nomorFaktur,
    //   'Tanggal Faktur': dateValidator(data.tanggalFaktur),
    //   'Jumlah DPP': data.jumlahDpp,
    //   'Jumlah PPN': data.jumlahPpn,
    // };

    const result = parsedDataMapping(data);

    return res.status(200).send({ status: 'success', data: result });
  } else {
    return res.status(400).send({ error: 'Unsupported Content-Type' });
  }
  return res.status(200).send({ status: 'success', data: req.body, message: 'Payload received' });
});

router.post("/validate-efaktur", upload.single("file"), async (req, res) => {
  const mimeType = req.file.mimetype;

  try {
    if (req.file.mimetype.includes('pdf')) {
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

      const qr_data = await qrScanner(mimeType, req, res)

      const result = {
        text: parsed,
        metadata: {
          numpages: data.numpages,
          numrender: data.numrender,
          info: data.info,
          metadata: data.metadata,
        },
        qr_data
      };
      return res.status(200).send({ status: 'success', data: result })
    } else {
      return res.status(400).json({ status: 'error', error: "File is not supported." });
    }
  } catch (error) {
    return res.status(500).json({ error: "Error processing request" });
  } finally {
    fs.unlinkSync(req.file.path);
  }
})

router.post("/qr-validator", upload.single("file"), async (req, res) => {
  const qr_code = await qrScanner(req.file.mimetype, req, res)
  if (qr_code.error) {
    return res.status(400).json({ status: 'error', error: qr_code.error });
  }
  return res.status(200).json({ status: 'success', data: qr_code.data });
})


router.use((err, req, res, next) => {
  console.error(err, '<== ini error apa?')
  return res.status(404).send({ status: 'error', error: '404 Not Found' });
});

app.listen(PORT, () => {
  console.log(`Application running on port ${PORT}`);
});
