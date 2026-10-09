import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_ASSETS = path.resolve(__dirname, '..', 'src', 'assets');
const COLORS_DIR = path.resolve(BASE_ASSETS, 'images', 'system', 'Colors');
const PANTS_DIR = path.resolve(BASE_ASSETS, 'images', 'system', 'Pants');
const ACCESSORIES_DIR = path.resolve(BASE_ASSETS, 'images', 'system', 'Accessories');

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
  'tuthan': 'Áo Tứ Thân',
  'aocom': 'Áo Cắm',
  'aonamthan': 'Áo Năm Thân',
  'daotien': 'Trang Phục Dao Tiền',
  'nhatbinh': 'Áo Nhật Bình'
};

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

function toAssetUrl(filePathOrRel: string): string {
  if (!filePathOrRel) return '';
  let clean = filePathOrRel.replace(/\\/g, '/');
  if (clean.includes('src/assets')) {
    clean = clean.substring(clean.indexOf('src/assets') + 4);
  }
  if (!clean.startsWith('/')) {
    clean = '/' + clean;
  }
  return clean;
}

const OUTFIT_TYPES_NAM = ['aodai', 'aotac', 'baba', 'cham', 'giaolinh', 'mong', 'nguthan', 'quanlai', 'taynguyen', 'tuthan'];
const OUTFIT_TYPES_NU = ['aobaba', 'aocom', 'aodai', 'aonamthan', 'aotac', 'daotien', 'hmong', 'nguthan', 'nhatbinh', 'tuthan'];

export function generateItems() {
  let allItems: any[] = [];

  // 1. 200 Skins across 10 Colors x 2 Genders x 10 Outfit Types
  COLOR_NAMES.forEach(c => {
    ['Nam', 'Nu'].forEach(g => {
      const outfitTypes = g === 'Nam' ? OUTFIT_TYPES_NAM : OUTFIT_TYPES_NU;
      outfitTypes.forEach((prefix, idx) => {
        const outfitTitle = OUTFIT_NAME_MAP[prefix] || 'Trang Phục Cổ Phong';
        const colorTitle = COLOR_TITLE_MAP[c] || c;
        const genderTitle = g === 'Nam' ? 'Nam' : 'Nữ';
        const itemId = `${prefix}_${g.toLowerCase()}_${c.toLowerCase()}_${idx}`;
        const driveUrl = `https://drive.google.com/uc?export=view&id=1vietphuc_${c.toLowerCase()}_${g.toLowerCase()}_${prefix}`;

        allItems.push({
          id: itemId,
          name: `${outfitTitle} (${genderTitle}) - Tông ${colorTitle}`,
          category: 'skin',
          gender: g,
          colorFolder: c,
          colorName: colorTitle,
          image_filename: driveUrl,
          description: `${outfitTitle} thiết kế truyền thống dành cho ${genderTitle} phối tông màu ${colorTitle} quý phái.`,
          suitable_events: ['Lễ cưới cổ phong', 'Tết Nguyên Đán', 'Dạ hội văn hóa'],
          recommended_colors: [colorTitle]
        });
      });
    });
  });

  // 2. 6 Pants items
  Object.keys(PANTS_METADATA_MAP).forEach((base) => {
    const isNam = base.includes('nam');
    const meta = PANTS_METADATA_MAP[base];
    const driveUrl = `https://drive.google.com/uc?export=view&id=1vietphuc_pants_${base}`;
    allItems.push({
      id: base,
      name: meta.name,
      category: 'pants',
      gender: isNam ? 'Nam' : 'Nữ',
      colorFolder: null,
      colorName: null,
      image_filename: driveUrl,
      description: meta.description,
      suitable_events: ['Lễ cưới cổ phong', 'Tết Nguyên Đán', 'Sự kiện văn hóa'],
      recommended_colors: ['Trắng', 'Đen', 'Mỡ Gà']
    });
  });

  // 3. 20 Accessories items
  Object.keys(ACCESSORY_METADATA_MAP).forEach((base) => {
    const isNam = base.includes('nam');
    const isNu = base.includes('nu');
    const meta = ACCESSORY_METADATA_MAP[base];
    const driveUrl = `https://drive.google.com/uc?export=view&id=1vietphuc_accessory_${base}`;
    allItems.push({
      id: base,
      name: meta.name,
      category: 'accessory',
      gender: isNam ? 'Nam' : (isNu ? 'Nữ' : 'Chung'),
      colorFolder: null,
      colorName: null,
      image_filename: driveUrl,
      description: meta.description,
      suitable_events: ['Lễ nghi truyền thống', 'Lễ hội', 'Dạ yến'],
      recommended_colors: ['Vàng', 'Bạc', 'Ngọc Bích']
    });
  });

  return allItems;
}

const items = generateItems();
console.log('Total items count:', items.length);
console.log('Sample item:', items[0]);
console.log('Category distribution:', {
  skins: items.filter(i => i.category === 'skin').length,
  pants: items.filter(i => i.category === 'pants').length,
  accessories: items.filter(i => i.category === 'accessory').length
});
