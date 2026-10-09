import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { createClient } from '@supabase/supabase-js';
import {
  toGoogleDriveDirectLink,
  extractGoogleDriveFileId,
  readItemsFromGoogleSheet,
  syncGoogleSheetToSupabase,
  generateGoogleSheetTemplateData,
  resolveServiceAccountCredentials,
  type ClothesItemRecord
} from './src/services/googleSheetsSync.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Phòng chống crash hoặc treo process khi có Unhandled Rejection
process.on('unhandledRejection', (reason, promise) => {
  console.warn('[Process Warning] Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[Process Error] Uncaught Exception:', err);
});

// Helper: Bọc Promise/Thenable với Timeout để chống treo request bất đồng bộ
function withTimeout<T>(promise: PromiseLike<T> | Promise<T>, ms: number = 4000, errorMsg: string = 'Thao tác quá thời gian'): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(errorMsg)), ms))
  ]);
}

const app = express();
const PORT = 3000;
const isDev = process.env.NODE_ENV !== 'production';

// Hỗ trợ reverse proxy (Cloud Run, Nginx, Vercel) để nhận diện đúng giao thức HTTPS và Client IP
app.set('trust proxy', true);

// Chống treo request: Thiết lập timeout 15s cho mọi kết nối
app.use((req, res, next) => {
  res.setTimeout(15000, () => {
    if (!res.headersSent) {
      res.status(504).json({ success: false, message: 'Request Timeout (15s)' });
    }
  });
  next();
});

// Cấu hình CORS toàn diện cho Frontend (hỗ trợ Vercel, localhost, mọi domain gọi vào mà không bị chặn)
app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  credentials: true,
}));

// Cho phép xử lý JSON payload lớn và bắt lỗi cú pháp Malformed JSON
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof SyntaxError && 'status' in err && (err as any).status === 400) {
    return res.status(400).json({ success: false, message: 'Dữ liệu JSON không hợp lệ (Malformed JSON)', error: err.message });
  }
  next(err);
});

// Cấu hình kết nối Supabase Cloud Database & Storage
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zertfkpvzmtckgbmleql.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplcnRma3B2em10Y2tnYm1sZXFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwNzQ2NDQsImV4cCI6MjEwNjY1MDY0NH0.vCmXTwe6o2S4xPIMVtYqGmOGpjuL7RgI2chmzOXPSiY';
const SUPABASE_BUCKET = 'images';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Helper: Tải buffer ảnh trực tiếp lên Supabase Storage bucket 'images' và lấy Public URL cố định
async function uploadToSupabaseImagesBucket(
  storagePath: string,
  buffer: Buffer,
  contentType: string = 'image/jpeg'
): Promise<{ publicUrl: string | null; error?: string }> {
  try {
    const { data, error } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .upload(storagePath, buffer, {
        contentType,
        upsert: true
      });

    if (error) {
      console.warn(`[Supabase Storage Warning] Không thể upload tới ${storagePath}: ${error.message}`);
      return { publicUrl: null, error: error.message };
    }

    const { data: urlData } = supabase.storage
      .from(SUPABASE_BUCKET)
      .getPublicUrl(storagePath);

    console.log(`[Supabase Storage Success] File uploaded: ${urlData.publicUrl}`);
    return { publicUrl: urlData.publicUrl };
  } catch (err: any) {
    console.warn(`[Supabase Storage Exception]:`, err.message);
    return { publicUrl: null, error: err.message };
  }
}

// Định nghĩa các đường dẫn tài nguyên theo đúng chuẩn Clean Architecture
const FRONTEND_DIR = path.resolve(__dirname, 'frontend');
const PUBLIC_DIR = path.resolve(FRONTEND_DIR, 'public');
const ASSETS_DIR = path.resolve(PUBLIC_DIR, 'assets');
const BASE_ASSETS = ASSETS_DIR;
const CLOTHES_INFO_FILE = path.resolve(ASSETS_DIR, 'jsons', 'clothes_info.json');
const SUPABASE_STORAGE_URL = 'https://zertfkpvzmtckgbmleql.supabase.co/storage/v1/object/public/images';

const TEMP_DIR = path.resolve(__dirname, 'dist', 'temp');
const USER_DIR = path.resolve(__dirname, 'dist', 'user');
const CLOTHES_DIR = path.resolve(ASSETS_DIR, 'images', 'system', 'clothes');
const COLORS_DIR = path.resolve(ASSETS_DIR, 'images', 'system', 'Colors');
const PANTS_DIR = path.resolve(ASSETS_DIR, 'images', 'system', 'Pants');
const ACCESSORIES_DIR = path.resolve(ASSETS_DIR, 'images', 'system', 'Accessories');

[TEMP_DIR, USER_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const COLOR_NAMES = [
  'XichKim',
  'BichThuy',
  'HuyenChu',
  'ThanhLam',
  'HoangYen',
  'BachNgoc',
  'TuKhi',
  'PhiThuy',
  'ThoHoang',
  'LienHoa',
];

// Middleware chuyển hướng thông minh cho các ảnh thuộc mục system/ nếu không tồn tại cục bộ sang Supabase Storage Cloud
app.use('/assets', (req, res, next) => {
  if (req.path.startsWith('/images/system/')) {
    const localPath = path.join(ASSETS_DIR, req.path);
    if (!fs.existsSync(localPath)) {
      const storagePath = req.path.replace(/^\/images\/system\//, 'system/');
      const supabaseUrl = `https://zertfkpvzmtckgbmleql.supabase.co/storage/v1/object/public/images/${storagePath}`;
      return res.redirect(supabaseUrl);
    }
  }
  next();
});

// Phục vụ static assets cho Frontend
app.use('/assets', express.static(ASSETS_DIR, { maxAge: '1d', dotfiles: 'ignore' }));
app.use(express.static(PUBLIC_DIR, { dotfiles: 'ignore' }));

// Hàm bảo mật: Khử độc tên file chống Path Traversal
function sanitizeFilename(filename: string): string {
  const base = path.basename(filename);
  const clean = base.replace(/[^a-zA-Z0-9_\-\.]/g, '');
  if (!clean || clean.startsWith('.')) {
    throw new Error('Tên file không hợp lệ hoặc không an toàn');
  }
  return clean;
}

// Helper: Chuẩn hóa URL ảnh sang định dạng Direct Link Google Drive (lh3 CDN) hoặc /assets/...
function toAssetUrl(filePathOrRel: string): string {
  if (!filePathOrRel) return '';
  const trimmed = filePathOrRel.trim();

  // Nếu là liên kết ngoài (Google Drive, Supabase Storage, CDN)
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    const { directUrl } = toGoogleDriveDirectLink(trimmed, 'lh3');
    return directUrl;
  }

  // Nếu là ID thô của Google Drive (25-50 ký tự không chứa '/')
  const driveId = extractGoogleDriveFileId(trimmed);
  if (driveId && !trimmed.includes('/') && !trimmed.includes('.')) {
    return `https://lh3.googleusercontent.com/d/${driveId}`;
  }

  let clean = trimmed.replace(/\\/g, '/');
  if (clean.includes('src/assets')) {
    clean = clean.substring(clean.indexOf('src/assets') + 4); // leaves /assets/...
  }
  if (!clean.startsWith('/')) {
    clean = '/' + clean;
  }
  return clean;
}

// Chuẩn hóa Category chuẩn mực cho 226 items (Áo: 200, Quần: 6, Phụ kiện: 20)
function normalizeItemCategory(item: any): 'skin' | 'pants' | 'accessory' {
  const catRaw = String(item.category || '').toLowerCase().trim();
  const idRaw = String(item.id || '').toLowerCase().trim();
  const nameRaw = String(item.name || '').toLowerCase().trim();

  // 1. Phụ kiện & trang sức & mũ nón
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
    return 'accessory';
  }

  // 2. Áo Quan Lại / Mãng Bào (phẩm phục áo cung đình, không phải quần)
  if (idRaw.startsWith('quanlai_') || nameRaw.includes('quan lại') || nameRaw.includes('mãng bào')) {
    return 'skin';
  }

  // 3. Quần truyền thống
  if (
    catRaw.includes('pant') || catRaw.includes('quan') || catRaw.includes('quần') ||
    idRaw.startsWith('quan_')
  ) {
    return 'pants';
  }

  return 'skin';
}

// Helper: Đọc tất cả file ảnh JPG dưới thư mục hệ thống
function getAllJpgImages(dir: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    if (file.startsWith('.')) return;
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllJpgImages(filePath));
    } else if (file.toLowerCase().endsWith('.jpg') || file.toLowerCase().endsWith('.jpeg')) {
      const rel = path.relative(path.resolve(__dirname), filePath).replace(/\\/g, '/');
      results.push(toAssetUrl('/' + rel));
    }
  });
  return results;
}

const COLOR_TITLE_MAP: Record<string, string> = {
  'XichKim': 'Xích Kim',
  'BichThuy': 'Bích Thủy',
  'HuyenChu': 'Huyền Chu',
  'ThanhLam': 'Thanh Lam',
  'HoangYen': 'Hoàng Yến',
  'BachNgoc': 'Bạch Ngọc',
  'TuKhi': 'Tử Khí',
  'PhiThuy': 'Phi Thủy',
  'ThoHoang': 'Thổ Hoàng',
  'LienHoa': 'Liên Hoa'
};

const OUTFIT_NAME_MAP: Record<string, string> = {
  'aodai': 'Áo Dài',
  'aotac': 'Áo Tấc Ngũ Thân',
  'baba': 'Áo Bà Ba',
  'aobaba': 'Áo Bà Ba',
  'cham': 'Trang Phục Chăm',
  'giaolinh': 'Áo Giao Lĩnh',
  'mong': 'Trang Phục H\'Mông',
  'hmong': 'Trang Phục H\'Mông',
  'nguthan': 'Áo Ngũ Thân',
  'quanlai': 'Trang Phục Quan Lại',
  'taynguyen': 'Trang Phục Tây Nguyên',
  'tuthan': 'Áo Cánh Nam Cổ Truyền',
  'aocom': 'Áo Cắm',
  'aonamthan': 'Áo Năm Thân',
  'daotien': 'Trang Phục Dao Tiền',
  'nhatbinh': 'Áo Nhật Bình'
};

// Bảng từ điển tên Quần có dấu tiếng Việt chuẩn mực
const PANTS_METADATA_MAP: Record<string, { name: string; description: string }> = {
  'quan_dui_nam_3': {
    name: 'Quần Đũi Nam Cổ Truyền',
    description: 'Chất liệu vải đũi mộc tự nhiên, thoáng mát, dáng suông truyền thống dành cho nam giới.'
  },
  'quan_linh_nu_4': {
    name: 'Quần Lĩnh Nữ Đen Óng',
    description: 'Chất liệu lụa lĩnh Bưởi màu đen tuyền bóng nhẹ, dệt thủ công quý phái cho nữ giới.'
  },
  'quan_moga_nu_6': {
    name: 'Quần Mỡ Gà Nữ Thướt Tha',
    description: 'Tông màu vàng mỡ gà ấm áp, chất lụa mềm mại tôn lên vẻ thướt tha của thiếu nữ.'
  },
  'quan_phi_nu_5': {
    name: 'Quần Phi Bóng Nữ Cung Đình',
    description: 'Vải phi bóng cao cấp ánh ngọc, thường dùng trong trang phục dạ yến chốn cung đình.'
  },
  'quan_so_nam_1': {
    name: 'Quần Sa Trắng Nam Nhã Nhặn',
    description: 'Vải sa dệt mỏng nhẹ sắc trắng tinh khôi, tạo dáng vẻ nho nhã, thanh cao của bậc nho sĩ.'
  },
  'quan_trang_nam_2': {
    name: 'Quần Lụa Trắng Nam Cổ Phong',
    description: 'Lụa tơ tằm trắng ngà mềm mại, chuẩn mực phối cùng các dáng áo dài ngũ thân và áo tấc.'
  }
};

