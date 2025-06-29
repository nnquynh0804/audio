const fs = require('fs');
const { google } = require('googleapis');

const auth = new google.auth.GoogleAuth({
  keyFile: '/etc/secrets/credentials.json',
  scopes: ['https://www.googleapis.com/auth/drive.file'],
});

async function uploadFile(filePath, fileName) {
  const drive = google.drive({ version: 'v3', auth: await auth.getClient() });

  const fileMetadata = { name: fileName };
  const media = {
    mimeType: 'audio/wav',
    body: fs.createReadStream(filePath),
  };

  const file = await drive.files.create({
    resource: fileMetadata,
    media,
    fields: 'id',
  });

  await drive.permissions.create({
    fileId: file.data.id,
    requestBody: {
      type: 'anyone',
      role: 'reader',
    },
  });

  return `https://drive.google.com/uc?export=download&id=${file.data.id}`;
}

module.exports = { uploadFile };
