const express = require('express');
const puppeteer = require('puppeteer');
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
    browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath,
    });

    await page.goto('https://aistudio.google.com/generate-speech', {
      waitUntil: 'networkidle2',
    });

    await page.waitForSelector('textarea');
    await page.type('textarea', text, { delay: 30 });

    await page.waitForSelector('button[aria-label="Tạo giọng nói"]');
    await page.click('button[aria-label="Tạo giọng nói"]');

    await page.waitForSelector('button[aria-label="Tải xuống"]', { timeout: 15000 });
    await page.click('button[aria-label="Tải xuống"]');

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

    fs.unlinkSync(filePath); // Dọn file

  } catch (error) {
    console.error("❌ Lỗi:", error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (browser) await browser.close();
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server đang chạy tại http://localhost:${PORT}`);
});