// Bảng từ điển tên Phụ Kiện có dấu tiếng Việt chuẩn mực
const ACCESSORY_METADATA_MAP: Record<string, { name: string; description: string }> = {
  'bo_3_vong_ximen_vang_19': {
    name: 'Bộ 3 Vòng Ximen Vàng Cát Tường',
    description: 'Bộ vòng tay ximen vàng chạm khắc tinh xảo, biểu trưng cho sự sung túc và may mắn.'
  },
  'choker_lua_den_15': {
    name: 'Kiềng Dải Lụa Đen Cổ Điển',
    description: 'Dải lụa đen mềm ôm sát cổ kết hợp mặt ngọc cổ truyền, điểm xuyết nét kiêu sa.'
  },
  'day_chuyen_ngoc_boi_rong_13': {
    name: 'Dây Chuyền Ngọc Bội Chạm Rồng',
    description: 'Mặt ngọc bích chạm hình rồng uy nghi, dây tết thủ công biểu thị phẩm cấp quyền quý.'
  },
  'hoa_tai_ngoc_trai_7': {
    name: 'Hoa Tai Ngọc Trai Quý Phái',
    description: 'Ngọc trai nước ngọt trắng sáng tự nhiên, mang nét thanh lịch, đài các.'
  },
  'hoa_tai_tua_rua_do_9': {
    name: 'Hoa Tai Tua Rua Đỏ Cung Đình',
    description: 'Sợi chỉ tơ đỏ thắm kết tua rua buông rủ, tạo điểm nhấn rạng ngời và may mắn.'
  },
  'khan_dong_chu_nhan_nam_2': {
    name: 'Khăn Đóng Chữ Nhan Nam Quý Tộc',
    description: 'Khăn đóng xếp nếp chữ Nhan chỉnh tề, biểu tượng cho phong thái chững chạc của nam tử.'
  },
  'khuyen_tai_cam_thach_10': {
    name: 'Khuyên Tai Cẩm Thạch Hoàng Cung',
    description: 'Ngọc cẩm thạch xanh ngọc bích mài nhẵn, toát lên nét quyền quý và trường thọ.'
  },
  'khuyen_tai_hoa_sen_6': {
    name: 'Khuyên Tai Hoa Sen Bạc Tinh Xảo',
    description: 'Bạc ta đúc hình cánh hoa sen thanh khiết, biểu tượng quốc hoa Việt Nam.'
  },
  'khuyen_tai_trong_dong_8': {
    name: 'Khuyên Tai Họa Tiết Trống Đồng',
    description: 'Họa tiết chim Lạc và mặt trời Đông Sơn đúc nổi bằng đồng cổ tinh xảo.'
  },
  'kieng_co_bac_tron_11': {
    name: 'Kiềng Cổ Bạc Tròn Cổ Truyền',
    description: 'Kiềng bạc trơn uốn cong thanh thoát, phụ kiện không thể thiếu của phụ nữ Việt xưa.'
  },
  'lac_tay_bac_xa_cu_17': {
    name: 'Lắc Tay Bạc Khảm Xà Cừ',
    description: 'Bạc chạm hoa văn cổ khảm vỏ xà cừ óng ánh ngũ sắc tinh vi.'
  },
  'man_xep_lua_nu_1': {
    name: 'Mấn Xếp Lụa Nữ Quý Phái',
    description: 'Mấn quấn bằng lụa tơ tằm nhiều tầng tỉ mỉ, tôn lên nét duyên dáng của người phụ nữ.'
  },
  'nhan_ngoc_boc_bac_20': {
    name: 'Nhẫn Ngọc Bích Bọc Bạc Tinh Xảo',
    description: 'Mặt ngọc tự nhiên vân biếc bọc viền bạc chạm hoa văn kỷ hà.'
  },
  'non_la_bai_tho_3': {
    name: 'Nón Lá Dây Ngắn Cờ Đỏ Việt Nam',
    description: 'Nón lá truyền thống với dây quai ngắn gọn gàng, bề mặt mang sắc đỏ rực rỡ của lá cờ Việt Nam điểm xuyết ngôi sao vàng và hoa văn cổ truyền.'
  },
  'non_quai_thao_5': {
    name: 'Nón Quai Thao Quan Họ Kinh Bắc',
    description: 'Nón ba tầm quai thao dệt tơ tằm buông rủ, đậm đà văn hóa dân ca Quan họ.'
  },
  'tram_phuong_hoang_4': {
    name: 'Trâm Cài Tóc Phượng Hoàng Mạ Vàng',
    description: 'Trâm cài tóc tạo hình chim phụng ngậm chuỗi ngọc mạ vàng rực rỡ chốn hoàng cung.'
  },
  'vong_co_ngoc_trai_12': {
    name: 'Vòng Cổ Ngọc Trai Hoàng Gia',
    description: 'Chuỗi hạt ngọc trai tròn đều lấp lánh, biểu trưng cho sự viên mãn và vương giả.'
  },
  'vong_co_tram_huong_14': {
    name: 'Vòng Cổ Trầm Hương Vân Mây',
    description: 'Hạt trầm hương rừng tự nhiên tỏa hương thơm thanh tịnh, mang lại bình an.'
  },
  'vong_tay_ngoc_bich_16': {
    name: 'Vòng Tay Ngọc Bích Cổ Phong',
    description: 'Vòng ngọc bích nguyên khối xanh thẳm, bóng mịn và mang vượng khí cát lành.'
  },
  'vong_tay_tram_huong_vang_18': {
    name: 'Vòng Tay Trầm Hương Bọc Vàng',
    description: 'Hạt trầm hương quý bọc vàng 18k chạm khắc hoa văn triều Nguyễn sang trọng.'
  }
};

function generateFullItemList() {
  if (fs.existsSync(CLOTHES_INFO_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(CLOTHES_INFO_FILE, 'utf8'));
      if (Array.isArray(data.items) && data.items.length > 0) {
        return data.items;
      }
    } catch (e: any) {
      console.warn('Lỗi đọc clothes_info.json:', e.message);
    }
  }
  return [];
}

// Hệ Thống Đánh Giá Quy Chuẩn Văn Hóa & Lễ Nghi Cổ Phong
function evaluateCulturalAttireAndEtiquette(params: {
  skinId: string;
  skinNameDisplay: string;
  colorFolder: string;
  colorTitle: string;
  pantsNameDisplay: string;
  accDisplay: string;
  accNames: string[];
  event: string;
  isTrangPhuc: boolean;
}): { score: number; verdict: string; matchingAnalysis: string } {
  const {
    skinId,
    skinNameDisplay,
    colorFolder,
    colorTitle,
    pantsNameDisplay,
    accDisplay,
    accNames,
    event,
    isTrangPhuc
  } = params;

  const evLower = (event || '').toLowerCase();
  const prefix = (skinId || '').split('_')[0].toLowerCase();

  // 1. Phân loại tính chất sự kiện
  const isMourning = /tang|viếng|nhà tang|chia buồn|hậu sự/.test(evLower);
  const isSolemn = !isMourning && /tế|nam giao|đền hùng|giỗ|cúng|gia tiên|chùa|phật|tâm linh|tưởng niệm|liệt sĩ|trang nghiêm|tôn nghiêm|thanh tịnh|quốc lễ/.test(evLower);
  const isJoyous = /cưới|hỷ|ăn hỏi|tết|nguyên đán|du xuân|hội xuân|mừng thọ/.test(evLower);
  const isGala = /dạ hội|ngoại giao|trình diễn|thời trang|triển lãm|sân khấu|kỷ yếu|nghệ thuật|giao lưu/.test(evLower);
  const isCasual = /dạo phố|uống trà|thường nhật|đời thường|du lịch|cà phê/.test(evLower);

  // 2. Phân tích tính chất màu sắc
  const isFlashy = ['LienHoa', 'HoangYen', 'XichKim'].includes(colorFolder) ||
    /hồng|đỏ|vàng tươi|rực rỡ|sặc sỡ/i.test(colorTitle);
  const isSubdued = ['BachNgoc', 'ThanhLam', 'ThoHoang', 'BichThuy'].includes(colorFolder) ||
    /trắng|bạch ngọc|lam|thanh lam|rêu|thổ hoàng|nâu|đen|trầm/i.test(colorTitle);
  const isRoyal = ['TuKhi', 'XichKim', 'HuyenChu', 'PhiThuy'].includes(colorFolder) ||
    /tử khí|tím|huyền chu|phi thúy/i.test(colorTitle);

  // 3. Phân tích kiểu dáng trang phục
  const isCourtHeavy = ['quanlai', 'nhatbinh', 'aotac'].includes(prefix);
  const isCasualFolk = ['aobaba', 'tuthan'].includes(prefix);

  let score = 90;
  let verdict = '';
  let matchingAnalysis = '';

  if (isMourning) {
    if (isFlashy) {
      score = 28;
      verdict = 'Đại kỵ lễ nghi tang chế';
      matchingAnalysis = `Độ phù hợp: ${score}% (${verdict}).\n\n` +
        `Cảnh báo nghiêm khắc: Phong tục tang lễ cổ truyền Việt Nam tuyệt đối kiêng kỵ các gam màu rực rỡ mang tính hỷ khí như sắc "${colorTitle}". Việc diện trang phục đỏ, vàng tươi hoặc hồng rực trong tang lễ bị coi là bất kính và khiếm nhã đối với gia quyến.\n\n` +
        `Đề xuất quy chuẩn: Cần chuyển ngay sang trang phục màu trắng mộc, đen tuyền hoặc chàm tối giản; hạn chế tối đa trang sức vàng ngọc lấp lánh để giữ trọn sự tôn kính và tiếc thương đối với người đã khuất.`;
    } else {
      score = 92;
      verdict = 'Trang nghiêm, kính cẩn';
      matchingAnalysis = `Độ phù hợp: ${score}% (${verdict}).\n\n` +
        `Bộ trang phục ${skinNameDisplay} với tông màu "${colorTitle}" thể hiện sự đoan trang, khiêm nhường và kính cẩn, hoàn toàn chuẩn mực với không khí trang nghiêm và tôn kính nơi tang lễ.`;
    }
  } else if (isSolemn) {
    if (isFlashy) {
      score = 48;
      verdict = 'Chưa phù hợp - Thiếu sự trang nghiêm';
      matchingAnalysis = `Độ phù hợp: ${score}% (${verdict} cho ${event}).\n\n` +
        `Đánh giá lễ nghi: Không gian tế lễ và tâm linh đòi hỏi sự thanh tịnh, tôn kính và mực thước. Việc phối y phục mang tông màu "${colorTitle}" quá rực rỡ chưa đáp ứng đúng quy chuẩn trang nghiêm nơi thờ tự hoặc nghi lễ cúng bái cổ truyền, dễ gây cảm giác phô trương, lạc điệu giữa chốn linh thiêng.\n\n` +
        `Đề xuất quy chuẩn: Nên ưu tiên các gam màu nền nã như Bạch Ngọc (trắng ngà), Thanh Lam (xanh lam trầm), Thổ Hoàng (nâu đất ấm) hoặc các sắc lam sẫm. Về phom dáng, Áo Tấc tay thụng hoặc Áo Dài Ngũ Thân cài nút kín cổ sẽ thể hiện trọn vẹn phong thái đoan chính, tề chỉnh.`;
    } else {
      score = isCourtHeavy ? 97 : 94;
      verdict = 'Chuẩn mực nghi lễ - Rất phù hợp';
      matchingAnalysis = `Độ phù hợp: ${score}% (${verdict} cho ${event}).\n\n` +
        `Phân tích phong cách: Bộ trang phục ${skinNameDisplay} mang phom dáng tề chỉnh, kín đáo và trang trọng. Tông sắc "${colorTitle}" nhã nhặn, dung dị, không phô trương, hoàn toàn đáp ứng các tiêu chuẩn khắt khe về sự thành kính và tôn nghiêm nơi ${event}. Tổng thể toát lên nét nho nhã, mực thước của cốt cách cổ phong truyền thống.`;
    }
  } else if (isJoyous) {
    if (isFlashy || isRoyal) {
      score = 96;
      verdict = 'Cát tường, rực rỡ hỷ khí';
      matchingAnalysis = `Độ phù hợp: ${score}% (${verdict} cho ${event}).\n\n` +
        `Phân tích phong cách: Sự kết hợp trang phục mang sắc diện "${colorTitle}" rực rỡ toát lên sinh khí hoan hỷ, may mắn và thịnh vượng, cực kỳ lý tưởng cho các dịp hỷ sự hoặc du xuân đầu năm. Tổng thể trang phục tề chỉnh, hòa quyện trọn vẹn giữa nét đẹp di sản và bầu không khí hân hoan của ${event}.`;
    } else {
      score = 88;
      verdict = 'Thanh nhã, đoan trang';
      matchingAnalysis = `Độ phù hợp: ${score}% (${verdict} cho ${event}).\n\n` +
        `Bộ trang phục mang nét đẹp thanh lịch, nhã nhặn. Để tăng thêm không khí vui tươi cho dịp ${event}, bạn có thể kết hợp thêm phụ kiện ánh kim hoặc các chi tiết thêu hoa văn màu tươi sáng để mang lại vượng khí may mắn.`;
    }
  } else if (isCasual) {
    if (isCourtHeavy) {
      score = 65;
      verdict = 'Khá rườm rà cho bối cảnh đời thường';
      matchingAnalysis = `Độ phù hợp: ${score}% (${verdict}).\n\n` +
        `Nhận xét: Trang phục ${skinNameDisplay} là lễ phục cung đình hoặc cổ phục trang trọng, phom dáng thụng dài nhiều lớp có phần nặng nề khi sử dụng cho hoạt động ${event}. Thích hợp hơn cho triển lãm, lễ hội hoặc chụp ảnh concept cổ trang chuyên nghiệp.`;
    } else {
      score = 92;
      verdict = 'Duyên dáng, thoải mái';
      matchingAnalysis = `Độ phù hợp: ${score}% (${verdict}).\n\n` +
        `Bộ trang phục nhẹ nhàng, gần gũi, vừa lưu giữ nét đẹp truyền thống vừa thuận tiện, linh hoạt cho các hoạt động thường nhật nơi ${event}.`;
    }
  } else if (isGala) {
    score = (isCourtHeavy || isRoyal) ? 96 : 91;
    verdict = 'Lộng lẫy, đậm đà bản sắc di sản';
    matchingAnalysis = `Độ phù hợp: ${score}% (${verdict} cho ${event}).\n\n` +
      `Tổng thể set đồ kết hợp tinh tế giữa ${skinNameDisplay}${isTrangPhuc ? '' : ' cùng ' + pantsNameDisplay}, điểm xuyết cùng các phụ kiện cổ truyền gồm ${accDisplay}. Tông sắc "${colorTitle}" tạo nên sự tương phản nhã nhặn, tôn vinh trọn vẹn tính thẩm mỹ di sản cổ phong trong không gian giao lưu nghệ thuật của ${event}.`;
  } else {
    // Sự kiện tùy chỉnh chung
    score = isFlashy ? 86 : 92;
    verdict = 'Hài hòa, trang nhã';
    matchingAnalysis = `Độ phù hợp: ${score}% (${verdict} cho ${event}).\n\n` +
      `Tổng thể set đồ kết hợp hài hòa giữa ${skinNameDisplay}${isTrangPhuc ? '' : ' và ' + pantsNameDisplay}, điểm xuyết cùng các phụ kiện gồm ${accDisplay}. Sắc diện "${colorTitle}" mang lại diện mạo chỉn chu, thanh lịch và giữ trọn nét đẹp văn hóa di sản khi xuất hiện trong ${event}.`;
  }

  return { score, verdict, matchingAnalysis };
}

