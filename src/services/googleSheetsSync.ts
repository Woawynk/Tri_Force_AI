/**
 * DỰ ÁN: REMIX TRANG PHỤC TRUYỀN THỐNG VIỆT NAM
 * MODULE: GOOGLE SHEETS & GOOGLE DRIVE INTEGRATION SERVICE
 * Kiến trúc: Google Drive (Lưu ảnh) + Google Sheets (Quản lý Admin) + Supabase (Database vận hành)
 */

import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface ClothesItemRecord {
  id: string;
  name: string;
  category: 'skin' | 'pants' | 'accessory';
  gender?: string;
  colorFolder?: string;
  colorName?: string;
  image_filename: string;
  description?: string;
  suitable_events?: string[];
  recommended_colors?: string[];
  updated_at?: string;
}

export interface SyncResult {
  success: boolean;
  message: string;
  sheet_id: string;
  sheet_range: string;
  total_rows_found: number;
  items_synced: number;
  items_skipped: number;
  direct_drive_links_count: number;
  categories: {
    skin: number;
    pants: number;
    accessory: number;
  };
  sample_items?: Partial<ClothesItemRecord>[];
  errors?: string[];
  synced_at: string;
}

/**
 * 1. TRÍCH XUẤT FILE ID CỦA GOOGLE DRIVE TỪ MỌI ĐỊNH DẠNG ĐƯỜNG DẪN
 * Hỗ trợ:
 * - https://drive.google.com/file/d/{FILE_ID}/view?usp=sharing
 * - https://drive.google.com/open?id={FILE_ID}
 * - https://drive.google.com/uc?id={FILE_ID}&export=view
 * - https://drive.google.com/thumbnail?id={FILE_ID}
 * - https://lh3.googleusercontent.com/d/{FILE_ID}
 * - Chuỗi ID thô (25 đến 50 ký tự a-zA-Z0-9_-)
 */
export function extractGoogleDriveFileId(input: string): string | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();

  // 1. Dạng /file/d/{FILE_ID}/
  const fileDMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]{20,})/);
  if (fileDMatch && fileDMatch[1]) return fileDMatch[1];

  // 2. Dạng ?id={FILE_ID} hoặc &id={FILE_ID}
  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
  if (idParamMatch && idParamMatch[1]) return idParamMatch[1];

  // 3. Dạng lh3.googleusercontent.com/d/{FILE_ID}
  const lh3Match = trimmed.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]{20,})/);
  if (lh3Match && lh3Match[1]) return lh3Match[1];

  // 4. Dạng thumbnail?id={FILE_ID}
  const thumbMatch = trimmed.match(/thumbnail\?id=([a-zA-Z0-9_-]{20,})/);
  if (thumbMatch && thumbMatch[1]) return thumbMatch[1];

  // 5. Chuỗi ID thô (không có dấu gạch chéo '/')
  if (!trimmed.includes('/') && /^[a-zA-Z0-9_-]{25,50}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

/**
 * 2. CHUYỂN ĐỔI LIÊN KẾT GOOGLE DRIVE THÀNH DIRECT LINK HIỂN THỊ TRỰC TIẾP TRÊN FRONTEND
 * - Direct View Link: https://drive.google.com/uc?export=view&id={FILE_ID}
 * - Google User Content CDN: https://lh3.googleusercontent.com/d/{FILE_ID}
 */
export function toGoogleDriveDirectLink(
  input: string,
  preferredFormat: 'uc' | 'lh3' = 'lh3'
): { directUrl: string; isGoogleDrive: boolean; fileId: string | null } {
  if (!input) return { directUrl: '', isGoogleDrive: false, fileId: null };

  const fileId = extractGoogleDriveFileId(input);
  if (fileId) {
    const directUrl = preferredFormat === 'lh3'
      ? `https://lh3.googleusercontent.com/d/${fileId}`
      : `https://drive.google.com/uc?export=view&id=${fileId}`;

    return {
      directUrl,
      isGoogleDrive: true,
      fileId
    };
  }

  // Nếu là URL Supabase Storage hoặc đường dẫn local hợp lệ, giữ nguyên
  return {
    directUrl: input.trim(),
    isGoogleDrive: false,
    fileId: null
  };
}

/**
 * 3. KHỞI TẠO XÁC THỰC GOOGLE SERVICE ACCOUNT (GOOGLE AUTH)
 * Đọc theo thứ tự ưu tiên:
 * 1. Tham số custom credentials (nếu truyền trong request)
 * 2. Biến môi trường GOOGLE_SERVICE_ACCOUNT_KEY (JSON string)
 * 3. File credentials.json (tại root hoặc cấu hình qua GOOGLE_SERVICE_ACCOUNT_PATH)
 */
export function resolveServiceAccountCredentials(customKey?: any): any | null {
  if (customKey) {
    if (typeof customKey === 'object') return customKey;
    if (typeof customKey === 'string') {
      try {
        return JSON.parse(customKey);
      } catch (e) {
        console.warn('[Google Auth] Không thể parse customKey string:', e);
      }
    }
  }

  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    try {
      return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    } catch (e) {
      console.warn('[Google Auth] Không thể parse GOOGLE_SERVICE_ACCOUNT_KEY env:', e);
    }
  }

  const candidatePaths = [
    process.env.GOOGLE_SERVICE_ACCOUNT_PATH,
    path.resolve(process.cwd(), 'credentials.json'),
    path.resolve(process.cwd(), 'backend', 'credentials.json'),
  ].filter(Boolean) as string[];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, 'utf8');
        return JSON.parse(raw);
      } catch (e) {
        console.warn(`[Google Auth] Lỗi đọc file ${p}:`, e);
      }
    }
  }

  return null;
}

