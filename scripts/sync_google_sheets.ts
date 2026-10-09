import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { syncGoogleSheetToSupabase } from '../src/services/googleSheetsSync.js';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zertfkpvzmtckgbmleql.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplcnRma3B2em10Y2tnYm1sZXFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwNzQ2NDQsImV4cCI6MjEwNjY1MDY0NH0.vCmXTwe6o2S4xPIMVtYqGmOGpjuL7RgI2chmzOXPSiY';
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID || '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms';

export async function runSyncGoogleSheetsToSupabase() {
  console.log('--- KHỞI TẠO ĐỒNG BỘ GOOGLE SHEETS ➔ SUPABASE ---');
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const result = await syncGoogleSheetToSupabase(supabase, {
    sheetId: GOOGLE_SHEET_ID,
    range: process.env.GOOGLE_SHEET_RANGE || 'Items!A1:Z',
  });

  if (result.success) {
    console.log(`✅ ${result.message}`);
    console.log(`📊 Đã đồng bộ: ${result.items_synced} vật phẩm (Direct Google Drive links: ${result.direct_drive_links_count})`);
  } else {
    console.error(`❌ Đồng bộ chưa thành công: ${result.message}`);
  }
}

if (process.argv[1]?.endsWith('sync_google_sheets.ts') || process.argv[1]?.endsWith('sync_google_sheets.js')) {
  runSyncGoogleSheetsToSupabase().then(() => {
    process.exit(0);
  }).catch((err) => {
    console.error('Lỗi thực thi:', err);
    process.exit(1);
  });
}