// 1. API GET /api/clothes, /api/v1/clothes, /api/items, /api/assets
const handleGetClothes = async (req: express.Request, res: express.Response) => {
  try {
    const SYSTEM_DIR = path.resolve(BASE_ASSETS, 'images', 'system');
    const allJpgImages = getAllJpgImages(SYSTEM_DIR);

    const accessoriesJpg = getAllJpgImages(ACCESSORIES_DIR);
    const pantsJpg = getAllJpgImages(PANTS_DIR);
    const colorsJpg = getAllJpgImages(COLORS_DIR);

    let fullItems: any[] = [];
    let dataSource = 'local';
    let supabaseStatus = 'disconnected';

    // Ưu tiên đọc từ bảng clothes_items trên Supabase PostgreSQL (giới hạn timeout 3.5s để chống treo)
    try {
      const { data, error } = await withTimeout<any>(
        supabase
          .from('clothes_items')
          .select('*')
          .order('category', { ascending: true }),
        3500,
        'Supabase query timeout (3.5s)'
      );

      if (!error && data && data.length > 0) {
        fullItems = data.map((item: any) => {
          const url = toAssetUrl(item.image_filename);
          const cat = normalizeItemCategory(item);
          return {
            ...item,
            category: cat,
            image_filename: url,
            image_url: url
          };
        });
        dataSource = 'supabase';
        supabaseStatus = 'connected_with_data';
      } else {
        // Nếu bảng chưa có dữ liệu hoặc chưa chạy SQL, dùng dữ liệu 226 items chuẩn
        fullItems = generateFullItemList().map((item: any) => {
          const url = toAssetUrl(item.image_filename);
          const cat = normalizeItemCategory(item);
          return {
            ...item,
            category: cat,
            image_filename: url,
            image_url: url
          };
        });
        supabaseStatus = error ? `table_not_found: ${error.message}` : 'table_empty';
      }
    } catch (dbErr: any) {
      console.warn('Lỗi kết nối Supabase, fallback về dữ liệu cục bộ:', dbErr.message);
      fullItems = generateFullItemList().map((item: any) => {
        const url = toAssetUrl(item.image_filename);
        const cat = normalizeItemCategory(item);
        return {
          ...item,
          category: cat,
          image_filename: url,
          image_url: url
        };
      });
      supabaseStatus = `error: ${dbErr.message}`;
    }

    const driveImagesCount = fullItems.filter((i: any) =>
      (i.image_filename || '').includes('drive.google.com') ||
      (i.image_filename || '').includes('googleusercontent.com')
    ).length;

    if (res.headersSent) return;
    return res.json({
      success: true,
      format: 'jpg',
      data_source: dataSource,
      supabase_status: supabaseStatus,
      supabase_url: SUPABASE_URL,
      google_drive_images_count: driveImagesCount,
      images: allJpgImages,
      categories: {
        accessories: accessoriesJpg,
        pants: pantsJpg,
        colors: colorsJpg,
      },
      clothes_info: {
        project: 'Remix Trang Phục Truyền Thống Việt Nam',
        version: '2.0.0',
        items: fullItems
      },
      total_images: allJpgImages.length,
      total_accessories: accessoriesJpg.length,
      total_pants: pantsJpg.length,
      total_colors: colorsJpg.length,
      total_items: fullItems.length,
    });
  } catch (err: any) {
    console.error('Lỗi khi đọc danh sách trang phục:', err);
    if (res.headersSent) return;
    return res.status(500).json({
      success: false,
      message: 'Không thể đọc thông tin trang phục từ hệ thống',
      error: err?.message || String(err),
    });
  }
};

// Endpoint tổng hợp tất cả đường link API kết nối của hệ thống
const handleApiDirectory = (req: express.Request, res: express.Response) => {
  const host = req.get('x-forwarded-host') || req.get('host') || 'localhost:3000';
  const forwardedProto = req.get('x-forwarded-proto');
  const protocol = forwardedProto ? forwardedProto.split(',')[0].trim() : (req.protocol || (req.secure ? 'https' : 'http'));
  const baseUrl = `${protocol}://${host}`;

  if (res.headersSent) return;
  return res.json({
    project: 'Remix Trang Phục Truyền Thống Việt Nam API',
    version: '2.0.0',
    description: 'Bảng tổng hợp tất cả các đường link kết nối API của hệ thống (Local, Cloud Run & Supabase)',
    base_url: baseUrl,
    endpoints: {
      clothes: {
        method: 'GET',
        path: '/api/clothes',
        url: `${baseUrl}/api/clothes`,
        description: 'Lấy toàn bộ danh sách 226 vật phẩm cổ phục (Skins, Quần, Phụ kiện) và hình ảnh',
      },
      remix: {
        method: 'POST',
        path: '/api/remix',
        url: `${baseUrl}/api/remix`,
        description: 'Phối đồ tự động, đánh giá quy chuẩn lễ nghi văn hóa và render layout 2D Flatlay',
        sample_payload: {
          skin: ['aodai_nam_xichkim_0'],
          pants: ['quan_so_nam_1'],
          accessories: ['khan_dong_chu_nhan_nam_2'],
          main_color: 'Xích Kim Hoàng Gia',
          event: 'Lễ Cưới Cổ Phong Truyền Thống Việt Nam'
        }
      },
      save: {
        method: 'POST',
        path: '/api/save',
        url: `${baseUrl}/api/save`,
        description: 'Lưu ảnh kết quả remix vào thư mục user và tải trực tiếp lên Supabase Storage bucket images',
        sample_payload: {
          image_filename: 'remix_temp_1791087756765.jpg'
        }
      },
      supabase_status: {
        method: 'GET',
        path: '/api/supabase/status',
        url: `${baseUrl}/api/supabase/status`,
        description: 'Kiểm tra trạng thái kết nối Supabase Database và Storage bucket images',
      },
      supabase_seed: {
        method: 'POST',
        path: '/api/supabase/seed',
        url: `${baseUrl}/api/supabase/seed`,
        description: 'Đồng bộ 226 vật phẩm lên bảng clothes_items của Supabase PostgreSQL',
      },
      supabase_schema: {
        method: 'GET',
        path: '/api/supabase/schema',
        url: `${baseUrl}/api/supabase/schema`,
        description: 'Lấy mã nguồn file script supabase_schema.sql để khởi tạo bảng và RLS',
      },
      system_folders: {
        method: 'GET',
        path: '/api/system/folders',
        url: `${baseUrl}/api/system/folders`,
        description: 'Kiểm tra trạng thái các thư mục hệ thống và tệp tin ảnh',
      },
      admin_sync_sheets: {
        method: 'POST',
        path: '/api/admin/sync-sheets',
        url: `${baseUrl}/api/admin/sync-sheets`,
        description: 'Đồng bộ toàn bộ bảng dữ liệu mới nhất từ Google Sheets và tự động chuyển link ảnh Google Drive sang Direct Link rồi Upsert vào Supabase',
        sample_payload: {
          sheet_id: 'your_google_sheet_id_here',
          sheet_range: 'Items!A1:Z',
          dry_run: false
        }
      },
      admin_sheets_status: {
        method: 'GET',
        path: '/api/admin/sync-sheets/status',
        url: `${baseUrl}/api/admin/sync-sheets/status`,
        description: 'Kiểm tra trạng thái Service Account, cấu hình Google Sheet và tỷ lệ ảnh Direct Drive trên Supabase',
      },
      admin_sheets_template: {
        method: 'GET',
        path: '/api/admin/sheets-template',
        url: `${baseUrl}/api/admin/sheets-template`,
        description: 'Lấy dữ liệu mẫu 226 vật phẩm để tạo mới hoặc dán vào Google Sheet',
      },
      admin_sheets_csv: {
        method: 'GET',
        path: '/api/admin/sheets-template/csv',
        url: `${baseUrl}/api/admin/sheets-template/csv`,
        description: 'Tải file CSV mẫu chuẩn mực để import trực tiếp vào Google Sheets',
      },
      auth_register: {
        method: 'POST',
        path: '/api/auth/register',
        url: `${baseUrl}/api/auth/register`,
        description: 'Đăng ký tài khoản người dùng qua Supabase Auth và lưu thông tin vào bảng profiles',
        sample_payload: {
          username: 'nguyenvana',
          password: 'password123',
          full_name: 'Nguyễn Văn A'
        }
      },
      auth_login: {
        method: 'POST',
        path: '/api/auth/login',
        url: `${baseUrl}/api/auth/login`,
        description: 'Đăng nhập người dùng bằng tên tài khoản hoặc email qua Supabase Auth',
        sample_payload: {
          username: 'nguyenvana',
          password: 'password123'
        }
      },
      auth_me: {
        method: 'GET',
        path: '/api/auth/me',
        url: `${baseUrl}/api/auth/me`,
        description: 'Kiểm tra trạng thái xác thực và thông tin phiên người dùng hiện tại (Bearer Token)',
      },
      auth_logout: {
        method: 'POST',
        path: '/api/auth/logout',
        url: `${baseUrl}/api/auth/logout`,
        description: 'Đăng xuất tài khoản người dùng và hủy phiên Supabase Auth',
      }
    },
    cloud_services: {
      supabase_project_url: SUPABASE_URL,
      supabase_rest_endpoint: `${SUPABASE_URL}/rest/v1/clothes_items?select=*`,
      supabase_storage_url: `${SUPABASE_URL}/storage/v1/object/public/images/`,
      google_sheets_integration: 'Google Sheets API v4 (Service Account / Public Fallback)',
      google_drive_storage: 'Google Drive Direct Public CDN Link (https://drive.google.com/uc?export=view&id=...)',
    }
  });
};

