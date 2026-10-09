const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const path = require('path');

const ai = new GoogleGenAI({});
const base = 'src/assets/images/system/Colors';

async function audit() {
  const categories = {};
  fs.readdirSync(base).forEach(c => {
    ['Nam', 'Nu'].forEach(g => {
      const dir = path.join(base, c, g);
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.jpg'));
        files.forEach(f => {
          const prefix = f.split('_')[0];
          const key = `${g}_${prefix}`;
          if (!categories[key]) {
            categories[key] = path.join(dir, f);
          }
        });
      }
    });
  });

  console.log('Auditing 20 costume categories across Nam and Nu:');
  for (const [key, filePath] of Object.entries(categories)) {
    const base64 = fs.readFileSync(filePath).toString('base64');
    try {
      const res = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { text: 'Analyze this product photo. Is there any human person, human face, human head, human skin, human arms/legs, or human model visible in this image? Answer in JSON format: {"has_human": boolean, "lookbook_flatlay": boolean, "notes": string}' },
              { inlineData: { mimeType: 'image/jpeg', data: base64 } }
            ]
          }
        ]
      });
      const text = res.text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(text);
      console.log(key.padEnd(16), '-> has_human:', parsed.has_human, '| flatlay:', parsed.lookbook_flatlay, '|', parsed.notes);
    } catch (e) {
      console.error(key, 'Error:', e.message);
    }
  }
}

audit();
