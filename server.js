const express = require('express');
const puppeteer = require('puppeteer-core');
const chromium = require('chrome-aws-lambda');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { uploadFile } = require('./google-auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

app.post('/generate-speech', async (req, res) => {
  const text = req.body.text || "Xin chào từ AI Studio";
  const downloadPath = path.resolve(__dirname, 'downloads');
  fs.mkdirSync(downloadPath, { recursive: true });

  let browser;

  try {
    // 👇 Mở trình duyệt headless đúng cách
    const isProduction = process.env.AWS_EXECUTION_ENV === 'AWS_Lambda_nodejs18.x' || process.env.NODE_ENV === 'production';

const browser = await puppeteer.launch({
  args: chromium.args,
  defaultViewport: chromium.defaultViewport,
  executablePath: isProduction
    ? await chromium.executablePath
    : '/usr/bin/google-chrome', // hoặc chrome cài thủ công
  headless: chromium.headless,
});


    const page = await browser.newPage();

    // 👇 Cho phép tải xuống
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath,
    });

    // 👇 Điều hướng và thao tác trên trang
    await page.goto('https://aistudio.google.com/generate-speech', {
      waitUntil: 'networkidle2',
    });

    await page.waitForSelector('textarea');
    await page.type('textarea', text, { delay: 30 });

    await page.waitForSelector('button[aria-label="Tạo giọng nói"]');
    await page.click('button[aria-label="Tạo giọng nói"]');

    await page.waitForSelector('button[aria-label="Tải xuống"]', { timeout: 15000 });
    await page.click('button[aria-label="Tải xuống"]');

    // ⏱️ Chờ tải về
    await new Promise(resolve => setTimeout(resolve, 6000));

    const files = fs.readdirSync(downloadPath).filter(f => f.endsWith('.wav'));
    if (files.length === 0) {
      throw new Error("Không tìm thấy file âm thanh được tải xuống.");
    }

    const filePath = path.join(downloadPath, files[0]);
    const fileData = fs.readFileSync(filePath);
    const base64Audio = fileData.toString('base64');

    const driveUrl = await uploadFile(filePath, files[0]);

    res.json({
      success: true,
      audioBase64: base64Audio,
      filename: files[0],
      mimeType: "audio/wav",
      driveUrl,
    });

    // 👇 Dọn file nếu muốn
    fs.unlinkSync(filePath);

  } catch (error) {
    console.error('❌ Lỗi:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (browser) await browser.close();
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server đang chạy tại http://localhost:${PORT}`);
});