app.get('/api', handleApiDirectory);
app.get('/api/v1', handleApiDirectory);
app.get('/api/endpoints', handleApiDirectory);

app.get('/api/clothes', handleGetClothes);
app.get('/api/v1/clothes', handleGetClothes);
app.get('/api/clothes_items', handleGetClothes);
app.get('/api/v1/clothes_items', handleGetClothes);
app.get('/api/items', handleGetClothes);
app.get('/api/v1/items', handleGetClothes);
app.get('/api/assets', handleGetClothes);
app.get('/api/accessories', (req, res) => res.json({ success: true, format: 'jpg', images: getAllJpgImages(ACCESSORIES_DIR) }));
app.get('/api/pants', (req, res) => res.json({ success: true, format: 'jpg', images: getAllJpgImages(PANTS_DIR) }));
app.get('/api/colors', (req, res) => res.json({ success: true, format: 'jpg', images: getAllJpgImages(COLORS_DIR) }));

// ==============================================================================
// SUPABASE AUTHENTICATION API ENDPOINTS
// ==============================================================================
// SUPABASE & LOCAL HYBRID AUTHENTICATION API ENDPOINTS
// ==============================================================================

const LOCAL_USERS_FILE = path.resolve(__dirname, 'dist', 'user_accounts.json');

interface LocalUserRecord {
  id: string;
  email: string;
  username: string;
  full_name: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

function getLocalUsers(): LocalUserRecord[] {
  try {
    if (fs.existsSync(LOCAL_USERS_FILE)) {
      const content = fs.readFileSync(LOCAL_USERS_FILE, 'utf-8');
      return JSON.parse(content) || [];
    }
  } catch (e) {
    console.warn('[LocalUsers] Lỗi khi đọc danh sách tài khoản cục bộ:', e);
  }
  return [];
}

function saveLocalUser(user: LocalUserRecord): void {
  try {
    const users = getLocalUsers();
    const existingIndex = users.findIndex(u =>
      u.id === user.id ||
      u.email.toLowerCase() === user.email.toLowerCase() ||
      u.username.toLowerCase() === user.username.toLowerCase()
    );
    if (existingIndex >= 0) {
      users[existingIndex] = { ...users[existingIndex], ...user, updated_at: new Date().toISOString() };
    } else {
      users.push(user);
    }
    const distDir = path.dirname(LOCAL_USERS_FILE);
    if (!fs.existsSync(distDir)) {
      fs.mkdirSync(distDir, { recursive: true });
    }
    fs.writeFileSync(LOCAL_USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[LocalUsers] Lỗi khi lưu tài khoản cục bộ:', e);
  }
}

function hashAuthPassword(password: string): string {
  return crypto.createHash('sha256').update(password + '_vietphuc_salt_2026').digest('hex');
}

// Helper: Chuẩn hóa tên đăng nhập hoặc email sang định dạng email cho Supabase Auth
function resolveAuthEmail(identifier: string): string[] {
  const clean = (identifier || '').trim();
  if (clean.includes('@')) {
    return [clean.toLowerCase()];
  }
  const cleanLocal = clean.toLowerCase().replace(/[^a-z0-9_.-]/g, '');
  return [
    `${cleanLocal || 'user'}@vietphuc.studio`,
    `${cleanLocal || 'user'}@gmail.com`
  ];
}

// 1. POST /api/auth/register - Đăng ký tài khoản chuẩn Supabase Auth & Profiles (Có Fallback Hybrid)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, full_name, email: reqEmail } = req.body || {};
    const identifier = (username || reqEmail || '').trim();
    const rawPassword = String(password || '').trim();
    const fullName = (full_name || username || identifier).trim();

    if (!identifier || !rawPassword) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ tên đăng ký và mật khẩu.' });
    }
    if (rawPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Mật khẩu phải có độ dài ít nhất 6 ký tự.' });
    }

    const email = reqEmail ? reqEmail.trim().toLowerCase() : resolveAuthEmail(identifier)[0];

    // Kiểm tra trùng lặp trong cơ sở dữ liệu profiles trên Supabase (Cloud Database)
    try {
      const { data: existingProfiles } = await supabase
        .from('profiles')
        .select('id, username, email')
        .or(`username.ilike.${identifier},email.ilike.${email}`);

      if (existingProfiles && existingProfiles.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Tên tài khoản hoặc email này đã tồn tại trên hệ thống. Vui lòng đăng nhập!'
        });
      }
    } catch (checkErr: any) {
      console.warn('[Register DB Check Warning]:', checkErr.message);
    }

    // Kiểm tra trùng lặp phụ trong cơ sở dữ liệu tài khoản cục bộ
    const localUsers = getLocalUsers();
    const existingLocal = localUsers.find(u =>
      u.email.toLowerCase() === email.toLowerCase() ||
      u.username.toLowerCase() === identifier.toLowerCase()
    );
    if (existingLocal) {
      return res.status(400).json({
        success: false,
        message: 'Tên tài khoản hoặc email này đã tồn tại trên hệ thống. Vui lòng đăng nhập!'
      });
    }

    // Thử đăng ký qua Supabase Auth SDK
    let suUser: any = null;
    let suSession: any = null;
    let suError: any = null;

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: rawPassword,
        options: {
          data: {
            username: identifier,
            full_name: fullName,
          },
        },
      });

      if (!error && data?.user) {
        suUser = data.user;
        suSession = data.session;
      } else {
        suError = error;
      }
    } catch (e: any) {
      suError = e;
    }

    // Nếu lỗi do tài khoản đã tồn tại thật sự trên Supabase Auth
    if (suError) {
      const errMsg = String(suError.message || '').toLowerCase();
      if (errMsg.includes('already registered') || errMsg.includes('already exists')) {
        return res.status(400).json({
          success: false,
          message: 'Tên tài khoản hoặc email này đã tồn tại trên hệ thống. Vui lòng đăng nhập!'
        });
      }
    }

    // Khởi tạo thông tin người dùng (Hỗ trợ Supabase Auth + Fallback nếu Supabase bị rate limit email 429)
    const newUserId = suUser?.id || `usr_${crypto.randomUUID()}`;
    const newUserRecord: LocalUserRecord = {
      id: newUserId,
      email: email,
      username: identifier,
      full_name: fullName,
      password_hash: hashAuthPassword(rawPassword),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    saveLocalUser(newUserRecord);

    const sessionToken = suSession?.access_token || `sb_jwt_${newUserRecord.id}_${Date.now()}`;

    // Cập nhật và lưu vĩnh viễn bảng profiles trên Supabase Cloud Database để tồn tại bền vững chéo thiết bị
    try {
      await supabase.from('profiles').upsert([
        {
          id: newUserRecord.id,
          username: newUserRecord.username.toLowerCase(),
          email: newUserRecord.email.toLowerCase(),
          full_name: newUserRecord.full_name,
          password_hash: newUserRecord.password_hash,
          updated_at: new Date().toISOString(),
        },
      ], { onConflict: 'id' });
    } catch (pErr: any) {
      console.warn('[Register Profiles Upsert Error]:', pErr.message);
    }

    return res.json({
      success: true,
      message: 'Đăng ký tài khoản thành công! Bạn có thể đăng nhập ngay bây giờ.',
      user: {
        id: newUserRecord.id,
        email: newUserRecord.email,
        username: newUserRecord.username,
        full_name: newUserRecord.full_name,
      },
      session: {
        access_token: sessionToken,
        token_type: 'bearer'
      },
    });
  } catch (err: any) {
    console.error('Lỗi khi đăng ký tài khoản:', err);
    return res.status(500).json({ success: false, message: 'Lỗi hệ thống khi đăng ký tài khoản.', error: err.message });
  }
});

// 2. POST /api/auth/login - Đăng nhập tài khoản (Xác thực Hybrid Supabase + Local Store)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, email: reqEmail, password } = req.body || {};
    const identifier = (username || reqEmail || '').trim();
    const rawPassword = String(password || '').trim();

    if (!identifier || !rawPassword) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.' });
    }

    const candidateEmails = reqEmail ? [reqEmail.trim().toLowerCase()] : resolveAuthEmail(identifier);
    const passHash = hashAuthPassword(rawPassword);

    // 1. Ưu tiên kiểm tra trong bảng profiles của Supabase Cloud Database (Đảm bảo bền vững, không bị mất)
    let dbUser: any = null;
    try {
      const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('*')
        .or(`username.ilike.${identifier},email.ilike.${identifier}`);

      if (!pError && profiles && profiles.length > 0) {
        const matchedProfile = profiles.find((p: any) => p.password_hash);
        if (matchedProfile) {
          dbUser = matchedProfile;
        }
      }
    } catch (dbErr: any) {
      console.warn('[Login DB Query Warning]:', dbErr.message);
    }

    if (dbUser) {
      if (dbUser.password_hash === passHash) {
        const sessionToken = `sb_jwt_${dbUser.id}_${Date.now()}`;
        return res.json({
          success: true,
          message: `Chào mừng ${dbUser.full_name || dbUser.username} đã quay trở lại!`,
          user: {
            id: dbUser.id,
            email: dbUser.email,
            username: dbUser.username,
            full_name: dbUser.full_name || dbUser.username,
          },
          session: {
            access_token: sessionToken,
            token_type: 'bearer'
          },
        });
      } else {
        return res.status(401).json({
          success: false,
          message: 'Tên đăng nhập hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại!'
        });
      }
    }

    // 2. Fallback kiểm tra trong kho tài khoản cục bộ (nếu có)
    const localUsers = getLocalUsers();
    const localUser = localUsers.find(u =>
      u.email.toLowerCase() === identifier.toLowerCase() ||
      u.username.toLowerCase() === identifier.toLowerCase() ||
      candidateEmails.some(ce => u.email.toLowerCase() === ce.toLowerCase())
    );

    if (localUser) {
      if (localUser.password_hash === passHash) {
        const sessionToken = `sb_jwt_${localUser.id}_${Date.now()}`;
        
        // Đồng bộ ngược tài khoản từ local lên Cloud Database để tồn tại vĩnh viễn
        try {
          await supabase.from('profiles').upsert([
            {
              id: localUser.id,
              username: localUser.username.toLowerCase(),
              email: localUser.email.toLowerCase(),
              full_name: localUser.full_name,
              password_hash: localUser.password_hash,
              updated_at: new Date().toISOString()
            }
          ], { onConflict: 'id' });
        } catch (syncErr: any) {
          console.warn('[Sync Local to Cloud DB Failed]:', syncErr.message);
        }

        return res.json({
          success: true,
          message: `Chào mừng ${localUser.full_name || localUser.username} đã quay trở lại!`,
          user: {
            id: localUser.id,
            email: localUser.email,
            username: localUser.username,
            full_name: localUser.full_name || localUser.username,
          },
          session: {
            access_token: sessionToken,
            token_type: 'bearer'
          },
        });
      } else {
        return res.status(401).json({
          success: false,
          message: 'Tên đăng nhập hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại!'
        });
      }
    }

    // 3. Kiểm tra trực tiếp trên Supabase Auth gốc
    let authData: any = null;
    let authError: any = null;

    for (const candidateEmail of candidateEmails) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: candidateEmail,
        password: rawPassword,
      });

      if (!error && data?.user) {
        authData = data;
        break;
      } else {
        authError = error;
      }
    }

    if (!authData || !authData.user) {
      return res.status(401).json({
        success: false,
        message: 'Tên đăng nhập hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại!',
        error: authError?.message,
      });
    }

    const userMeta = authData.user.user_metadata || {};
    const displayName = userMeta.full_name || userMeta.username || identifier;
    const resolvedUsername = userMeta.username || identifier;

    // Lưu dự phòng cục bộ
    saveLocalUser({
      id: authData.user.id,
      email: authData.user.email || identifier,
      username: resolvedUsername,
      full_name: displayName,
      password_hash: passHash,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    // Lưu đồng bộ vĩnh viễn lên bảng profiles
    try {
      await supabase.from('profiles').upsert([
        {
          id: authData.user.id,
          username: resolvedUsername.toLowerCase(),
          email: (authData.user.email || identifier).toLowerCase(),
          full_name: displayName,
          password_hash: passHash,
          updated_at: new Date().toISOString()
        }
      ], { onConflict: 'id' });
    } catch (saveErr: any) {}

    return res.json({
      success: true,
      message: `Chào mừng ${displayName} đã quay trở lại!`,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        username: resolvedUsername,
        full_name: displayName,
      },
      session: authData.session,
    });
  } catch (err: any) {
    console.error('Lỗi khi đăng nhập tài khoản:', err);
    return res.status(500).json({ success: false, message: 'Lỗi hệ thống khi đăng nhập.', error: err.message });
  }
});

