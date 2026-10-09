import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateItems } from './check_items.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const items = generateItems();

function escapeSql(str: string | null | undefined): string {
  if (str === null || str === undefined) return 'NULL';
  return `'${str.replace(/'/g, "''")}'`;
}

function escapeSqlArray(arr: string[] | undefined): string {
  if (!arr || arr.length === 0) return "'{}'::text[]";
  const elements = arr.map(el => `"${el.replace(/"/g, '\\"')}"`).join(',');
  return `'${elements}'::text[]`;
}

let sql = `-- ==============================================================================
-- DỰ ÁN: REMIX TRANG PHỤC TRUYỀN THỐNG VIỆT NAM
-- HỆ CƠ SỞ DỮ LIỆU POSTGRESQL TRÊN SUPABASE
-- TỔNG SỐ VẬT PHẨM: 226 (200 Trang phục cổ phong, 6 Quần, 20 Phụ kiện)
-- Hướng dẫn: Copy toàn bộ nội dung file này và dán vào Supabase SQL Editor -> bấm RUN
-- ==============================================================================

-- 1. Bật extension mở rộng cần thiết
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TẠO BẢNG clothes_items
CREATE TABLE IF NOT EXISTS public.clothes_items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('skin', 'pants', 'accessory')),
    gender TEXT DEFAULT 'Chung',
    "colorFolder" TEXT,
    "colorName" TEXT,
    image_filename TEXT NOT NULL,
    description TEXT,
    suitable_events TEXT[] DEFAULT '{}'::text[],
    recommended_colors TEXT[] DEFAULT '{}'::text[],
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. TẠO CÁC CHỈ MỤC TỐI ƯU HIỆU NĂNG TÌM KIẾM
CREATE INDEX IF NOT EXISTS idx_clothes_items_category ON public.clothes_items(category);
CREATE INDEX IF NOT EXISTS idx_clothes_items_gender ON public.clothes_items(gender);
CREATE INDEX IF NOT EXISTS idx_clothes_items_color_folder ON public.clothes_items("colorFolder");

-- 4. CẤU HÌNH ROW LEVEL SECURITY (RLS)
ALTER TABLE public.clothes_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Cho phép đọc công khai danh mục trang phục" ON public.clothes_items;
CREATE POLICY "Cho phép đọc công khai danh mục trang phục" 
ON public.clothes_items 
FOR SELECT 
TO public 
USING (true);

DROP POLICY IF EXISTS "Cho phép chèn và cập nhật trang phục" ON public.clothes_items;
CREATE POLICY "Cho phép chèn và cập nhật trang phục" 
ON public.clothes_items 
FOR ALL 
TO public 
USING (true) 
WITH CHECK (true);

-- 5. TẠO BẢNG LƯU TRỮ LỊCH SỬ REMIX & ẢNH NGƯỜI DÙNG (saved_remixes)
CREATE TABLE IF NOT EXISTS public.saved_remixes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    public_url TEXT NOT NULL,
    skin_id TEXT,
    pants_id TEXT,
    accessory_ids TEXT[] DEFAULT '{}'::text[],
    main_color TEXT,
    event TEXT,
    match_score NUMERIC(5, 2),
    matching_analysis TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.saved_remixes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Cho phép đọc công khai saved remixes" ON public.saved_remixes;
CREATE POLICY "Cho phép đọc công khai saved remixes" 
ON public.saved_remixes 
FOR SELECT 
TO public 
USING (true);

DROP POLICY IF EXISTS "Cho phép thêm saved remixes" ON public.saved_remixes;
CREATE POLICY "Cho phép thêm saved remixes" 
ON public.saved_remixes 
FOR INSERT 
TO public 
WITH CHECK (true);

-- 6. TẠO BUCKET STORAGE "images" VÀ PHÂN QUYỀN TRUY CẬP CÔNG KHAI
INSERT INTO storage.buckets (id, name, public) 
VALUES ('images', 'images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public Read images bucket" ON storage.objects;
CREATE POLICY "Public Read images bucket" ON storage.objects
FOR SELECT TO public USING (bucket_id = 'images');

DROP POLICY IF EXISTS "Public Upload images bucket" ON storage.objects;
CREATE POLICY "Public Upload images bucket" ON storage.objects
FOR INSERT TO public WITH CHECK (bucket_id = 'images');

DROP POLICY IF EXISTS "Public Update images bucket" ON storage.objects;
CREATE POLICY "Public Update images bucket" ON storage.objects
FOR UPDATE TO public USING (bucket_id = 'images');

-- 7. CHÈN 226 VẬT PHẨM TRUYỀN THỐNG VÀO BẢNG clothes_items
INSERT INTO public.clothes_items (
    id, name, category, gender, "colorFolder", "colorName", image_filename, description, suitable_events, recommended_colors
) VALUES
`;

const rows = items.map(item => {
  return `(${escapeSql(item.id)}, ${escapeSql(item.name)}, ${escapeSql(item.category)}, ${escapeSql(item.gender)}, ${escapeSql(item.colorFolder)}, ${escapeSql(item.colorName)}, ${escapeSql(item.image_filename)}, ${escapeSql(item.description)}, ${escapeSqlArray(item.suitable_events)}, ${escapeSqlArray(item.recommended_colors)})`;
});

sql += rows.join(',\n') + '\n';
sql += `ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    gender = EXCLUDED.gender,
    "colorFolder" = EXCLUDED."colorFolder",
    "colorName" = EXCLUDED."colorName",
    image_filename = EXCLUDED.image_filename,
    description = EXCLUDED.description,
    suitable_events = EXCLUDED.suitable_events,
    recommended_colors = EXCLUDED.recommended_colors,
    updated_at = TIMEZONE('utc'::text, NOW());
`;

const outPath = path.resolve(__dirname, '..', 'database', 'supabase_schema.sql');
fs.writeFileSync(outPath, sql, 'utf8');
const backendOutPath = path.resolve(__dirname, '..', 'backend', 'database', 'supabase_schema.sql');
if (fs.existsSync(path.dirname(backendOutPath))) {
  fs.writeFileSync(backendOutPath, sql, 'utf8');
}
console.log(`Generated ${outPath} with ${items.length} items. File size: ${fs.statSync(outPath).size} bytes`);
