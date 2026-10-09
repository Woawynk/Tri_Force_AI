import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { generateItems } from './check_items.js';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zertfkpvzmtckgbmleql.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplcnRma3B2em10Y2tnYm1sZXFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwNzQ2NDQsImV4cCI6MjEwNjY1MDY0NH0.vCmXTwe6o2S4xPIMVtYqGmOGpjuL7RgI2chmzOXPSiY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export async function seedClothesItemsToSupabase(): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const items = generateItems();
    console.log(`Starting to seed ${items.length} items to Supabase table clothes_items...`);

    // Batch upsert in chunks of 50 to avoid payload limits
    const chunkSize = 50;
    let seededCount = 0;

    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      const { data, error } = await supabase
        .from('clothes_items')
        .upsert(chunk, { onConflict: 'id' });

      if (error) {
        console.error(`Error seeding chunk [${i} - ${i + chunk.length}]:`, error.message);
        return { success: false, count: seededCount, error: error.message };
      }
      seededCount += chunk.length;
      console.log(`Seeded chunk: ${seededCount}/${items.length} items`);
    }

    return { success: true, count: seededCount };
  } catch (err: any) {
    console.error('Fatal error during seed:', err);
    return { success: false, count: 0, error: err.message };
  }
}

// Run if called directly
if (process.argv[1]?.endsWith('seed_supabase.ts') || process.argv[1]?.endsWith('seed_supabase.js')) {
  seedClothesItemsToSupabase().then(res => {
    console.log('Seed result:', res);
    process.exit(res.success ? 0 : 1);
  });
}