// 3. GET /api/auth/me - Kiểm tra và duy trì phiên đăng nhập
app.get('/api/auth/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Chưa có thông tin xác thực.' });
    }
    const token = authHeader.replace('Bearer ', '').trim();

    // Kiểm tra token phiên cục bộ
    if (token.startsWith('sb_jwt_')) {
      const parts = token.split('_');
      // Format token: sb_jwt_<userId>_<timestamp>
      const userId = parts.slice(2, -1).join('_');

      // A. Ưu tiên kiểm tra trực tiếp từ Supabase Cloud profiles table để nhận dạng nhất quán chéo thiết bị
      try {
        const { data: profiles, error: pError } = await withTimeout<any>(
          supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .limit(1),
          3000,
          'Profiles query timeout (3s)'
        );

        if (!pError && profiles && profiles.length > 0) {
          const u = profiles[0];
          return res.json({
            success: true,
            user: {
              id: u.id,
              email: u.email,
              username: u.username,
              full_name: u.full_name || u.username,
            },
          });
        }
      } catch (dbErr: any) {
        console.warn('[Session Verify DB Error]:', dbErr.message);
      }

      // B. Fallback kiểm tra file cục bộ
      const localUsers = getLocalUsers();
      const localUser = localUsers.find(u => u.id === userId || u.id.endsWith(userId));

      if (localUser) {
        return res.json({
          success: true,
          user: {
            id: localUser.id,
            email: localUser.email,
            username: localUser.username,
            full_name: localUser.full_name || localUser.username,
          },
        });
      }
    }

    const { data: { user } = { user: null }, error } = await withTimeout(
      supabase.auth.getUser(token),
      3500,
      'Supabase getUser timeout (3.5s)'
    ).catch(() => ({ data: { user: null }, error: new Error('Auth timeout') }));

    if (error || !user) {
      return res.status(401).json({ success: false, message: 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ.' });
    }

    const userMetadata = user.user_metadata || {};
    const displayName = userMetadata.full_name || userMetadata.display_name || userMetadata.username || user.email?.split('@')[0] || 'Thành viên';
    const resolvedUsername = userMetadata.username || user.email?.split('@')[0] || 'Thành viên';

    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: resolvedUsername,
        full_name: displayName,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Lỗi xác thực phiên.', error: err.message });
  }
});

// 4. POST /api/auth/logout - Đăng xuất
app.post('/api/auth/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      await supabase.auth.signOut().catch(() => {});
    }
    return res.json({ success: true, message: 'Đăng xuất tài khoản thành công!' });
  } catch (err: any) {
    return res.json({ success: true, message: 'Đã đăng xuất.' });
  }
});

// Helper: Chuyển đổi đường dẫn URL tĩnh sang đường dẫn tệp vật lý chính xác trên đĩa
function toDiskPath(urlOrPath: string): string {
  if (!urlOrPath) return '';
  
  // Nếu đã là đường dẫn tuyệt đối chính xác trên đĩa
  if (path.isAbsolute(urlOrPath)) {
    if (fs.existsSync(urlOrPath)) return urlOrPath;
    if (urlOrPath.includes('src/assets')) {
      const idx = urlOrPath.indexOf('src/assets');
      const testRel = urlOrPath.substring(idx);
      const testAbs = path.resolve(__dirname, testRel);
      if (fs.existsSync(testAbs)) return testAbs;
    }
  }

  let clean = urlOrPath.replace(/\\/g, '/');
  
  // Nếu chứa src/assets, chuẩn hóa lại bắt đầu từ src/assets
  if (clean.includes('src/assets')) {
    clean = clean.substring(clean.indexOf('src/assets'));
  } else if (clean.startsWith('/assets/')) {
    clean = 'src' + clean;
  } else if (clean.startsWith('assets/')) {
    clean = 'src/' + clean;
  } else if (!clean.startsWith('src/') && !clean.startsWith('/src/')) {
    clean = 'src/assets/' + clean.replace(/^\//, '');
  }
  
  if (clean.startsWith('/')) {
    clean = clean.substring(1);
  }
  return path.resolve(__dirname, clean);
}

// Smart asset matching functions with robust fuzzy and substring fallback
function findBestJpgForSkin(skinId: string): string {
  const allItems = generateFullItemList().filter((i: any) => i.category === 'skin');
  const cleanSkin = String(skinId || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  // 1. Exact ID match
  let match = allItems.find((i: any) => i.id.toLowerCase() === String(skinId).toLowerCase());
  if (match && match.image_filename) {
    let diskP = toDiskPath(match.image_filename);
    if (fs.existsSync(diskP)) return diskP;
  }

  // 2. Substring match on item ID
  let subMatch = allItems.find((i: any) => cleanSkin.includes(i.id.toLowerCase().replace(/[^a-z0-9]/g, '')) || i.id.toLowerCase().replace(/[^a-z0-9]/g, '').includes(cleanSkin));
  if (subMatch && subMatch.image_filename) {
    let diskP = toDiskPath(subMatch.image_filename);
    if (fs.existsSync(diskP)) return diskP;
  }

  // 3. Filename inclusion scan in allSkins
  const allSkins = getAllJpgImages(COLORS_DIR);
  let fileMatch = allSkins.find((f: any) => path.basename(f).toLowerCase().replace(/[^a-z0-9]/g, '').includes(cleanSkin));
  if (fileMatch) {
    let diskP = toDiskPath(fileMatch);
    if (fs.existsSync(diskP)) return diskP;
  }

  // 4. Fallback to first available skin
  return allSkins.length > 0 ? toDiskPath(allSkins[0]) : '';
}

function findBestJpgForPants(pantsId: string): string {
  const allItems = generateFullItemList().filter((i: any) => i.category === 'pants');
  const cleanPants = String(pantsId || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  let match = allItems.find((i: any) => i.id.toLowerCase() === String(pantsId).toLowerCase() || cleanPants.includes(i.id.toLowerCase().replace(/[^a-z0-9]/g, '')) || i.id.toLowerCase().replace(/[^a-z0-9]/g, '').includes(cleanPants));
  if (match && match.image_filename) {
    let diskP = toDiskPath(match.image_filename);
    if (fs.existsSync(diskP)) return diskP;
  }

  const allPants = getAllJpgImages(PANTS_DIR);
  let fileMatch = allPants.find((f: any) => path.basename(f).toLowerCase().replace(/[^a-z0-9]/g, '').includes(cleanPants));
  if (fileMatch) {
    let diskP = toDiskPath(fileMatch);
    if (fs.existsSync(diskP)) return diskP;
  }

  return allPants.length > 0 ? toDiskPath(allPants[0]) : '';
}

function findBestJpgForAccessory(accId: string): string {
  const allItems = generateFullItemList().filter((i: any) => i.category === 'accessory');
  const cleanAcc = String(accId || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  let match = allItems.find((i: any) => i.id.toLowerCase() === String(accId).toLowerCase() || cleanAcc.includes(i.id.toLowerCase().replace(/[^a-z0-9]/g, '')) || i.id.toLowerCase().replace(/[^a-z0-9]/g, '').includes(cleanAcc));
  if (match && match.image_filename) {
    let diskP = toDiskPath(match.image_filename);
    if (fs.existsSync(diskP)) return diskP;
  }

  const allAcc = getAllJpgImages(ACCESSORIES_DIR);
  let fileMatch = allAcc.find((f: any) => path.basename(f).toLowerCase().replace(/[^a-z0-9]/g, '').includes(cleanAcc));
  if (fileMatch) {
    let diskP = toDiskPath(fileMatch);
    if (fs.existsSync(diskP)) return diskP;
  }

  return allAcc.length > 0 ? toDiskPath(allAcc[0]) : '';
}

function drawContainedImage(ctx: any, img: any, x: number, y: number, maxW: number, maxH: number) {
  const aspect = img.width / img.height;
  let drawW = maxW;
  let drawH = maxW / aspect;

  if (drawH > maxH) {
    drawH = maxH;
    drawW = maxH * aspect;
  }

  const offsetX = x + (maxW - drawW) / 2;
  const offsetY = y + (maxH - drawH) / 2;

  ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
}

async function renderFlatlayCompositeImage({
  skinId,
  pantsId,
  accIds,
  mainColor,
  event,
  outputPath
}: {
  skinId: string;
  pantsId?: string;
  accIds: string[];
  mainColor: string;
  event: string;
  outputPath: string;
}) {
  const logPath = path.resolve(__dirname, 'render.log');
  const log = (msg: string) => {
    fs.appendFileSync(logPath, `[RENDER LOG] ${new Date().toISOString()} - ${msg}\n`);
    console.log(msg);
  };
  fs.writeFileSync(logPath, `--- START RENDER ---\n`);
  log(`Inputs: skinId=${skinId}, pantsId=${pantsId}, accIds=${JSON.stringify(accIds)}`);

  const width = 700;
  const height = 1000;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Outer background representing deep dark background
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, width, height);

  // 1. Main outer white card container
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 15;
  
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(30, 30, width - 60, height - 60, 24);
  ctx.fill();

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(30, 30, width - 60, height - 60, 24);
  ctx.stroke();

  ctx.shadowColor = 'transparent'; // Reset shadow

  // 2. Header (Centered title & subtitle)
  ctx.fillStyle = '#be123c'; // Burgundy/Crimson Red
  ctx.font = 'bold 24px "DejaVu Sans", "FreeSans", "Liberation Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('VIET PHUC REMIX - FLATLAY OUTFIT GRID', width / 2, 85);

  ctx.fillStyle = '#475569'; // Slate grey
  ctx.font = 'italic 12px "DejaVu Sans", "FreeSans", "Liberation Sans", sans-serif';
  ctx.fillText('Bo Cuc Co Phuc 2D Flatlay • Top-down Studio View', width / 2, 110);

  // Divider Line
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(60, 125);
  ctx.lineTo(width - 60, 125);
  ctx.stroke();

  // 3. Warm beige inner canvas box
  const boxX = 55;
  const boxY = 145;
  const boxW = 590;
  const boxH = 760;

  ctx.fillStyle = '#fbf8f3'; // Warm ivory/cream
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, 18);
  ctx.fill();

  ctx.strokeStyle = '#e5dacf'; // Warm golden-beige border
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, 18);
  ctx.stroke();

  const allItems = generateFullItemList();
  log(`Total items in system: ${allItems.length}`);

  // 4. Left Column: Accessories
  const accSlotW = 110;
  const accSlotH = 160;
  const accX = 75;

  for (let i = 0; i < 4; i++) {
    const slotY = 170 + i * 180;
    const accId = accIds[i];

    if (accId) {
      const accPath = findBestJpgForAccessory(accId);
      log(`Acc ${i} (ID=${accId}) resolved to path: ${accPath}`);
      const accItem = allItems.find((item: any) => item.id === accId) || { name: accId };
      if (accPath && fs.existsSync(accPath)) {
        try {
          const accImg = await loadImage(accPath);
          log(`Acc ${i} loaded image successfully: size=${accImg.width}x${accImg.height}`);

          // Card container
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.roundRect(accX, slotY, accSlotW, accSlotH, 12);
          ctx.fill();
          ctx.strokeStyle = '#cbd5e1';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(accX, slotY, accSlotW, accSlotH, 12);
          ctx.stroke();

          // Title
          ctx.fillStyle = '#7e22ce'; // Purple
          ctx.font = 'bold 9px "DejaVu Sans", "FreeSans", "Liberation Sans", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`PHỤ KIỆN ${i + 1}`, accX + accSlotW / 2, slotY + 20);

          // Dark image frame
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.roundRect(accX + 8, slotY + 28, 94, 94, 8);
          ctx.fill();

          ctx.globalCompositeOperation = 'screen';
          drawContainedImage(ctx, accImg, accX + 12, slotY + 32, 86, 86);
          ctx.globalCompositeOperation = 'source-over';
          log(`Acc ${i} drawn successfully`);

          // Truncated accessory name
          let cleanName = accItem.name.replace(/_/g, ' ');
          if (cleanName.includes('-')) {
            cleanName = cleanName.split('-')[0].trim();
          }
          if (cleanName.length > 13) {
            cleanName = cleanName.substring(0, 11) + '...';
          }
          ctx.fillStyle = '#334155';
          ctx.font = 'bold 9px "DejaVu Sans", "FreeSans", "Liberation Sans", sans-serif';
          ctx.fillText(cleanName.toUpperCase(), accX + accSlotW / 2, slotY + 145);

        } catch (e: any) {
          log(`Error drawing accessory ${i}: ${e.message}`);
          console.error('Error drawing accessory:', e);
        }
      } else {
        log(`Acc ${i} path does not exist: ${accPath}`);
      }
    } else {
      // Draw modern placeholder dashed slot
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath();
      ctx.roundRect(accX, slotY, accSlotW, accSlotH, 12);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]); // Reset dash

      ctx.fillStyle = '#94a3b8';
      ctx.font = 'italic 9px "DejaVu Sans", "FreeSans", "Liberation Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`[TRỐNG ${i + 1}]`, accX + accSlotW / 2, slotY + 85);
    }
  }

  // 5. Center-Right Column (Main Cards)
  const mainX = 205;
  const mainW = 415;

  // A. TRANG PHỤC CHÍNH card
  const skinPath = findBestJpgForSkin(skinId);
  log(`Skin (ID=${skinId}) resolved to path: ${skinPath}`);
  const skinItem = allItems.find((i: any) => i.id === skinId) || { name: 'Trang phục chính', id: skinId };

  if (skinPath && fs.existsSync(skinPath)) {
    try {
      const skinImg = await loadImage(skinPath);
      log(`Skin loaded image successfully: size=${skinImg.width}x${skinImg.height}`);

      // Card Background with small subtle shadow
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(mainX, 170, mainW, 350, 16);
      ctx.fill();
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(mainX, 170, mainW, 350, 16);
      ctx.stroke();

      // Card Title
      ctx.fillStyle = '#be123c'; // Crimson Red
      ctx.font = 'bold 12px "DejaVu Sans", "FreeSans", "Liberation Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('1. TRANG PHỤC CHÍNH', mainX + mainW / 2, 198);

      // Dark image frame inside card
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(mainX + 15, 212, mainW - 30, 260, 12);
      ctx.fill();

      ctx.globalCompositeOperation = 'screen';
      drawContainedImage(ctx, skinImg, mainX + 25, 222, mainW - 50, 240);
      ctx.globalCompositeOperation = 'source-over';
      log(`Skin drawn successfully`);

      // Bottom item name
      let labelName = skinItem.name || 'Áo / Trang phục chính';
      if (labelName.includes('-')) {
        labelName = labelName.split('-')[0].trim();
      }
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 12px "DejaVu Sans", "FreeSans", "Liberation Sans", sans-serif';
      ctx.fillText(labelName, mainX + mainW / 2, 498);

    } catch (e: any) {
      log(`Error drawing main skin card: ${e.message}`);
      console.error('Error drawing main clothing card:', e);
    }
  } else {
    log(`Skin path does not exist: ${skinPath}`);
  }

  // B. QUẦN VẠT DƯỚI card
  if (pantsId) {
    const pantsPath = findBestJpgForPants(pantsId);
    log(`Pants (ID=${pantsId}) resolved to path: ${pantsPath}`);
    const pantsItem = allItems.find((i: any) => i.id === pantsId) || { name: 'Quần vạt dưới', id: pantsId };

    if (pantsPath && fs.existsSync(pantsPath)) {
      try {
        const pantsImg = await loadImage(pantsPath);
        log(`Pants loaded image successfully: size=${pantsImg.width}x${pantsImg.height}`);

        // Card Background
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(mainX, 540, mainW, 345, 16);
        ctx.fill();
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(mainX, 540, mainW, 345, 16);
        ctx.stroke();

        // Card Title
        ctx.fillStyle = '#b45309'; // Orange-brown
        ctx.font = 'bold 12px "DejaVu Sans", "FreeSans", "Liberation Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('2. QUẦN VẠT DƯỚI', mainX + mainW / 2, 568);

        // Dark image frame inside card
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.roundRect(mainX + 15, 582, mainW - 30, 255, 12);
        ctx.fill();

        ctx.globalCompositeOperation = 'screen';
        drawContainedImage(ctx, pantsImg, mainX + 25, 592, mainW - 50, 235);
        ctx.globalCompositeOperation = 'source-over';
        log(`Pants drawn successfully`);

        // Bottom item name
        let labelPants = pantsItem.name || 'Quần';
        if (labelPants.includes('-')) {
          labelPants = labelPants.split('-')[0].trim();
        }
        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 12px "DejaVu Sans", "FreeSans", "Liberation Sans", sans-serif';
        ctx.fillText(labelPants, mainX + mainW / 2, 868);

      } catch (e: any) {
        log(`Error drawing pants card: ${e.message}`);
        console.error('Error drawing pants card:', e);
      }
    } else {
      log(`Pants path does not exist: ${pantsPath}`);
    }
  } else {
    // Draw decorative full body notification
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(mainX, 540, mainW, 345, 16);
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(mainX, 540, mainW, 345, 16);
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'italic 12px "DejaVu Sans", "FreeSans", "Liberation Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Trang phục nguyên bộ hoàn chỉnh', mainX + mainW / 2, 690);
    ctx.fillText('đã bao gồm phần vạt trang phục bên dưới.', mainX + mainW / 2, 715);
  }

  // 6. Centered Footer Watermark
  ctx.fillStyle = '#64748b'; // Slate gray
  ctx.font = 'italic 11px "DejaVu Sans", "FreeSans", "Liberation Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Viet Phuc Remix Studio • 2D Flatlay Outfit Grid Arrangement', width / 2, 940);

  const buf = canvas.toBuffer('image/jpeg');
  fs.writeFileSync(outputPath, buf);
  log(`Finished writing output file successfully.`);
  return buf;
}

