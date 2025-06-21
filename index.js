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
      const originalText = text
      const parsed = parseText(text)

      const qr_data = await qrScanner(mimeType, req, res)

      const result = {
        text: parsed,
        originalText,
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

router.get("/analysis-report", async (req, res) => {
  const data1 = { //xml
    type: 'xml',
    "kdJenisTransaksi": "07",
    "fgPengganti": "0",
    "Nomor Faktur": "0700002212345678",
    "Tanggal Faktur": "01/04/2022",
    "NPWP Penjual": "012345678012000",
    "Nama Penjual": "PT ABC",
    "alamatPenjual": "Jalan Gatot Subroto No. 40A, Senayan, Kebayoran Baru,\r\nJakarta Selatan 12910",
    "NPWP Pembeli": "023456789217000",
    "Nama Pembeli": "PT XYZ",
    "alamatLawanTransaksi": "Jalan Kuda Laut No. 1, Sungai Jodoh, Batu Ampar,\r\nBatam 29444",
    "Jumlah DPP": 15000000,
    "Jumlah PPN": 1650000,
    "jumlahPpnBm": "0",
    "statusApproval": "Faktur Valid, Sudah Diapprove oleh DJP",
    "statusFaktur": "Faktur Pajak Normal",
    "referensi": "123/ABC/IV/2022",
    "detailTransaksi": {
      "nama": "KOMPUTER MERK ABC, HS Code 84714110",
      "hargaSatuan": "5000000",
      "jumlahBarang": "3",
      "hargaTotal": "15000000",
      "diskon": "0",
      "dpp": "15000000",
      "ppn": "1650000",
      "tarifPpnbm": "0",
      "ppnbm": "0"
    }
  }

  const data2 = { //pdf 
    type: 'pdf',
    "NPWP Penjual": "012345678012000",
    "Nama Penjual": "PT ABC",
    "NPWP Pembeli": "0123456780121111111",
    "Nama Pembeli": "PT XYZ",
    "Nomor Faktur": "0700002212345678",
    "Tanggal Faktur": "01/05/2025",
    "Jumlah DPP": 15000000,
    "Jumlah PPN": 1650000
  }

  // let obj1 = Object.entries(data1)
  // let obj2 = Object.entries(data2)

  if (data1.length > data2.length) {
    [data1, data2] = [data2, data1]
  }

  const deviations = []
  const validated_data = []
  const type = data1.type

  for (let [key, value] of Object.entries(data1)) {
    const obj =
    {
      field: null,
      pdf_value: null,
      djp_api_value: null,
      deviation_type: null,
    }

    const obj2 = {
      [key]: value,
    }
    // console.log(obj2, '<== ni apa?')
    for (let [key1, value1] of Object.entries(data2)) {
      if (key == key1) {
        if (value != value1) {
          obj.field = key
          obj.djp_api_value = value
          obj.pdf_value = value1
          obj.deviation_type = "mismatch"
          deviations.push(obj)
        }
        if (value == value1) {
          validated_data.push(obj2)
        }
      }
    }
    // console.log(key, value, '<== ini apa??')
    if (type == 'xml') {
      obj.djp_api_value = value
      obj.deviation_type = "missing_in_pdf"
    }
    if (type == 'pdf') {
      obj.pdf_value = value
      obj.deviation_type = "missing_in_djp_api"
    }
    obj.field = key
    deviations.push(obj)
  }
  const status = deviations.length > 0 ? 'validated_with_deviation' : deviations.length == 0 ? 'validated_successfully' : 'error'
  return res.status(200).send({ status, message: 'Success comparing data', validation_results: { deviations, validated_data } })
})



router.use((err, req, res, next) => {
  console.error(err, '<== ini error apa?')
  return res.status(404).send({ status: 'error', error: '404 Not Found' });
});

app.listen(PORT, () => {
  console.log(`Application running on port ${PORT}`);
});
