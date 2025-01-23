__path = process.cwd()
const fs = require('fs');
const express = require('express');
const axios = require('axios');
const FormData = require('form-data'); 
const QRCode = require('qrcode');
const cors = require('cors');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
app.enable("trust proxy");
app.set("json spaces", 2);

// Middleware untuk CORS
app.use(cors());

const gptt355turbo = {
  send: async (message, model = "gpt-3.5-turbo") => {
    try {
      const validModels = ["gpt-3.5-turbo", "gpt-3.5-turbo-0125", "gpt-4o-mini", "gpt-4o"];
      if (!validModels.includes(model)) {
        throw new Error(`Model tidak valid! Pilih salah satu: ${validModels.join(', ')}`);
      }

      const payload = {
        messages: [{ role: "user", content: message }],
        model: model
      };

      const response = await axios.post("https://mpzxsmlptc4kfw5qw2h6nat6iu0hvxiw.lambda-url.us-east-2.on.aws/process", payload, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Postify/1.0.0'
        }
      });

      // Ekstrak hanya konten teks dari respons API
      return response.data.choices[0].message.content;
    } catch (error) {
      console.error("Terjadi kesalahan saat mengirim pesan:", error.message);
      throw new Error('Tidak dapat memproses permintaan chatbot.');
    }
  }
};
function convertCRC16(str) {
    let crc = 0xFFFF;
    const strlen = str.length;

    for (let c = 0; c < strlen; c++) {
        crc ^= str.charCodeAt(c) << 8;

        for (let i = 0; i < 8; i++) {
            if (crc & 0x8000) {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc = crc << 1;
            }
        }
    }

    let hex = crc & 0xFFFF;
    hex = ("000" + hex.toString(16).toUpperCase()).slice(-4);

    return hex;
}

function generateTransactionId() {
    const randomPart = Math.random().toString(36).substring(2, 10).toUpperCase();  // Membuat string acak 8 karakter (huruf besar + angka)
    return 'QR-' + randomPart;  // Gabungkan dengan 'AbiDev' di depan
}

function generateExpirationTime() {
    const expirationTime = new Date();
    expirationTime.setMinutes(expirationTime.getMinutes() + 5);
    return expirationTime;
}

function saveTempFile(buffer) {
  const tempFilePath = path.join(__dirname, `temp_${Date.now()}.png`);
  fs.writeFileSync(tempFilePath, buffer);
  return tempFilePath;
}

async function uploadToCatBox(filePath) {
  const data = new FormData();
  data.append('reqtype', 'fileupload');
  data.append('userhash', ''); // Isi userhash jika diperlukan
  data.append('fileToUpload', fs.createReadStream(filePath));

  const config = {
    method: 'POST',
    url: 'https://catbox.moe/user/api.php',
    headers: {
      ...data.getHeaders(),
      'User-Agent': 'Mozilla/5.0 (Android 10; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0',
    },
    data: data,
  };

  const response = await axios.request(config);
  return response.data; 
}

async function createQRIS(amount, codeqr) {
  try {
    let qrisData = codeqr;

    qrisData = qrisData.slice(0, -4);
    const step1 = qrisData.replace("010211", "010212");
    const step2 = step1.split("5802ID");

    amount = amount.toString();
    let uang = "54" + ("0" + amount.length).slice(-2) + amount;
    uang += "5802ID";

    const result = step2[0] + uang + step2[1] + convertCRC16(step2[0] + uang + step2[1]);
    const buffer = await QRCode.toBuffer(result);
    const filePath = saveTempFile(buffer);
    const uploadedFile = await uploadToCatBox(filePath);
    fs.unlinkSync(filePath);
    return {
      transactionId: generateTransactionId(),
      amount: amount,
      expirationTime: generateExpirationTime(),
      qrImageUrl: uploadedFile,
    };
  } catch (error) {
    console.error('Error generating and uploading QR code:', error);
    throw error;
  }
}
app.get('/', (req, res) => {
	res.sendFile(__path + '/public/index.html');
});
app.get('/api/orkut/createpayment', async (req, res) => {
    const { amount } = req.query;
    if (!amount) {
    return res.json("Isi Parameter Amount.");
    }
    const { codeqr } = req.query;
    if (!codeqr) {
    return res.json("Isi Parameter CodeQr menggunakan qris code kalian.");
    }
    try {
        const qrData = await createQRIS(amount, codeqr);
        res.json({ status: true, creator: "Rioo?", result: qrData });        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/orkut/cekstatus', async (req, res) => {
    const { merchant, keyorkut } = req.query;
        if (!merchant) {
        return res.json({ error: "Isi Parameter Merchant." });
    }
    if (!keyorkut) {
        return res.json({ error: "Isi Parameter Token menggunakan token kalian." });
    }
    try {
        const apiUrl = `https://www.gateway.okeconnect.com/api/mutasi/qris/${merchant}/${keyorkut}`;
        const response = await axios.get(apiUrl);
        const result = response.data;

        const latestTransaction = result.data && result.data.length > 0 ? result.data[0] : null;
                if (latestTransaction) {
            res.json(latestTransaction);
        } else {
            res.json({ message: "No transactions found." });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.get('/api/gptturbo', async (req, res) => {
  try {
    const query = req.query.message;
    if (!query) {
      return res.status(400).json({ error: 'Parameter "text" tidak ditemukan' });
    }
    const response = await gptt355turbo.send(query);
    res.status(200).json({
      status: 200,
      creator: "RiooXdzz",
      data: { response }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Handle 404 error
app.use(function (req, res, next) {
	next(createError(404))
  })

// Handle error
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Jalankan server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
module.exports = app