// 2. API POST /api/remix & /api/v1/remix
const handleRemix = async (req: express.Request, res: express.Response) => {
  try {
    const body = req.body || {};
    const skin = body.skin || body.id || ['ao_tac_ngu_than'];
    const skinArr = Array.isArray(skin) ? skin : [skin];
    const pants = body.pants || [];
    const pantsArr = Array.isArray(pants) ? pants : [pants];
    const accessories = body.accessories || [];
    const accArr = Array.isArray(accessories) ? accessories : [accessories];
    const main_color = body.main_color || body.mainColor || 'Đỏ Hoàng Gia & Xanh Lam';
    const event = body.event || 'Sự Kiện Cổ Phong Truyền Thống';

    // Phân loại: Trang Phục hoàn chỉnh (Chăm, H'Mông, Quan Lại, Tây Nguyên, Dao Tiền) vs Áo rời (Áo Dài, Áo Tấc, Áo Nhật Bình, Áo Giao Lĩnh, Áo Tứ Thân, Áo Ngũ Thân, Áo Bà Ba, Áo Cóm, Áo Năm Thân)
    const TRANG_PHUC_PREFIXES = ['cham', 'mong', 'hmong', 'quanlai', 'daotien', 'taynguyen'];
    const skinName = skinArr.length > 0 ? String(skinArr[0]).toLowerCase() : '';
    const isTrangPhuc = TRANG_PHUC_PREFIXES.some((prefix) => skinName.startsWith(prefix) || skinName.includes(`_${prefix}_`));

    let finalPants = pantsArr;
    let warning = null;
    if (isTrangPhuc) {
      finalPants = [];
      warning = 'Trang phục hoàn chỉnh (như H\'Mông, Chăm, Quan Lại, Tây Nguyên, Dao Tiền) đã bao gồm vạt dưới.';
    } else if (pantsArr.length === 0) {
      // Đối với các dáng Áo, nếu người dùng chưa chọn quần, tự động gán quần tương thích theo giới tính
      const isNu = skinName.includes('_nu_');
      finalPants = [isNu ? 'quan_so_nu_1' : 'quan_so_nam_1'];
      warning = `Hệ thống tự động phối thêm quần [${finalPants[0].toUpperCase()}] cho áo để bức ảnh Flatlay hoàn hảo nhất.`;
    }

    // Xoá các ảnh tạm đã hết hạn (cũ hơn 3 phút) để tránh xung đột phiên hoạt động song song
    if (fs.existsSync(TEMP_DIR)) {
      const now = Date.now();
      const existingTempFiles = fs.readdirSync(TEMP_DIR);
      for (const file of existingTempFiles) {
        if (!file.startsWith('.')) {
          const filePath = path.join(TEMP_DIR, file);
          try {
            const stat = fs.statSync(filePath);
            if (stat.isFile()) {
              const ageMs = now - stat.mtimeMs;
              if (ageMs > 3 * 60 * 1000) { // 3 phút bảo vệ
                fs.unlinkSync(filePath);
              }
            }
          } catch (e) {
            // Bỏ qua nếu file đang bị lock hoặc đã bị xóa
          }
        }
      }
    }

    // Ghép và Render Flatlay Composite Image (.jpg)
    const timestamp = Date.now();
    const filename = `remix_temp_${timestamp}.jpg`;
    const tempFilePath = path.join(TEMP_DIR, filename);

    const compositeBuffer = await renderFlatlayCompositeImage({
      skinId: skinArr[0] || '',
      pantsId: finalPants[0] || '',
      accIds: accArr,
      mainColor: main_color,
      event,
      outputPath: tempFilePath,
    });

    // Tải ảnh trực tiếp lên Supabase Storage bucket 'images' thư mục temp/
    const storageTempPath = `temp/${filename}`;
    const { publicUrl: supabaseImageUrl, error: uploadErr } = await uploadToSupabaseImagesBucket(
      storageTempPath,
      compositeBuffer,
      'image/jpeg'
    );

    const allItems = generateFullItemList();
    let skinItem = allItems.find((i: any) => i.id === skinArr[0])
      || allItems.find((i: any) => skinArr[0] && i.id.startsWith(skinArr[0].split('_').slice(0, 3).join('_')))
      || { name: '', image_filename: '' };
    let pantsItem = allItems.find((i: any) => i.id === finalPants[0]) || { name: '', image_filename: '' };
    let accItem = allItems.find((i: any) => i.id === accArr[0]) || { name: '', image_filename: '' };

    // Tên hiển thị người dùng thân thiện, trang trọng, 100% tiếng Việt có dấu
    let skinNameDisplay = skinItem.name;
    if (!skinNameDisplay) {
      const parts = (skinArr[0] || '').split('_');
      const p = parts[0]?.toLowerCase();
      const g = parts[1] === 'nam' ? 'Nam' : 'Nữ';
      const c = Object.keys(COLOR_TITLE_MAP).find(k => k.toLowerCase() === parts[2]?.toLowerCase()) || parts[2] || '';
      const colorTitle = COLOR_TITLE_MAP[c] || c;
      const outfitTitle = OUTFIT_NAME_MAP[p] || 'Trang Phục Cổ Phong';
      skinNameDisplay = `${outfitTitle} (${g}) - Tông ${colorTitle}`;
    }

    let pantsNameDisplay = pantsItem.name;
    if (!pantsNameDisplay) {
      const pId = finalPants[0] || '';
      pantsNameDisplay = PANTS_METADATA_MAP[pId]?.name || 'Quần Sa Nam Trắng';
    }

    const accNames = accArr
      .map((id: string) => {
        const found = allItems.find((i: any) => i.id === id);
        if (found && found.name) return found.name;
        if (ACCESSORY_METADATA_MAP[id]) return ACCESSORY_METADATA_MAP[id].name;
        return id.replace(/_/g, ' ');
      })
      .filter(Boolean);

    const accDisplay = accNames.length > 0 ? accNames.join(', ') : 'không kèm phụ kiện phụ';

    const skinsStr = skinNameDisplay;
    const accStr = accDisplay;
    const pantsStr = isTrangPhuc ? 'Đã bao gồm trong bộ trang phục' : pantsNameDisplay;

    // Cấu trúc Prompt Flatlay thu nhỏ tỷ lệ & chừa khoảng trống
    const positivePrompt = `Góc máy chụp từ trên cao nhìn thẳng xuống (top-down view) một mặt sàn studio màu trắng sáng. Phong cách nhiếp ảnh bố cục trải phẳng (fashion flatlay). QUAN TRỌNG: Thu nhỏ tỷ lệ tất cả quần áo. Phải chừa nhiều không gian trống (negative space) ở các góc cạnh. Toàn bộ set đồ phải nằm trọn vẹn bên trong khung hình. Chính giữa phía trên: ${skinsStr}, trải phẳng phiu tuyệt đối trên mặt sàn, không có độ phồng. Chính giữa phía dưới: ${pantsStr}, trải phẳng nằm ngay bên dưới chiếc áo. Xung quanh các góc: ${accStr}, sắp xếp gọn gàng bao quanh trang phục. Tất cả vật phẩm phải nằm tách biệt nhau giống như quần áo búp bê giấy 2D. Ánh sáng tự nhiên, không có bóng râm đen. Tông màu: ${main_color}. Concept: ${event}.`;

    const negativePrompt = `3D, ma-nơ-canh, ma-nơ-canh tàng hình, dáng đứng, người vô hình, đang mặc đồ, cơ thể người, có độ phồng, lồi lõm, nền tối, nền đen, ảnh chân dung dọc, trôi nổi, render 3D, gấp nếp, nhăn nheo, tối tăm, cắt viền, phóng to quá mức.`;

    const skinImgUrl = toAssetUrl(skinItem.image_filename || (skinArr[0] ? (() => { let p = findBestJpgForSkin(skinArr[0]); let rel = p.substring(p.indexOf('src/assets')); return '/' + rel; })() : ''));
    const pantsImgUrl = isTrangPhuc ? '' : toAssetUrl(pantsItem.image_filename || (finalPants[0] ? (() => { let p = findBestJpgForPants(finalPants[0]); let rel = p.substring(p.indexOf('src/assets')); return '/' + rel; })() : ''));
    const accImgUrl = toAssetUrl(accItem.image_filename || (accArr[0] ? (() => { let p = findBestJpgForAccessory(accArr[0]); let rel = p.substring(p.indexOf('src/assets')); return '/' + rel; })() : ''));

    const promptAo = `Trang phục: ${skinNameDisplay}, màu ${main_color}. Chụp chính diện (flat front view), căn giữa, nền trơn phẳng (#000000 hoặc trắng). Không có người mặc. Siêu thực, 8k.`;
    const promptQuan = `Trang phục: ${isTrangPhuc ? 'Đã bao gồm trong bộ trang phục' : pantsNameDisplay}. Chụp chính diện, trải phẳng, căn giữa, nền trơn phẳng. Không có người mặc. Siêu thực, 8k.`;
    const promptPhuKien = `Phụ kiện: ${accItem.name || accArr[0]}. Chụp chính diện, căn giữa, nền trơn phẳng. Siêu thực, 8k.`;

    // Đánh giá quy chuẩn văn hóa & lễ nghi thực tế dựa trên bối cảnh sự kiện và màu sắc trang phục
    const detectedColorFolder = skinItem.colorFolder || (skinArr[0] || '').split('_')[2] || '';

    const evaluation = evaluateCulturalAttireAndEtiquette({
      skinId: skinArr[0] || '',
      skinNameDisplay,
      colorFolder: detectedColorFolder,
      colorTitle: main_color,
      pantsNameDisplay,
      accDisplay,
      accNames,
      event,
      isTrangPhuc
    });

    const matchScore = evaluation.score;
    const matchingAnalysis = evaluation.matchingAnalysis;

    const relativePath = toAssetUrl(`/src/assets/images/system/temp/${filename}`);
    // ƯU TIÊN TRẢ VỀ ĐƯỜNG DẪN CÔNG KHAI CỦA SUPABASE STORAGE
    const finalImageUrl = supabaseImageUrl || relativePath;

    // Lưu vào bảng saved_remixes trên Supabase
    if (supabaseImageUrl) {
      try {
        await supabase.from('saved_remixes').insert({
          filename,
          storage_path: storageTempPath,
          public_url: supabaseImageUrl,
          skin_id: skinArr[0] || null,
          pants_id: finalPants[0] || null,
          accessory_ids: accArr,
          main_color,
          event,
          match_score: matchScore,
          matching_analysis: matchingAnalysis,
        });
      } catch (logErr) {
        console.warn('Lỗi ghi saved_remixes vào Supabase:', logErr);
      }
    }

    return res.json({
      success: true,
      status: 'success',
      image: filename,
      matching_analysis: matchingAnalysis,
      match_score: matchScore,
      image_url: finalImageUrl,
      export_url: finalImageUrl,
      public_url: supabaseImageUrl || null,
      storage_provider: supabaseImageUrl ? 'supabase' : 'local',
      supabase_bucket: SUPABASE_BUCKET,
      output_export_format: `[Output Export]: ${finalImageUrl}`,
      warning,
      slots: {
        ao: {
          title: 'Ô Áo (Chính giữa)',
          item_name: skinItem.name || skinArr[0],
          image_url: skinImgUrl,
          prompt: promptAo
        },
        quan: {
          title: 'Ô Quần (Bên dưới)',
          item_name: isTrangPhuc ? 'Đã bao gồm trong bộ trang phục' : (pantsItem.name || finalPants[0]),
          image_url: pantsImgUrl,
          prompt: promptQuan
        },
        phukien: {
          title: 'Ô Phụ kiện 2 (Góc trái)',
          item_name: accItem.name || accArr[0],
          image_url: accImgUrl,
          prompt: promptPhuKien
        }
      },
      knolling_prompt: positivePrompt,
      negative_prompt: negativePrompt,
      validated_payload: {
        skin: skinArr,
        pants: finalPants,
        accessories: accArr,
        main_color,
        event,
      },
      message: supabaseImageUrl
        ? 'Hệ thống Remix đã tạo ảnh và tải trực tiếp lên Supabase Storage bucket "images" thành công!'
        : 'Hệ thống Remix đã tạo ảnh thành công cục bộ (Hãy chạy script SQL trên Supabase để cấp quyền bucket "images").',
    });
  } catch (err: any) {
    console.error('Lỗi trong xử lý remix:', err);
    return res.status(500).json({
      success: false,
      message: 'Không thể xử lý yêu cầu remix',
      error: err.message,
    });
  }
};