/**
 * Lấy Google Sheets Client
 */
export async function getGoogleSheetsClient(customCredentials?: any) {
  const credentials = resolveServiceAccountCredentials(customCredentials);

  if (credentials && credentials.client_email && credentials.private_key) {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key.replace(/\\n/g, '\n'),
      },
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets.readonly',
        'https://www.googleapis.com/auth/drive.readonly',
      ],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    return {
      sheets,
      authType: 'service_account',
      clientEmail: credentials.client_email,
      projectId: credentials.project_id || 'unknown'
    };
  }

  return {
    sheets: null,
    authType: 'none',
    clientEmail: null,
    projectId: null
  };
}

/**
 * 4. HÀM FALLBACK: ĐỌC DỮ LIỆU TỪ PUBLIC GOOGLE SHEET (NẾU CHƯA CÓ CREDENTIALS.JSON)
 * Hỗ trợ người dùng thử nghiệm nhanh bằng Google Sheet chia sẻ "Bất kỳ ai có liên kết đều xem được"
 */
async function fetchPublicSheetCsvRows(sheetId: string, sheetName: string = 'Items'): Promise<string[][]> {
  const encodedSheet = encodeURIComponent(sheetName);
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodedSheet}`;

  const res = await fetch(csvUrl);
  if (!res.ok) {
    // Thử tải tab mặc định không truyền tên sheet
    const fallbackUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;
    const fallbackRes = await fetch(fallbackUrl);
    if (!fallbackRes.ok) {
      throw new Error(`Không thể tải Google Sheet công khai (HTTP ${fallbackRes.status}). Vui lòng chia sẻ Sheet ở chế độ công khai hoặc cài đặt file credentials.json.`);
    }
    const text = await fallbackRes.text();
    return parseCsvToRows(text);
  }

  const text = await res.text();
  return parseCsvToRows(text);
}

/**
 * Trình phân tích cú pháp CSV chuẩn xử lý dấu ngoặc kép và dấu phẩy bên trong
 */
function parseCsvToRows(csvText: string): string[][] {
  const rows: string[][] = [];
  const lines = csvText.split(/\r?\n/);

  for (const line of lines) {
    if (!line.trim()) continue;
    const row: string[] = [];
    let insideQuote = false;
    let entry = '';

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (insideQuote && line[i + 1] === '"') {
          entry += '"';
          i++;
        } else {
          insideQuote = !insideQuote;
        }
      } else if (char === ',' && !insideQuote) {
        row.push(entry.trim());
        entry = '';
      } else {
        entry += char;
      }
    }
    row.push(entry.trim());
    rows.push(row);
  }

  return rows;
}

/**
 * 5. MAP HEADER VÀ PHÂN TÍCH DÒNG GOOGLE SHEETS THÀNH ĐỐI TƯỢNG CLOTHES ITEM
 */
export function normalizeColumnHeader(header: string): string {
  const clean = (header || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  if (/^(id|ma|ma_vat_pham|item_id)$/.test(clean)) return 'id';
  if (/^(name|ten|ten_vat_pham|ten_trang_phuc|title)$/.test(clean)) return 'name';
  if (/^(category|phan_loai|loai|the_loai|type)$/.test(clean)) return 'category';
  if (/^(gender|gioi_tinh|phai)$/.test(clean)) return 'gender';
  if (/^(colorfolder|color_folder|thu_muc_mau|tong_mau_goc|color_code)$/.test(clean)) return 'colorFolder';
  if (/^(colorname|color_name|ten_mau|sac_mau|color)$/.test(clean)) return 'colorName';
  if (/^(image_filename|image|link_anh|url_anh|anh|drive_url|hinh_anh|photo)$/.test(clean)) return 'image_filename';
  if (/^(description|mo_ta|chi_tiet|gioi_thieu|ghi_chu)$/.test(clean)) return 'description';
  if (/^(suitable_events|su_kien|boi_canh|su_kien_phu_hop|events)$/.test(clean)) return 'suitable_events';
  if (/^(recommended_colors|mau_phoi|mau_goi_y|mau_khuyen_nghi|colors)$/.test(clean)) return 'recommended_colors';

  return clean;
}

/**
 * 6. ĐỌC TOÀN BỘ DANH SÁCH TỪ GOOGLE SHEET VÀ CHUYỂN ĐỔI LINK ẢNH SANG DIRECT GOOGLE DRIVE LINK
 */
export async function readItemsFromGoogleSheet(options: {
  sheetId: string;
  range?: string;
  serviceAccountCredentials?: any;
}): Promise<{
  rows: ClothesItemRecord[];
  totalRawRows: number;
  authMethod: string;
  directLinksCount: number;
  errors: string[];
}> {
  const { sheetId, range = 'Items!A1:Z', serviceAccountCredentials } = options;
  const errors: string[] = [];
  let rawValues: any[][] = [];
  let authMethod = 'public_csv_fallback';

  const { sheets, authType, clientEmail } = await getGoogleSheetsClient(serviceAccountCredentials);

  if (sheets) {
    try {
      console.log(`[Google Sheets API] Đang kết nối bằng Service Account (${clientEmail})...`);
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range,
      });
      rawValues = response.data.values || [];
      authMethod = `service_account (${clientEmail})`;
      console.log(`[Google Sheets API] Đã đọc thành công ${rawValues.length} dòng từ Sheet!`);
    } catch (apiErr: any) {
      console.warn(`[Google Sheets API Warning] Lỗi Service Account: ${apiErr.message}. Thử chuyển sang public sheet...`);
      errors.push(`Google Sheets API Service Account error: ${apiErr.message}`);
    }
  }

  // Nếu Service Account chưa được cấp quyền vào Sheet, hoặc chưa có credentials.json, dùng fallback public
  if (rawValues.length === 0) {
    try {
      const sheetName = range.split('!')[0] || 'Items';
      rawValues = await fetchPublicSheetCsvRows(sheetId, sheetName);
      authMethod = 'public_web_export';
      console.log(`[Google Sheets Public] Đã đọc ${rawValues.length} dòng từ Google Sheet công khai.`);
    } catch (csvErr: any) {
      errors.push(`Public export error: ${csvErr.message}`);
    }
  }

  if (rawValues.length === 0) {
    throw new Error(
      `Không thể đọc dữ liệu từ Google Sheet (ID: ${sheetId}). ` +
      `Vui lòng kiểm tra: 1) File credentials.json có email đã được Share quyền Viewer trên Sheet, ` +
      `hoặc 2) Chia sẻ Google Sheet ở chế độ "Bất kỳ ai có liên kết đều xem được". Chi tiết: ${errors.join(' | ')}`
    );
  }

  // Dòng đầu tiên là tiêu đề cột
  const headerRow = rawValues[0].map((h: any) => String(h || ''));
  const headerMap: Record<number, string> = {};

  headerRow.forEach((colName, index) => {
    headerMap[index] = normalizeColumnHeader(colName);
  });

  const parsedItems: ClothesItemRecord[] = [];
  let directLinksCount = 0;

  for (let r = 1; r < rawValues.length; r++) {
    const row = rawValues[r];
    if (!row || row.length === 0) continue;

    const itemObj: Record<string, any> = {};
    row.forEach((val: any, colIdx: number) => {
      const fieldKey = headerMap[colIdx];
      if (fieldKey) {
        itemObj[fieldKey] = typeof val === 'string' ? val.trim() : val;
      }
    });

    if (!itemObj.id && !itemObj.name) {
      continue; // Bỏ qua dòng trống
    }

    // Chuẩn hóa Category chính xác cho 226 vật phẩm
    let category: 'skin' | 'pants' | 'accessory' = 'skin';
    const catRaw = String(itemObj.category || '').toLowerCase();
    const idRaw = String(itemObj.id || '').toLowerCase();
    const nameRaw = String(itemObj.name || '').toLowerCase();

    if (
      catRaw.includes('acc') || catRaw.includes('phu_kien') || catRaw.includes('trang_suc') ||
      catRaw.includes('phụ kiện') || catRaw.includes('trang sức') || catRaw.includes('mũ') ||
      catRaw.includes('nón') || catRaw.includes('khăn') || catRaw.includes('vòng') ||
      idRaw.startsWith('khan_') || idRaw.startsWith('non_') || idRaw.startsWith('man_') ||
      idRaw.startsWith('tram_') || idRaw.startsWith('kieng_') || idRaw.startsWith('khuyen_') ||
      idRaw.startsWith('hoa_tai_') || idRaw.startsWith('day_chuyen_') || idRaw.startsWith('vong_') ||
      idRaw.startsWith('lac_') || idRaw.startsWith('choker_') || idRaw.startsWith('quat_') ||
      idRaw.startsWith('bo_3_vong') || idRaw.startsWith('nhan_') ||
      nameRaw.includes('khăn') || nameRaw.includes('nón') || nameRaw.includes('mấn') ||
      nameRaw.includes('trâm') || nameRaw.includes('kiềng') || nameRaw.includes('khuyên') ||
      nameRaw.includes('hoa tai') || nameRaw.includes('dây chuyền') || nameRaw.includes('vòng') ||
      nameRaw.includes('lắc') || nameRaw.includes('choker') || nameRaw.includes('quạt') ||
      nameRaw.includes('nhẫn')
    ) {
      category = 'accessory';
    } else if (idRaw.startsWith('quanlai_') || nameRaw.includes('quan lại') || nameRaw.includes('mãng bào')) {
      category = 'skin';
    } else if (
      catRaw.includes('pant') || catRaw.includes('quan') || catRaw.includes('quần') ||
      idRaw.startsWith('quan_')
    ) {
      category = 'pants';
    }

    // Chuẩn hóa link ảnh sang Google Drive Direct Link (lh3 CDN)
    const rawImage = String(itemObj.image_filename || '');
    const { directUrl, isGoogleDrive } = toGoogleDriveDirectLink(rawImage, 'lh3');
    if (isGoogleDrive) {
      directLinksCount++;
    }

    // Tách mảng suitable_events & recommended_colors nếu là chuỗi phân tách bởi dấu phẩy
    const suitableEvents = Array.isArray(itemObj.suitable_events)
      ? itemObj.suitable_events
      : typeof itemObj.suitable_events === 'string' && itemObj.suitable_events.length > 0
        ? itemObj.suitable_events.split(/[,;]+/).map((s: string) => s.trim()).filter(Boolean)
        : [];

    const recommendedColors = Array.isArray(itemObj.recommended_colors)
      ? itemObj.recommended_colors
      : typeof itemObj.recommended_colors === 'string' && itemObj.recommended_colors.length > 0
        ? itemObj.recommended_colors.split(/[,;]+/).map((s: string) => s.trim()).filter(Boolean)
        : [];

    const finalItem: ClothesItemRecord = {
      id: String(itemObj.id || `item_${r}`),
      name: String(itemObj.name || `Vật phẩm ${r}`),
      category,
      gender: itemObj.gender || 'Chung',
      colorFolder: itemObj.colorFolder || '',
      colorName: itemObj.colorName || '',
      image_filename: directUrl || rawImage,
      description: itemObj.description || '',
      suitable_events: suitableEvents,
      recommended_colors: recommendedColors,
      updated_at: new Date().toISOString()
    };

    parsedItems.push(finalItem);
  }

  return {
    rows: parsedItems,
    totalRawRows: rawValues.length - 1,
    authMethod,
    directLinksCount,
    errors
  };
}

/**
 * 7. ĐỒNG BỘ (UPSERT) DỮ LIỆU TỪ GOOGLE SHEETS VÀO SUPABASE
 */
export async function syncGoogleSheetToSupabase(
  supabase: SupabaseClient,
  options: {
    sheetId: string;
    range?: string;
    serviceAccountCredentials?: any;
    chunkSize?: number;
    dryRun?: boolean;
  }
): Promise<SyncResult> {
  const {
    sheetId,
    range = 'Items!A1:Z',
    serviceAccountCredentials,
    chunkSize = 50,
    dryRun = false
  } = options;

  console.log(`[Google Sheets Sync] Bắt đầu đồng bộ từ Sheet ID: ${sheetId}, range: ${range}...`);

  const { rows, totalRawRows, authMethod, directLinksCount, errors } = await readItemsFromGoogleSheet({
    sheetId,
    range,
    serviceAccountCredentials
  });

  const categories = {
    skin: 0,
    pants: 0,
    accessory: 0
  };

  rows.forEach(item => {
    if (item.category === 'skin') categories.skin++;
    else if (item.category === 'pants') categories.pants++;
    else if (item.category === 'accessory') categories.accessory++;
  });

  if (dryRun) {
    return {
      success: true,
      message: `[DRY-RUN] Đã đọc thành công ${rows.length} vật phẩm từ Google Sheet (chưa ghi vào Supabase).`,
      sheet_id: sheetId,
      sheet_range: range,
      total_rows_found: totalRawRows,
      items_synced: rows.length,
      items_skipped: totalRawRows - rows.length,
      direct_drive_links_count: directLinksCount,
      categories,
      sample_items: rows.slice(0, 5),
      synced_at: new Date().toISOString(),
      errors: errors.length > 0 ? errors : undefined
    };
  }

  // Tiến hành Upsert vào bảng clothes_items trên Supabase theo từng đợt
  let itemsSynced = 0;
  const syncErrors: string[] = [...errors];

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase
      .from('clothes_items')
      .upsert(chunk, { onConflict: 'id' });

    if (error) {
      const errMsg = `Lỗi upsert tại chunk ${i + 1}-${i + chunk.length}: ${error.message}`;
      console.error(`[Google Sheets Sync Error]`, errMsg);
      syncErrors.push(errMsg);
    } else {
      itemsSynced += chunk.length;
    }
  }

  const isSuccess = itemsSynced > 0;
  const message = isSuccess
    ? `Đồng bộ thành công ${itemsSynced}/${rows.length} vật phẩm từ Google Sheet lên Supabase (Phương thức xác thực: ${authMethod})!`
    : `Không thể đồng bộ vào bảng Supabase. Lỗi: ${syncErrors.join(' | ')}`;

  return {
    success: isSuccess,
    message,
    sheet_id: sheetId,
    sheet_range: range,
    total_rows_found: totalRawRows,
    items_synced: itemsSynced,
    items_skipped: rows.length - itemsSynced,
    direct_drive_links_count: directLinksCount,
    categories,
    sample_items: rows.slice(0, 5),
    errors: syncErrors.length > 0 ? syncErrors : undefined,
    synced_at: new Date().toISOString()
  };
}

/**
 * 8. TẠO DỮ LIỆU MẪU ĐỂ XUẤT RA GOOGLE SHEET CHO QUẢN TRỊ VIÊN
 * Xuất 226 items hiện tại ra mảng 2 chiều để người dùng copy ngay vào Google Sheet
 */
export function generateGoogleSheetTemplateData(items: ClothesItemRecord[]): string[][] {
  const headers = [
    'id',
    'name',
    'category',
    'gender',
    'colorFolder',
    'colorName',
    'image_filename',
    'description',
    'suitable_events',
    'recommended_colors'
  ];

  const dataRows = items.map(item => [
    item.id,
    item.name,
    item.category,
    item.gender || 'Chung',
    item.colorFolder || '',
    item.colorName || '',
    item.image_filename,
    item.description || '',
    (item.suitable_events || []).join(', '),
    (item.recommended_colors || []).join(', ')
  ]);

  return [headers, ...dataRows];
}