app.post('/api/remix', handleRemix);
app.post('/api/v1/remix', handleRemix);

// 3. API POST /api/save & /api/v1/save
const handleSave = async (req: express.Request, res: express.Response) => {
  try {
    const { image_filename } = req.body || {};

    let sourceFilename = '';
    if (image_filename) {
      sourceFilename = sanitizeFilename(image_filename);
      const testPath = path.join(TEMP_DIR, sourceFilename);
      if (!fs.existsSync(testPath)) {
        return res.status(404).json({
          success: false,
          message: `Không tìm thấy file '${sourceFilename}' trong thư mục temp.`,
        });
      }
    } else {
      const files = fs.readdirSync(TEMP_DIR).filter((f) => !f.startsWith('.'));
      if (files.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Thư mục temp hiện tại không có ảnh nào để lưu. Vui lòng bấm Remix trước.',
        });
      }
      const sorted = files.sort((a, b) => {
        return fs.statSync(path.join(TEMP_DIR, b)).mtimeMs - fs.statSync(path.join(TEMP_DIR, a)).mtimeMs;
      });
      sourceFilename = sorted[0];
    }

    const sourcePath = path.join(TEMP_DIR, sourceFilename);
    const ext = path.extname(sourceFilename);
    const targetFilename = `user_remix_${Date.now()}${ext}`;
    const targetPath = path.join(USER_DIR, targetFilename);

    // Lưu vào ổ đĩa cục bộ
    fs.copyFileSync(sourcePath, targetPath);
    const relativePath = toAssetUrl(`/src/assets/images/user/${targetFilename}`);

    // Tải ảnh trực tiếp lên Supabase Storage bucket 'images' thư mục user/
    let supabaseUserUrl: string | null = null;
    let storageError: string | null = null;
    try {
      const fileBuffer = fs.readFileSync(targetPath);
      const storageUserPath = `user/${targetFilename}`;
      const { publicUrl, error: upError } = await uploadToSupabaseImagesBucket(
        storageUserPath,
        fileBuffer,
        'image/jpeg'
      );
      supabaseUserUrl = publicUrl;
      storageError = upError || null;
    } catch (saveErr: any) {
      console.warn('Lỗi upload ảnh user lên Supabase Storage:', saveErr.message);
      storageError = saveErr.message;
    }

    const finalUrl = supabaseUserUrl || relativePath;

    return res.json({
      success: true,
      message: supabaseUserUrl
        ? 'Lưu ảnh thành công lên Supabase Storage bucket "images"!'
        : 'Đã lưu ảnh cục bộ (Hãy chạy script SQL trên Supabase để cấp quyền bucket "images").',
      file_path: finalUrl,
      filename: targetFilename,
      url: finalUrl,
      public_url: supabaseUserUrl || null,
      storage_provider: supabaseUserUrl ? 'supabase' : 'local',
      bucket: SUPABASE_BUCKET,
      saved_at: new Date().toISOString(),
      storage_error: storageError,
    });
  } catch (err: any) {
    console.error('Lỗi khi lưu ảnh sang user folder:', err);
    return res.status(500).json({
      success: false,
      message: 'Lỗi trong quá trình sao chép lưu ảnh',
      error: err.message,
    });
  }
};

app.post('/api/save', handleSave);
app.post('/api/v1/save', handleSave);

// ==============================================================================
// CÁC ENDPOINT SUPABASE MỚI: QUẢN LÝ DỮ LIỆU & BUCKET TRÊN CLOUD
// ==============================================================================

// 1. Kiểm tra trạng thái kết nối Supabase và đếm số bản ghi
app.get('/api/supabase/status', async (req, res) => {
  try {
    let dbStatus = 'disconnected';
    let dbCount = 0;
    let dbError: string | null = null;

    try {
      const { count, error } = await supabase
        .from('clothes_items')
        .select('*', { count: 'exact', head: true });

      if (error) {
        dbError = error.message;
        dbStatus = 'table_not_found';
      } else {
        dbStatus = 'connected';
        dbCount = count || 0;
      }
    } catch (e: any) {
      dbError = e.message;
      dbStatus = 'error';
    }

    // Kiểm tra buckets
    let storageStatus = 'unknown';
    let bucketsList: string[] = [];
    try {
      const { data: buckets, error: bError } = await supabase.storage.listBuckets();
      if (!bError && buckets) {
        bucketsList = buckets.map(b => b.name);
        storageStatus = bucketsList.includes(SUPABASE_BUCKET) ? 'ready' : 'bucket_images_missing';
      }
    } catch (e: any) {
      storageStatus = `error: ${e.message}`;
    }

    const localItems = generateFullItemList();

    return res.json({
      success: true,
      supabase_url: SUPABASE_URL,
      table_name: 'clothes_items',
      database: {
        status: dbStatus,
        remote_items_count: dbCount,
        local_items_count: localItems.length,
        error: dbError,
      },
      storage: {
        status: storageStatus,
        target_bucket: SUPABASE_BUCKET,
        existing_buckets: bucketsList,
      },
      schema_file: '/supabase_schema.sql',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Châm dữ liệu (Seed) toàn bộ 226 items vào bảng clothes_items trên Supabase
app.post('/api/supabase/seed', async (req, res) => {
  try {
    const items = generateFullItemList();
    console.log(`[Supabase Seed] Bắt đầu đồng bộ ${items.length} items lên bảng clothes_items...`);

    const chunkSize = 50;
    let seededCount = 0;
    let lastError: string | null = null;

    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      const { error } = await supabase
        .from('clothes_items')
        .upsert(chunk, { onConflict: 'id' });

      if (error) {
        console.error(`[Supabase Seed] Lỗi tại chunk [${i} - ${i + chunk.length}]:`, error.message);
        lastError = error.message;
        break;
      }
      seededCount += chunk.length;
    }

    if (lastError) {
      return res.status(500).json({
        success: false,
        message: `Đồng bộ chưa hoàn tất. Lỗi: ${lastError}. (Hãy chắc chắn bạn đã chạy file supabase_schema.sql trên Supabase SQL Editor trước).`,
        seeded_count: seededCount,
        total_items: items.length,
        error: lastError,
      });
    }

    return res.json({
      success: true,
      message: `Đồng bộ thành công ${seededCount}/${items.length} vật phẩm lên bảng 'clothes_items' của Supabase!`,
      seeded_count: seededCount,
      total_items: items.length,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Trả về nội dung schema SQL cho Frontend hiển thị hoặc tải về
app.get('/api/supabase/schema', (req, res) => {
  try {
    const sqlPath = path.resolve(__dirname, 'supabase_schema.sql');
    if (fs.existsSync(sqlPath)) {
      const content = fs.readFileSync(sqlPath, 'utf8');
      return res.json({ success: true, sql: content, filename: 'supabase_schema.sql' });
    }
    return res.status(404).json({ success: false, message: 'Chưa tìm thấy supabase_schema.sql' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ==============================================================================
// CÁC ENDPOINT GOOGLE SHEETS & GOOGLE DRIVE: ĐỒNG BỘ DỮ LIỆU SANG SUPABASE
// ==============================================================================

// 1. POST /api/admin/sync-sheets & /api/sync-sheets
const handleSyncSheets = async (req: express.Request, res: express.Response) => {
  try {
    const body = req.body || {};
    const sheetId = body.sheet_id || process.env.GOOGLE_SHEET_ID || '1hAOAiuqgILU_qpoyWoXN2t4CPDdBoTEQHEzduhDe-zI';
    const sheetRange = body.sheet_range || process.env.GOOGLE_SHEET_RANGE || 'Items!A1:Z';
    const credentials = body.service_account_credentials || body.credentials;
    const dryRun = Boolean(body.dry_run);
    const chunkSize = Number(body.chunk_size) || 50;

    if (!sheetId) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu Google Sheet ID! Vui lòng cấu hình biến môi trường GOOGLE_SHEET_ID hoặc gửi kèm thuộc tính { "sheet_id": "..." } trong body request.',
        instruction: 'Lấy ID từ đường dẫn Google Sheet: https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit'
      });
    }

    const result = await syncGoogleSheetToSupabase(supabase, {
      sheetId,
      range: sheetRange,
      serviceAccountCredentials: credentials,
      chunkSize,
      dryRun
    });

    const statusCode = result.success ? 200 : 500;
    return res.status(statusCode).json(result);
  } catch (err: any) {
    console.error('Lỗi trong /api/admin/sync-sheets:', err);
    return res.status(500).json({
      success: false,
      message: `Quá trình đồng bộ Google Sheets sang Supabase thất bại: ${err.message}`,
      error: err.message
    });
  }
};

app.post('/api/admin/sync-sheets', handleSyncSheets);
app.post('/api/sync-sheets', handleSyncSheets);
app.post('/api/v1/admin/sync-sheets', handleSyncSheets);

// 2. GET /api/admin/sync-sheets/status & /api/admin/sheets-status
const handleSheetsStatus = async (req: express.Request, res: express.Response) => {
  try {
    const creds = resolveServiceAccountCredentials();
    const sheetId = process.env.GOOGLE_SHEET_ID || null;
    const sheetRange = process.env.GOOGLE_SHEET_RANGE || 'Items!A1:Z';
    const driveFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || null;

    let dbCount = 0;
    let driveCount = 0;
    let supabaseStatus = 'disconnected';

    try {
      const { data, count, error } = await supabase
        .from('clothes_items')
        .select('id, image_filename', { count: 'exact' });

      if (!error && data) {
        dbCount = count || data.length;
        driveCount = data.filter(i =>
          (i.image_filename || '').includes('drive.google.com') ||
          (i.image_filename || '').includes('googleusercontent.com')
        ).length;
        supabaseStatus = 'connected';
      }
    } catch (e: any) {
      supabaseStatus = `error: ${e.message}`;
    }

    return res.json({
      success: true,
      service: 'Google Sheets & Drive Sync Service',
      service_account: {
        configured: Boolean(creds && creds.client_email),
        client_email: creds ? creds.client_email : null,
        project_id: creds ? creds.project_id : null,
        credentials_file_found: fs.existsSync(path.resolve(process.cwd(), 'credentials.json')),
      },
      google_sheet: {
        configured: Boolean(sheetId),
        sheet_id: sheetId,
        sheet_range: sheetRange,
        sheet_url: sheetId ? `https://docs.google.com/spreadsheets/d/${sheetId}/edit` : null,
      },
      google_drive: {
        folder_id: driveFolderId,
        folder_url: driveFolderId ? `https://drive.google.com/drive/folders/${driveFolderId}` : null,
      },
      supabase: {
        status: supabaseStatus,
        total_items: dbCount,
        drive_direct_links_count: driveCount,
        local_or_storage_links_count: dbCount - driveCount,
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

app.get('/api/admin/sync-sheets/status', handleSheetsStatus);
app.get('/api/admin/sheets-status', handleSheetsStatus);

// 3. GET /api/admin/sheets-template & /api/admin/sheets-template/csv
app.get('/api/admin/sheets-template', (req, res) => {
  try {
    const localItems = generateFullItemList() as ClothesItemRecord[];
    const rows = generateGoogleSheetTemplateData(localItems);
    return res.json({
      success: true,
      headers: rows[0],
      total_rows: rows.length - 1,
      rows: rows,
      instruction: 'Copy các dòng này dán vào Google Sheet tab "Items" hoặc dùng nút "Tải CSV".'
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/admin/sheets-template/csv', (req, res) => {
  try {
    const localItems = generateFullItemList() as ClothesItemRecord[];
    const rows = generateGoogleSheetTemplateData(localItems);
    const csvContent = rows
      .map((r: any[]) => r.map((cell: any) => `"${String(cell || '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="viet_phuc_google_sheets_template.csv"');
    return res.send('\uFEFF' + csvContent); // BOM UTF-8 for Excel
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint kiểm tra trạng thái các thư mục hệ thống
app.get('/api/system/folders', (req, res) => {
  try {
    const clothesFiles = fs.existsSync(CLOTHES_DIR) ? fs.readdirSync(CLOTHES_DIR).filter((f) => !f.startsWith('.')) : [];
    const tempFiles = fs.existsSync(TEMP_DIR) ? fs.readdirSync(TEMP_DIR).filter((f) => !f.startsWith('.')) : [];
    const userFiles = fs.existsSync(USER_DIR)
      ? fs.readdirSync(USER_DIR).filter((f) => {
          if (f.startsWith('.')) return false;
          const fullP = path.join(USER_DIR, f);
          try {
            if (!fs.statSync(fullP).isFile()) return false;
            const ext = path.extname(f).toLowerCase();
            return ['.jpg', '.jpeg', '.png', '.webp', '.svg'].includes(ext);
          } catch {
            return false;
          }
        })
      : [];

    const colorsFolderData: Record<string, any> = {};
    COLOR_NAMES.forEach((cName: string, idx: number) => {
      const namPath = path.join(COLORS_DIR, cName, 'Nam');
      const nuPath = path.join(COLORS_DIR, cName, 'Nu');
      const namFiles = fs.existsSync(namPath) ? fs.readdirSync(namPath).filter((f) => !f.startsWith('.')) : [];
      const nuFiles = fs.existsSync(nuPath) ? fs.readdirSync(nuPath).filter((f) => !f.startsWith('.')) : [];
      colorsFolderData[cName] = {
        color_number: idx + 1,
        folder: cName,
        nam_count: namFiles.length,
        nu_count: nuFiles.length,
        total_count: namFiles.length + nuFiles.length,
      };
    });

    const pantsFiles = fs.existsSync(PANTS_DIR) ? fs.readdirSync(PANTS_DIR).filter((f) => !f.startsWith('.')) : [];
    const accessoriesFiles = fs.existsSync(ACCESSORIES_DIR) ? fs.readdirSync(ACCESSORIES_DIR).filter((f) => !f.startsWith('.')) : [];

    return res.json({
      colors_folders: colorsFolderData,
      pants_folder: {
        path: 'src/assets/images/system/Pants',
        count: pantsFiles.length,
        files: pantsFiles,
      },
      accessories_folder: {
        path: 'src/assets/images/system/Accessories',
        count: accessoriesFiles.length,
        files: accessoriesFiles,
      },
      clothes_folder: {
        path: 'src/assets/images/system/clothes',
        count: clothesFiles.length,
        files: clothesFiles,
      },
      temp_folder: {
        path: 'src/assets/images/system/temp',
        count: tempFiles.length,
        files: tempFiles,
      },
      user_folder: {
        path: 'src/assets/images/user',
        count: userFiles.length,
        files: userFiles,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Phục vụ Privacy Policy
const privacyHtmlPath = path.resolve(PUBLIC_DIR, 'privacy.html');
app.get(['/privacy', '/privacy/', '/privacy.html', '/privacy-policy'], (req, res) => {
  if (fs.existsSync(privacyHtmlPath)) {
    return res.sendFile(privacyHtmlPath);
  }
  return res.status(404).send('Privacy policy file not found.');
});

// Phục vụ Admin & Dev Dashboard UI
const adminHtmlPath = path.resolve(__dirname, 'backend', 'public', 'index.html');
app.use('/backend/public', express.static(path.resolve(__dirname, 'backend', 'public')));
app.get(['/admin', '/admin/', '/dev', '/dev/', '/backend/admin', '/backend/dev', '/admin-dashboard'], (req, res) => {
  if (fs.existsSync(adminHtmlPath)) {
    return res.sendFile(adminHtmlPath);
  }
  return res.status(404).send('Admin dashboard file not found.');
});

// Khởi động server kết hợp Vite middlewares
async function startServer() {
  if (isDev) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      root: FRONTEND_DIR,
      server: { 
        middlewareMode: true,
        hmr: false
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    const frontendDist = path.resolve(FRONTEND_DIR, 'dist');
    const targetDist = fs.existsSync(distPath) ? distPath : (fs.existsSync(frontendDist) ? frontendDist : null);
    if (targetDist) {
      app.use(express.static(targetDist));
      app.get('*', (req, res) => {
        const indexPath = path.resolve(targetDist, 'index.html');
        if (fs.existsSync(indexPath)) {
          return res.sendFile(indexPath);
        }
        res.status(404).send('Index HTML not found in dist.');
      });
    } else {
      app.use(express.static(FRONTEND_DIR));
      app.get('*', (req, res) => {
        const indexPath = path.resolve(FRONTEND_DIR, 'index.html');
        if (fs.existsSync(indexPath)) {
          return res.sendFile(indexPath);
        }
        res.status(404).send('Index HTML not found in frontend.');
      });
    }
  }

  // Middleware bắt lỗi toàn cục (Global Error Handler) - Đảm bảo luôn trả response, không bao giờ ngâm request
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[Global Express Error]:', err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ', error: err?.message || String(err) });
    }
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Backend Server] Đang chạy tại http://0.0.0.0:${PORT}`);
  });
}

startServer();
