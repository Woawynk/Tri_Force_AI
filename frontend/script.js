import { PRESET_ITEMS_MAP } from './preset_items.js';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://zertfkpvzmtckgbmleql.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplcnRma3B2em10Y2tnYm1sZXFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwNzQ2NDQsImV4cCI6MjEwNjY1MDY0NH0.vCmXTwe6o2S4xPIMVtYqGmOGpjuL7RgI2chmzOXPSiY';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Việt Phục Remix Studio
 * JavaScript thuần (Vanilla JS)
 * - Menu bar chuyển tab mượt mà bằng Hide/Show (.active-window)
 * - Quản lý 3 bước phối đồ tại Window 3:
 *   + Bước 1: 5 Không gian chủ đạo + ô điền nơi khác; 5 Thời gian chủ yếu (Ban đêm dùng ảnh hoa đăng thực tế)
 *   + Bước 2: 
 *     * Áo: Phân theo Nam / Nữ, 10 loại áo, 10 bảng màu truyền thống (chọn màu đổi ngay lập tức ảnh tương ứng từ dataset 200 bộ)
 *     * Quần: Thư mục Pants phân theo Nam / Nữ (3 mẫu nam, 3 mẫu nữ)
 *     * Phụ kiện: 20 món chuẩn từ Accessories, GIỚI HẠN TỐI ĐA 4 MÓN
 *   + Bước 3: Kết quả phối đồ dừng chuẩn xác ở số 3 (không lồi ra phía sau), hiển thị áo + quần + tối đa 4 phụ kiện,
 *     % độ phù hợp văn hóa, đánh giá remix, cảnh báo lễ nghi, tích hợp zoom ảnh, tải ảnh, chia sẻ không bị 404
 * - Lật flashcard ở Window 4 (đã xóa chữ Mặt Sau)
 * - Popups Đăng nhập & Đăng ký ở trung tâm màn hình
 */

document.addEventListener('DOMContentLoaded', () => {

  // =========================================================================
  // 1. CHUYỂN TAB MENU BAR BẰNG HIDE / SHOW MƯỢT MÀ & HAMBURGER RESPONSIVE
  // =========================================================================

  const navTabButtons = document.querySelectorAll('.nav-tab-btn');
  const windowSections = document.querySelectorAll('.window-section');
  const hamburgerBtn = document.getElementById('btn-hamburger');
  const mobileNavDrawer = document.getElementById('mobile-nav-drawer');
  const mobileNavBackdrop = document.getElementById('mobile-nav-backdrop');
  const btnCloseMobileNav = document.getElementById('btn-close-mobile-nav');

  function openMobileNav() {
    if (mobileNavDrawer && mobileNavBackdrop) {
      mobileNavDrawer.classList.add('open');
      mobileNavBackdrop.classList.add('open');
      if (hamburgerBtn) {
        hamburgerBtn.classList.add('open');
        hamburgerBtn.setAttribute('aria-expanded', 'true');
      }
      document.body.style.overflow = 'hidden';
    }
  }

  function closeMobileNav() {
    if (mobileNavDrawer && mobileNavBackdrop) {
      mobileNavDrawer.classList.remove('open');
      mobileNavBackdrop.classList.remove('open');
      if (hamburgerBtn) {
        hamburgerBtn.classList.remove('open');
        hamburgerBtn.setAttribute('aria-expanded', 'false');
      }
      document.body.style.overflow = '';
    }
  }

  if (hamburgerBtn) {
    hamburgerBtn.addEventListener('click', () => {
      if (mobileNavDrawer && mobileNavDrawer.classList.contains('open')) {
        closeMobileNav();
      } else {
        openMobileNav();
      }
    });
  }

  if (btnCloseMobileNav) {
    btnCloseMobileNav.addEventListener('click', closeMobileNav);
  }

  if (mobileNavBackdrop) {
    mobileNavBackdrop.addEventListener('click', closeMobileNav);
  }

  window.addEventListener('resize', () => {
    if (window.innerWidth > 992) {
      closeMobileNav();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMobileNav();
    }
  });

  let currentWindowIdx = 1;
  let isWindowTransitioning = false;

  function showWindow(targetId) {
    if (isWindowTransitioning) return;
    const nextIdx = parseInt(targetId.replace('window-', '')) || 1;
    if (nextIdx === currentWindowIdx && document.getElementById(targetId)?.classList.contains('active-window')) {
      closeMobileNav();
      return;
    }

    const isForward = nextIdx >= currentWindowIdx;
    const oldWindowId = `window-${currentWindowIdx}`;
    const oldSection = document.getElementById(oldWindowId);
    const newSection = document.getElementById(targetId);

    if (!newSection) return;

    isWindowTransitioning = true;
    currentWindowIdx = nextIdx;

    // Cập nhật trạng thái nút Menu Tab
    navTabButtons.forEach(btn => {
      if (btn.getAttribute('data-target') === targetId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    closeMobileNav();

    if (oldSection && oldSection !== newSection && oldSection.classList.contains('active-window')) {
      // Trang cũ trượt vuốt ra ngoài (trái hoặc phải)
      oldSection.classList.remove('slide-in-right', 'slide-in-left', 'slide-from-right', 'slide-from-left', 'slide-out-left', 'slide-out-right');
      void oldSection.offsetWidth;
      oldSection.classList.add(isForward ? 'slide-out-left' : 'slide-out-right');

      // Sau khi trang cũ bắt đầu trượt ra, kích hoạt trang mới trượt vào
      setTimeout(() => {
        oldSection.classList.remove('active-window', 'slide-out-left', 'slide-out-right');
        oldSection.style.display = 'none';

        windowSections.forEach(section => {
          if (section.id !== targetId) {
            section.classList.remove('active-window', 'slide-in-right', 'slide-in-left', 'slide-from-right', 'slide-from-left', 'slide-out-left', 'slide-out-right');
            section.style.display = 'none';
          }
        });

        newSection.style.display = 'flex';
        newSection.classList.remove('slide-out-left', 'slide-out-right', 'slide-in-right', 'slide-in-left', 'slide-from-right', 'slide-from-left');
        void newSection.offsetWidth; // force reflow
        newSection.classList.add('active-window', isForward ? 'slide-in-right' : 'slide-in-left');

        window.scrollTo({ top: 0, behavior: 'smooth' });

        setTimeout(() => {
          isWindowTransitioning = false;
        }, 360);
      }, 180);
    } else {
      windowSections.forEach(section => {
        if (section.id !== targetId) {
          section.classList.remove('active-window', 'slide-in-right', 'slide-in-left', 'slide-from-right', 'slide-from-left', 'slide-out-left', 'slide-out-right');
          section.style.display = 'none';
        }
      });
      newSection.style.display = 'flex';
      newSection.classList.remove('slide-out-left', 'slide-out-right');
      void newSection.offsetWidth;
      newSection.classList.add('active-window', isForward ? 'slide-in-right' : 'slide-in-left');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      isWindowTransitioning = false;
    }
  }

  navTabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      if (targetId) showWindow(targetId);
    });
  });

  const brandLogo = document.getElementById('header-brand-logo');
  if (brandLogo) {
    brandLogo.addEventListener('click', () => showWindow('window-1'));
  }

  const heroBtnStart = document.getElementById('hero-btn-start');
  if (heroBtnStart) {
    heroBtnStart.addEventListener('click', () => showWindow('window-3'));
  }

  // Mobile Auth Buttons
  const mobileBtnRegister = document.getElementById('mobile-btn-register');
  const mobileBtnLogin = document.getElementById('mobile-btn-login');
  if (mobileBtnRegister) {
    mobileBtnRegister.addEventListener('click', () => {
      closeMobileNav();
      const modalRegister = document.getElementById('modal-register');
      if (modalRegister) modalRegister.classList.add('active');
    });
  }
  if (mobileBtnLogin) {
    mobileBtnLogin.addEventListener('click', () => {
      closeMobileNav();
      const modalLogin = document.getElementById('modal-login');
      if (modalLogin) modalLogin.classList.add('active');
    });
  }

  // =========================================================================
  // 2. DATASET BẢNG MÀU, TRANG PHỤC (200 BỘ), QUẦN (PANTS), PHỤ KIỆN (20 MÓN)
  // =========================================================================

  // 10 Bảng màu truyền thống
  const COLOR_PALETTES = [
    { code: 'XichKim', name: 'Xích Kim Cung Đình', desc: 'Đỏ mận chín & vàng đồng hoàng gia', hex: '#6b0e1a' },
    { code: 'BichThuy', name: 'Bích Thủy Ngân Hà', desc: 'Xanh cổ vịt sâu & ánh bạc tinh khiết', hex: '#004d40' },
    { code: 'HuyenChu', name: 'Huyền Y Chu Sa', desc: 'Đen tuyền tuyệt đối & đỏ sậm chu sa', hex: '#0a0a0a' },
    { code: 'ThanhLam', name: 'Thanh Lam Thủy Ba', desc: 'Xanh lam đậm & vàng ánh kim tuyến', hex: '#1a237e' },
    { code: 'HoangYen', name: 'Hoàng Yến Hổ Phách', desc: 'Vàng hoàng yến vương triều & nâu trầm', hex: '#e5a910' },
    { code: 'BachNgoc', name: 'Bạch Ngọc Ngân Sương', desc: 'Trắng ngà bạch ngọc & bạc trầm nho nhã', hex: '#f8f8f2' },
    { code: 'TuKhi', name: 'Tử Khí Đông Lai', desc: 'Tím Huế quý phái & vàng ánh champagne', hex: '#4a154b' },
    { code: 'PhiThuy', name: 'Phỉ Thúy Vân Mây', desc: 'Xanh phỉ thúy ngọc bích & vàng mù tạt', hex: '#007a5e' },
    { code: 'ThoHoang', name: 'Thổ Hoàng Cổ Độ', desc: 'Nâu đất trầm tích phù sa & cam đất nung', hex: '#4e3629' },
    { code: 'LienHoa', name: 'Liên Hoa Hồng Phấn', desc: 'Hồng cánh sen tươi & trắng tơ tằm tinh khôi', hex: '#d87093' }
  ];

  // TOÀN BỘ DATASET 200 BỘ TRANG PHỤC TỪ THƯ VIỆN BACKEND SYSTEM/COLORS
  // 10 Màu x 2 Giới tính x 10 Kiểu áo = Đúng 200 bức ảnh thực tế
  const COSTUMES_DATASET = {
    "XichKim": {
      "Nam": {
        "aodai": "aodai_nam_xichkim_1790751248242.jpg",
        "aotac": "aotac_nam_xichkim_1790752938443.jpg",
        "baba": "baba_nam_xichkim_1790922859519.jpg",
        "cham": "cham_nam_xichkim_1790754962486.jpg",
        "giaolinh": "giaolinh_nam_xichkim_1790752906819.jpg",
        "mong": "mong_nam_xichkim_1790753921678.jpg",
        "nguthan": "nguthan_nam_xichkim_1790750732187.jpg",
        "quanlai": "quanlai_nam_xichkim_1790752925253.jpg",
        "taynguyen": "taynguyen_nam_xichkim_1790921861724.jpg",
        "tuthan": "tuthan_nam_xichkim_1790922740405.jpg"
      },
      "Nu": {
        "aobaba": "aobaba_nu_xichkim_1790760168196.jpg",
        "aocom": "aocom_nu_xichkim_1790757358357.jpg",
        "aodai": "aodai_nu_xichkim_1790759852241.jpg",
        "aonamthan": "aonamthan_nu_xichkim_1790759524622.jpg",
        "aotac": "aotac_nu_xichkim_1790758895441.jpg",
        "daotien": "daotien_nu_xichkim_1790760514491.jpg",
        "hmong": "hmong_nu_xichkim_1790761016564.jpg",
        "nguthan": "nguthan_nu_xichkim_1790758491192.jpg",
        "nhatbinh": "nhatbinh_nu_xichkim_1790757699655.jpg",
        "tuthan": "tuthan_nu_xichkim_1790759230357.jpg"
      }
    },
    "BichThuy": {
      "Nam": {
        "aodai": "aodai_nam_bichthuy_1790751261365.jpg",
        "aotac": "aotac_nam_bichthuy_1790751017950.jpg",
        "baba": "baba_nam_bichthuy_1790922120669.jpg",
        "cham": "cham_nam_bichthuy_1790755057379.jpg",
        "giaolinh": "giaolinh_nam_bichthuy_1790750404009.jpg",
        "mong": "mong_nam_bichthuy_1790754060298.jpg",
        "nguthan": "nguthan_nam_bichthuy_1790750747017.jpg",
        "quanlai": "quanlai_nam_bichthuy_1790752076968.jpg",
        "taynguyen": "taynguyen_nam_bichthuy_1790752358721.jpg",
        "tuthan": "tuthan_nam_bichthuy_1790751797029.jpg"
      },
      "Nu": {
        "aobaba": "aobaba_nu_bichthuy_1790760181386.jpg",
        "aocom": "aocom_nu_bichthuy_1790757370716.jpg",
        "aodai": "aodai_nu_bichthuy_1790759868960.jpg",
        "aonamthan": "aonamthan_nu_bichthuy_1790759539789.jpg",
        "aotac": "aotac_nu_bichthuy_1790758924579.jpg",
        "daotien": "daotien_nu_bichthuy_1790760635120.jpg",
        "hmong": "hmong_nu_bichthuy_1790761036126.jpg",
        "nguthan": "nguthan_nu_bichthuy_1790758509285.jpg",
        "nhatbinh": "nhatbinh_nu_bichthuy_1790757714584.jpg",
        "tuthan": "tuthan_nu_bichthuy_1790759244513.jpg"
      }
    },
    "HuyenChu": {
      "Nam": {
        "aodai": "aodai_nam_huyenchu_1790751274474.jpg",
        "aotac": "aotac_nam_huyenchu_1790751030747.jpg",
        "baba": "baba_nam_huyenchu_1790922674293.jpg",
        "cham": "cham_nam_huyenchu_1790922835776.jpg",
        "giaolinh": "giaolinh_nam_huyenchu_1790750420651.jpg",
        "mong": "mong_nam_huyenchu_1790754072150.jpg",
        "nguthan": "nguthan_nam_huyenchu_1790750759563.jpg",
        "quanlai": "quanlai_nam_huyenchu_1790752091042.jpg",
        "taynguyen": "taynguyen_nam_huyenchu_1790752372232.jpg",
        "tuthan": "tuthan_nam_huyenchu_1790922795079.jpg"
      },
      "Nu": {
        "aobaba": "aobaba_nu_huyenchu_1790760194694.jpg",
        "aocom": "aocom_nu_huyenchu_1790757381566.jpg",
        "aodai": "aodai_nu_huyenchu_1790759882685.jpg",
        "aonamthan": "aonamthan_nu_huyenchu_1790759551995.jpg",
        "aotac": "aotac_nu_huyenchu_1790758939274.jpg",
        "daotien": "daotien_nu_huyenchu_1790760528167.jpg",
        "hmong": "hmong_nu_huyenchu_1790761052748.jpg",
        "nguthan": "nguthan_nu_huyenchu_1790758526470.jpg",
        "nhatbinh": "nhatbinh_nu_huyenchu_1790757728416.jpg",
        "tuthan": "tuthan_nu_huyenchu_1790759256588.jpg"
      }
    },
    "ThanhLam": {
      "Nam": {
        "aodai": "aodai_nam_thanhlam_1790751287221.jpg",
        "aotac": "aotac_nam_thanhlam_1790751041688.jpg",
        "baba": "baba_nam_thanhlam_1790751567430.jpg",
        "cham": "cham_nam_thanhlam_1790755086362.jpg",
        "giaolinh": "giaolinh_nam_thanhlam_1790750435231.jpg",
        "mong": "mong_nam_thanhlam_1790754085722.jpg",
        "nguthan": "nguthan_nam_thanhlam_1790750769077.jpg",
        "quanlai": "quanlai_nam_thanhlam_1790752106203.jpg",
        "taynguyen": "taynguyen_nam_thanhlam_1790752386693.jpg",
        "tuthan": "tuthan_nam_thanhlam_1790751827538.jpg"
      },
      "Nu": {
        "aobaba": "aobaba_nu_thanhlam_1790760207297.jpg",
        "aocom": "aocom_nu_thanhlam_1790757392586.jpg",
        "aodai": "aodai_nu_thanhlam_1790759899088.jpg",
        "aonamthan": "aonamthan_nu_thanhlam_1790759563440.jpg",
        "aotac": "aotac_nu_thanhlam_1790758959400.jpg",
        "daotien": "daotien_nu_thanhlam_1790760542424.jpg",
        "hmong": "hmong_nu_thanhlam_1790761065665.jpg",
        "nguthan": "nguthan_nu_thanhlam_1790758541294.jpg",
        "nhatbinh": "nhatbinh_nu_thanhlam_1790757740836.jpg",
        "tuthan": "tuthan_nu_thanhlam_1790759268328.jpg"
      }
    },
    "HoangYen": {
      "Nam": {
        "aodai": "aodai_nam_hoangyen_1790751299046.jpg",
        "aotac": "aotac_nam_hoangyen_1790751053983.jpg",
        "baba": "baba_nam_hoangyen_1790751578799.jpg",
        "cham": "cham_nam_hoangyen_1790754981786.jpg",
        "giaolinh": "giaolinh_nam_hoangyen_1790750450202.jpg",
        "mong": "mong_nam_hoangyen_1790754097875.jpg",
        "nguthan": "nguthan_nam_hoangyen_1790750781006.jpg",
        "quanlai": "quanlai_nam_hoangyen_1790752124725.jpg",
        "taynguyen": "taynguyen_nam_hoangyen_1790752398271.jpg",
        "tuthan": "tuthan_nam_hoangyen_1790751840293.jpg"
      },
      "Nu": {
        "aobaba": "aobaba_nu_hoangyen_1790760218750.jpg",
        "aocom": "aocom_nu_hoangyen_1790757406098.jpg",
        "aodai": "aodai_nu_hoangyen_1790759912216.jpg",
        "aonamthan": "aonamthan_nu_hoangyen_1790759575472.jpg",
        "aotac": "aotac_nu_hoangyen_1790758979062.jpg",
        "daotien": "daotien_nu_hoangyen_1790760553477.jpg",
        "hmong": "hmong_nu_hoangyen_1790761079526.jpg",
        "nguthan": "nguthan_nu_hoangyen_1790758553615.jpg",
        "nhatbinh": "nhatbinh_nu_hoangyen_1790757754540.jpg",
        "tuthan": "tuthan_nu_hoangyen_1790759280134.jpg"
      }
    },
    "BachNgoc": {
      "Nam": {
        "aodai": "aodai_nam_bachngoc_1790751309823.jpg",
        "aotac": "aotac_nam_bachngoc_1790751065080.jpg",
        "baba": "baba_nam_bachngoc_1790751590309.jpg",
        "cham": "cham_nam_bachngoc_1790754994113.jpg",
        "giaolinh": "giaolinh_nam_bachngoc_1790750467887.jpg",
        "mong": "mong_nam_bachngoc_1790754109732.jpg",
        "nguthan": "nguthan_nam_bachngoc_1790750794157.jpg",
        "quanlai": "quanlai_nam_bachngoc_1790752136686.jpg",
        "taynguyen": "taynguyen_nam_bachngoc_1790752409408.jpg",
        "tuthan": "tuthan_nam_bachngoc_1790751853641.jpg"
      },
      "Nu": {
        "aobaba": "aobaba_nu_bachngoc_1790760237310.jpg",
        "aocom": "aocom_nu_bachngoc_1790757417401.jpg",
        "aodai": "aodai_nu_bachngoc_1790759924645.jpg",
        "aonamthan": "aonamthan_nu_bachngoc_1790759586229.jpg",
        "aotac": "aotac_nu_bachngoc_1790758993429.jpg",
        "daotien": "daotien_nu_bachngoc_1790874966539.jpg",
        "hmong": "hmong_nu_bachngoc_1790761098962.jpg",
        "nguthan": "nguthan_nu_bachngoc_1790758569548.jpg",
        "nhatbinh": "nhatbinh_nu_bachngoc_1790757772939.jpg",
        "tuthan": "tuthan_nu_bachngoc_1790759292866.jpg"
      }
    },
    "TuKhi": {
      "Nam": {
        "aodai": "aodai_nam_tukhi_1790751322160.jpg",
        "aotac": "aotac_nam_tukhi_1790751076280.jpg",
        "baba": "baba_nam_tukhi_1790751602354.jpg",
        "cham": "cham_nam_tukhi_1790758158575.jpg",
        "giaolinh": "giaolinh_nam_tukhi_1790750482639.jpg",
        "mong": "mong_nam_tukhi_1790754121843.jpg",
        "nguthan": "nguthan_nam_tukhi_1790750806423.jpg",
        "quanlai": "quanlai_nam_tukhi_1790752151434.jpg",
        "taynguyen": "taynguyen_nam_tukhi_1790752423433.jpg",
        "tuthan": "tuthan_nam_tukhi_1790751868041.jpg"
      },
      "Nu": {
        "aobaba": "aobaba_nu_tukhi_1790760262982.jpg",
        "aocom": "aocom_nu_tukhi_1790757428642.jpg",
        "aodai": "aodai_nu_tukhi_1790759942580.jpg",
        "aonamthan": "aonamthan_nu_tukhi_1790759638582.jpg",
        "aotac": "aotac_nu_tukhi_1790759013061.jpg",
        "daotien": "daotien_nu_tukhi_1790921372380.jpg",
        "hmong": "hmong_nu_tukhi_1790761114485.jpg",
        "nguthan": "nguthan_nu_tukhi_1790758583886.jpg",
        "nhatbinh": "nhatbinh_nu_tukhi_1790757798619.jpg",
        "tuthan": "tuthan_nu_tukhi_1790759302154.jpg"
      }
    },
    "PhiThuy": {
      "Nam": {
        "aodai": "aodai_nam_phithuy_1790751336152.jpg",
        "aotac": "aotac_nam_phithuy_1790751090098.jpg",
        "baba": "baba_nam_phithuy_1790922700552.jpg",
        "cham": "cham_nam_phithuy_1790755018698.jpg",
        "giaolinh": "giaolinh_nam_phithuy_1790750495810.jpg",
        "mong": "mong_nam_phithuy_1790754135766.jpg",
        "nguthan": "nguthan_nam_phithuy_1790750820464.jpg",
        "quanlai": "quanlai_nam_phithuy_1790752163990.jpg",
        "taynguyen": "taynguyen_nam_phithuy_1790752438810.jpg",
        "tuthan": "tuthan_nam_phithuy_1790751880468.jpg"
      },
      "Nu": {
        "aobaba": "aobaba_nu_phithuy_1790760274291.jpg",
        "aocom": "aocom_nu_phithuy_1790757441113.jpg",
        "aodai": "aodai_nu_phithuy_1790759958197.jpg",
        "aonamthan": "aonamthan_nu_phithuy_1790759600109.jpg",
        "aotac": "aotac_nu_phithuy_1790759026365.jpg",
        "daotien": "daotien_nu_phithuy_1790760591788.jpg",
        "hmong": "hmong_nu_phithuy_1790761128362.jpg",
        "nguthan": "nguthan_nu_phithuy_1790758602146.jpg",
        "nhatbinh": "nhatbinh_nu_phithuy_1790757810793.jpg",
        "tuthan": "tuthan_nu_phithuy_1790759313464.jpg"
      }
    },
    "ThoHoang": {
      "Nam": {
        "aodai": "aodai_nam_thohoang_1790751348421.jpg",
        "aotac": "aotac_nam_thohoang_1790751104860.jpg",
        "baba": "baba_nam_thohoang_1790922719656.jpg",
        "cham": "cham_nam_thohoang_1790755030279.jpg",
        "giaolinh": "giaolinh_nam_thohoang_1790750510522.jpg",
        "mong": "mong_nam_thohoang_1790754162002.jpg",
        "nguthan": "nguthan_nam_thohoang_1790750833130.jpg",
        "quanlai": "quanlai_nam_thohoang_1790752180026.jpg",
        "taynguyen": "taynguyen_nam_thohoang_1790752451381.jpg",
        "tuthan": "tuthan_nam_thohoang_1790751893816.jpg"
      },
      "Nu": {
        "aobaba": "aobaba_nu_thohoang_1790760286088.jpg",
        "aocom": "aocom_nu_thohoang_1790757451996.jpg",
        "aodai": "aodai_nu_thohoang_1790759973801.jpg",
        "aonamthan": "aonamthan_nu_thohoang_1790759612349.jpg",
        "aotac": "aotac_nu_thohoang_1790759049755.jpg",
        "daotien": "daotien_nu_thohoang_1790760604169.jpg",
        "hmong": "hmong_nu_thohoang_1790761142512.jpg",
        "nguthan": "nguthan_nu_thohoang_1790758622176.jpg",
        "nhatbinh": "nhatbinh_nu_thohoang_1790757835154.jpg",
        "tuthan": "tuthan_nu_thohoang_1790759325016.jpg"
      }
    },
    "LienHoa": {
      "Nam": {
        "aodai": "aodai_nam_lienhoa_1790753248784.jpg",
        "aotac": "aotac_nam_lienhoa_1790753592501.jpg",
        "baba": "baba_nam_lienhoa_1790753321668.jpg",
        "cham": "cham_nam_lienhoa_1790758171596.jpg",
        "giaolinh": "giaolinh_nam_lienhoa_1790753204357.jpg",
        "mong": "mong_nam_lienhoa_1790754149507.jpg",
        "nguthan": "nguthan_nam_lienhoa_1790753220364.jpg",
        "quanlai": "quanlai_nam_lienhoa_1790753280909.jpg",
        "taynguyen": "taynguyen_nam_lienhoa_1790753297524.jpg",
        "tuthan": "tuthan_nam_lienhoa_1790753266612.jpg"
      },
      "Nu": {
        "aobaba": "aobaba_nu_lienhoa_1790760297922.jpg",
        "aocom": "aocom_nu_lienhoa_1790757463452.jpg",
        "aodai": "aodai_nu_lienhoa_1790759989693.jpg",
        "aonamthan": "aonamthan_nu_lienhoa_1790759625186.jpg",
        "aotac": "aotac_nu_lienhoa_1790759063827.jpg",
        "daotien": "daotien_nu_lienhoa_1790760615650.jpg",
        "hmong": "hmong_nu_lienhoa_1790761158808.jpg",
        "nguthan": "nguthan_nu_lienhoa_1790758640760.jpg",
        "nhatbinh": "nhatbinh_nu_lienhoa_1790757854579.jpg",
        "tuthan": "tuthan_nu_lienhoa_1790759336128.jpg"
      }
    }
  };

  // THƯ MỤC QUẦN (PANTS) TỪ SYSTEM/PANTS PHÂN THEO NAM VÀ NỮ
  const PANTS_DATASET = {
    Nam: [
      { id: 'quan_so', name: 'Quần Sớ Nam', file: 'quan_so_nam_1.jpg', desc: 'Quần sớ lụa trắng thụng ống, chuẩn mực lễ phục sĩ phu thời Nguyễn.' },
      { id: 'quan_trang', name: 'Quần Lụa Trắng Nam', file: 'quan_trang_nam_2.jpg', desc: 'Lụa tơ tằm dệt trơn, màu trắng ngà thanh tao, dễ phối cùng mọi thức áo.' },
      { id: 'quan_dui', name: 'Quần Đũi Nam', file: 'quan_dui_nam_3.jpg', desc: 'Vải đũi tơ tằm dệt thô mộc, thoáng mát, phong lưu hào sảng.' }
    ],
    Nu: [
      { id: 'quan_linh', name: 'Quần Lĩnh Nữ', file: 'quan_linh_nu_4.jpg', desc: 'Vải lĩnh Bưởi đen nhánh bóng bẩy, chuẩn mực phục sức truyền thống phụ nữ Việt.' },
      { id: 'quan_phi', name: 'Quần Phi Nữ', file: 'quan_phi_nu_5.jpg', desc: 'Lụa phi bóng mềm mại, tà rủ thanh thoát, tôn nét yêu kiều đài các.' },
      { id: 'quan_moga', name: 'Quần Mỡ Gà Nữ', file: 'quan_moga_nu_6.jpg', desc: 'Sắc vàng mỡ gà trang nhã quý phái, đặc trưng cung đình và quý tộc xưa.' }
    ]
  };

  // 20 PHỤ KIỆN TỪ SYSTEM/ACCESSORIES (CHỌN TỐI ĐA 4 MÓN)
  const ACCESSORIES_DATASET = [
    { id: 'khan_dong', name: 'Khăn Đóng Chữ Nhân', file: 'khan_dong_chu_nhan_nam_2.jpg' },
    { id: 'non_la', name: 'Nón Lá Huế (Họa Tiết Hoa Sen)', file: 'non_la_bai_tho_3.jpg' },
    { id: 'man_xep', name: 'Mấn Xếp Lụa Nữ', file: 'man_xep_lua_nu_1.jpg' },
    { id: 'tram_phuong', name: 'Trâm Phượng Hoàng', file: 'tram_phuong_hoang_4.jpg' },
    { id: 'non_quai_thao', name: 'Nón Quai Thao', file: 'non_quai_thao_5.jpg' },
    { id: 'kieng_co', name: 'Kiềng Cổ Bạc Tròn', file: 'kieng_co_bac_tron_11.jpg' },
    { id: 'hoa_sen', name: 'Khuyên Tai Hoa Sen', file: 'khuyen_tai_hoa_sen_6.jpg' },
    { id: 'trong_dong', name: 'Khuyên Tai Trống Đồng', file: 'khuyen_tai_trong_dong_8.jpg' },
    { id: 'cam_thach', name: 'Khuyên Tai Cẩm Thạch', file: 'khuyen_tai_cam_thach_10.jpg' },
    { id: 'tua_rua', name: 'Khuyên Tai Tua Rua Đỏ', file: 'hoa_tai_tua_rua_do_9.jpg' },
    { id: 'ngoc_boi', name: 'Dây Chuyền Ngọc Bội Rồng', file: 'day_chuyen_ngoc_boi_rong_13.jpg' },
    { id: 'ngoc_trai_co', name: 'Vòng Cổ Ngọc Trai', file: 'vong_co_ngoc_trai_12.jpg' },
    { id: 'tram_huong_co', name: 'Vòng Cổ Trầm Hương', file: 'vong_co_tram_huong_14.jpg' },
    { id: 'choker', name: 'Choker Lụa Đen', file: 'choker_lua_den_15.jpg' },
    { id: 'ngoc_bich', name: 'Vòng Tay Ngọc Bích', file: 'vong_tay_ngoc_bich_16.jpg' },
    { id: 'bac_xa_cu', name: 'Lắc Tay Bạc Xà Cừ', file: 'lac_tay_bac_xa_cu_17.jpg' },
    { id: 'tram_huong_tay', name: 'Vòng Tay Trầm Hương Vàng', file: 'vong_tay_tram_huong_vang_18.jpg' },
    { id: 'ximen', name: 'Bộ 3 Vòng Ximen Vàng', file: 'bo_3_vong_ximen_vang_19.jpg' },
    { id: 'nhan_ngoc', name: 'Nhẫn Ngọc Bọc Bạc', file: 'nhan_ngoc_boc_bac_20.jpg' },
    { id: 'hoa_tai_pearl', name: 'Khuyên Tai Ngọc Trai', file: 'hoa_tai_ngoc_trai_7.jpg' }
  ];

  // THÔNG TIN VĂN HÓA VÀ Ý NGHĨA 10 KIỂU ÁO NỮ & 10 KIỂU ÁO NAM
  const OUTFITS_INFO = {
    Nu: {
      aotac: {
        name: 'Áo Tấc Ngũ Thân Nữ',
        era: 'Triều Nguyễn (Thế kỷ XIX – XX) • Lễ phục thụng tay',
        meaning: 'Áo Tấc ngũ thân là hiện thân của đỉnh cao lễ nghi và chuẩn mực phục sức triều Nguyễn, nơi tinh thần đoan chính hòa quyện trong từng đường may khép kín mực thước. Khi mang sắc hồng liên hoa hay xích kim thuần khiết, tà y phục phản chiếu nét thanh cao của nữ giới quyền quý. Cấu trúc năm thân ghép tượng trưng cho tứ thân phụ mẫu ôm bọc lấy thân con nhỏ bé nằm kín bên trong, nhắc nhở đạo hiếu sinh thành.',
        remixReview: 'Sự kết hợp hoàn mỹ giữa nét đoan trang cổ phong và vẻ trang trọng đương đại. Tà áo thụng rủ tạo phong thái nho nhã, khí chất vương giả chốn cung đình.',
        warning: 'ĐẠT CHUẨN LỄ NGHI: Chuẩn mực tuyệt đối cho nghi thức trang trọng, di tích lịch sử và lễ cưới truyền thống.',
        score: 99
      },
      nguthan: {
        name: 'Áo Ngũ Thân Tay Chẽn Nữ',
        era: 'Triều Nguyễn • Thường phục quý phái',
        meaning: 'Biểu tượng của vẻ đẹp kín đáo, mực thước của người phụ nữ Việt Nam thời Nguyễn với cổ đứng 3cm và 5 khuy cài lệch bên phải biểu trưng cho Ngũ thường: Nhân, Lễ, Nghĩa, Trí, Tín.',
        remixReview: 'Ống tay chẽn gọn gàng, thanh lịch, giúp cử chỉ uyển chuyển mà vẫn giữ trọn lễ nghi truyền thống.',
        warning: 'ĐẠT CHUẨN VĂN HÓA: Phối đồ chuẩn mực phong thái tiểu thư đài các kinh kỳ.',
        score: 98
      },
      nhatbinh: {
        name: 'Áo Nhật Bình Cung Đình',
        era: 'Triều Nguyễn • Quý phục hoàng gia',
        meaning: 'Đặc trưng bởi cổ áo chữ nhật thêu hoa văn ngũ sắc viền chỉ kim tuyến, dành riêng cho hoàng hậu, công chúa và mệnh phụ triều đình Huế.',
        remixReview: 'Lộng lẫy và đài các bậc nhất. Các dải ngũ hành ở cổ áo và hoa cúc thêu tay tạo nên kiệt tác mỹ thuật triều Nguyễn.',
        warning: 'CHUẨN MỰC HOÀNG GIA: Nên phối cùng mấn xếp lụa hoặc trâm phượng hoàng để hoàn thiện phong thái cung đình.',
        score: 99
      },
      tuthan: {
        name: 'Áo Tứ Thân Kinh Bắc',
        era: 'Châu thổ Bắc Bộ • Duyên quê quan họ',
        meaning: 'Biểu tượng mộc mạc của tâm thức lao động và hồn cốt ngàn đời của phụ nữ Việt. Thân sau can đôi thành đường sống lưng chính trực, hai vạt trước buộc thắt duyên dáng tượng trưng cho mối dây gắn kết phu thê hòa thuận.',
        remixReview: 'Nét duyên quan họ đằm thắm. Sự chuyển tiếp nhiều lớp giữa yếm lụa, dải lưng và tà áo tạo nên vẻ đẹp trữ tình.',
        warning: 'ĐẠT CHUẨN DÂN GIAN: Hài hòa tuyệt đối khi mặc cùng nón quai thao trong không gian lễ hội cổ truyền.',
        score: 97
      },
      aodai: {
        name: 'Áo Dài Nữ Cổ Phong',
        era: 'Đầu thế kỷ XX • Quốc phục thanh tao',
        meaning: 'Quốc phục tôn vinh đường nét duyên dáng, kín đáo mà kiêu hãnh của phụ nữ Việt, là cầu nối diệu kỳ giữa cổ truyền và đương đại.',
        remixReview: 'Tà áo thướt tha mềm rủ, phom dáng tôn vinh vóc dáng yêu kiều của phái đẹp trong mọi không gian.',
        warning: 'ĐẠT CHUẨN QUỐC PHỤC: Hoàn hảo cho trường học, di tích, lễ hội và phố đi bộ văn hóa.',
        score: 99
      },
      aonamthan: {
        name: 'Áo Năm Thân Lụa Sa Nữ',
        era: 'Triều Nguyễn • Quý tộc thanh nhã',
        meaning: 'Biến thể tinh tế của áo ngũ thân với chất liệu sa lụa cao cấp, thể hiện gia phong mực thước và gu thẩm mỹ thanh nhã.',
        remixReview: 'Chất vải lụa tơ tằm dệt vân mây chìm nhẹ tênh, bay bổng theo từng bước đi uyển chuyển.',
        warning: 'ĐẠT CHUẨN KHUÊ CÁC: Rất đẹp khi kết hợp cùng chuỗi ngọc trai hoặc kiềng bạc tròn.',
        score: 97
      },
      aocom: {
        name: 'Áo Cổ Mở Dân Gian Nữ',
        era: 'Châu thổ sông Hồng • Bình dị thân thương',
        meaning: 'Phản ánh đời sống sinh hoạt thường nhật mộc mạc, chất phác nhưng đầy ý nhị của phụ nữ châu thổ Bắc Bộ.',
        remixReview: 'Đường nét cổ áo thanh thoát, mang lại cảm giác nhẹ nhàng, trẻ trung và gần gũi với thiên nhiên.',
        warning: 'ĐẠT CHUẨN VĂN HÓA DÂN GIAN: Phù hợp bối cảnh làng cổ, đồng quê và sinh hoạt văn hóa dân gian.',
        score: 95
      },
      aobaba: {
        name: 'Áo Bà Ba Nam Bộ Nữ',
        era: 'Đồng bằng sông Cửu Long • Dịu dàng chân chất',
        meaning: 'Gắn liền với hình ảnh người con gái phương Nam chịu thương chịu khó, đoan trang mà duyên dáng lạ kỳ bên dòng kênh rạch trù phú.',
        remixReview: 'Phom áo chiết eo nhẹ khéo léo khoe nét thắt đáy lưng ong, kết hợp nón lá Huế (dây ngắn) đậm chất thơ mộng.',
        warning: 'ĐẠT CHUẨN SÔNG NƯỚC NAM BỘ: Phối cùng nón lá Huế và khăn rằn tạo phong thái thuần hậu phương Nam.',
        score: 96
      },
      daotien: {
        name: 'Y Phục Dân Tộc Đào Tiền Nữ',
        era: 'Vùng cao Đông Bắc • Hoa văn sáp ong độc bản',
        meaning: 'Nét tinh hoa thêu hoa văn chỉ chàm và vẽ sáp ong truyền đời của đồng bào Đào Tiền, gửi gắm ước nguyện hòa hợp cùng đại ngàn.',
        remixReview: 'Bản sắc nhân chủng học sâu sắc. Sự tương phản giữa bạc chạm khắc và vải nhuộm chàm tạo vẻ đẹp bí ẩn, cuốn hút.',
        warning: 'BẢO TỒN NGUYÊN BẢN: Nên kết hợp kiềng cổ bạc tròn và lắc tay xà cừ cổ truyền.',
        score: 96
      },
      hmong: {
        name: 'Y Phục Thổ Cẩm H\'Mông Nữ',
        era: 'Vùng cao Tây Bắc • Sắc màu mùa xuân',
        meaning: 'Váy xòe xếp nếp thêu thổ cẩm thủ công rực rỡ, biểu trưng cho sự trù phú, sức sống mãnh liệt và tình yêu tự do giữa núi rừng trùng điệp.',
        remixReview: 'Bản hòa ca của sắc màu núi rừng, hoa văn hình học chuyển động nhịp nhàng theo từng bước chân.',
        warning: 'TÔN VINH DI SẢN THỦ CÔNG: Kết hợp khuyên tai hoa sen hoặc khuyên tai tua rua đỏ tăng vẻ lộng lẫy.',
        score: 97
      }
    },
    Nam: {
      aotac: {
        name: 'Áo Tấc Ngũ Thân Nam',
        era: 'Triều Nguyễn (Thế kỷ XIX – XX) • Lễ phục thụng tay',
        meaning: 'Định chế lễ phục trang trọng dùng chung cho hoàng tộc lẫn sĩ phu trong các nghi thức tế tự, việc làng và hôn lễ. Ống tay rộng thụng rủ ngang gấu áo buộc người mặc phải giữ cử chỉ tề chỉnh, chậm rãi, toát lên phong thái nho nhã khoan hòa.',
        remixReview: 'Tà áo thụng rủ tạo nên phong thái đĩnh đạc, cốt cách sĩ phu Đại Việt chốn cung đình uy nghiêm.',
        warning: 'ĐẠT CHUẨN LỄ NGHI: Rất mực trang trọng, phù hợp cho lễ tế, việc họ và sự kiện văn hóa cổ kính.',
        score: 99
      },
      nguthan: {
        name: 'Áo Ngũ Thân Tay Chẽn Nam',
        era: 'Triều Nguyễn • Thường phục trang nhã',
        meaning: 'Áo ngũ thân tay chẽn là biểu tượng chuẩn mực của nam nhân thời Nguyễn. Ống tay gọn gàng linh hoạt, thể hiện cốt cách đoan chính, nhanh nhẹn mà vẫn mực thước.',
        remixReview: 'Gọn gàng, linh hoạt, phom dáng cổ truyền dễ dàng ứng dụng trong đời sống hiện đại, chụp ảnh dạo phố hay lễ hội cộng đồng.',
        warning: 'ĐẠT CHUẨN VĂN HÓA: Phối đồ mực thước, chuẩn phong cách sĩ tử thời xưa.',
        score: 97
      },
      giaolinh: {
        name: 'Áo Giao Lĩnh Nam (Tràng Bạt)',
        era: 'Thời Lý – Trần – Lê • Cổ chéo uy nghiêm',
        meaning: 'Dấu ấn trường tồn của nền văn hiến Đại Việt, định hình phong thái đĩnh đạc và uy nghiêm của đấng trượng phu qua các triều đại Lý, Trần, Lê. Cổ chéo giao vạt sang bên phải phản chiếu hào khí tự tôn dân tộc.',
        remixReview: 'Phong thái đĩnh đạc, uy nghi, tạo ấn tượng thị giác sâu sắc giữa không gian di tích cổ kính.',
        warning: 'CHUẨN MỰC CỔ PHONG: Nên phối cùng quần sớ trắng hoặc quần đũi tề chỉnh ngang eo.',
        score: 96
      },
      tuthan: {
        name: 'Áo Cánh Nam Cổ Truyền',
        era: 'Châu thổ Bắc Bộ • Dân gian mộc mạc',
        meaning: 'Tà áo bốn thân nam mang đậm hơi thở sinh hoạt văn hóa dân gian châu thổ sông Hồng, mộc mạc, phóng khoáng và chân thành.',
        remixReview: 'Gần gũi và giàu tính hoài niệm, thích hợp cho các lễ hội làng và không gian diễn xướng dân gian.',
        warning: 'ĐẠT CHUẨN DÂN GIAN: Hài hòa với nón lá Huế (dây ngắn) hoặc vòng tay trầm hương.',
        score: 95
      },
      aodai: {
        name: 'Áo Dài Nam Cổ Phong',
        era: 'Đầu thế kỷ XX • Quốc phục thanh tao',
        meaning: 'Quốc phục tôn vinh phong thái đĩnh đạc, nho nhã và tôn nghiêm của nam nhân đất Việt, là biểu tượng trường tồn của lòng tự tôn văn hóa.',
        remixReview: 'Phom dáng hiện đại hóa với ve áo sắc nét, vừa giữ trọn truyền thống vừa phóng khoáng, tự tin.',
        warning: 'ĐẠT CHUẨN QUỐC PHỤC: Phù hợp mọi dịp lễ tết, sự kiện ngoại giao và dạo phố văn hóa.',
        score: 99
      },
      baba: {
        name: 'Áo Bà Ba Nam Bộ',
        era: 'Đồng bằng sông Cửu Long • Mộc mạc phong lưu',
        meaning: 'Gắn liền với tính cách trung trực, bộc trực, phóng khoáng và nghĩa tình của người phương Nam.',
        remixReview: 'Chất liệu vải đũi tơ tằm mềm mại, thoáng mát, mang lại cảm giác tự do tự tại bên dòng sông quê hương.',
        warning: 'ĐẠT CHUẨN ĐỜI THƯỜNG: Tuyệt vời khi diện cùng quần đũi và nón lá Huế (dây ngắn).',
        score: 94
      },
      quanlai: {
        name: 'Áo Quan Lại / Mãng Bào',
        era: 'Triều đình phong kiến • Phẩm phục triều nghi',
        meaning: 'Trang phục đại diện cho trật tự phẩm hàm, đạo đức trị quốc và quyền uy chốn cung đình.',
        remixReview: 'Hoa văn rồng mây thêu chỉ kim tuyến lộng lẫy, mang khí chất vương giả cao quý.',
        warning: 'LƯU Ý NGHI THỨC: Phẩm phục mang tính biểu tượng lịch sử triều đình cao.',
        score: 98
      },
      cham: {
        name: 'Y Phục Cổ Truyền Dân Tộc Chăm Nam',
        era: 'Duyên hải Nam Trung Bộ • Di sản Chăm Pa',
        meaning: 'Họa tiết dệt thổ cẩm hình thoi và hoa sen cách điệu, kết tinh mỹ thuật tháp Chăm trầm tích ngàn năm.',
        remixReview: 'Màu sắc huyền bí, hoa văn độc bản tạo sức hút văn hóa độc đáo và khác biệt.',
        warning: 'BẢO TỒN DI SẢN: Tôn trọng nguyên bản cách quấn khăn và họa tiết dệt tay.',
        score: 95
      },
      taynguyen: {
        name: 'Y Phục Thổ Cẩm Tây Nguyên Nam',
        era: 'Đại ngàn Tây Nguyên • Tinh thần sử thi',
        meaning: 'Họa tiết kỷ hà, chim muông và mặt trời phản chiếu thế giới quan hùng vĩ của vùng đất cồng chiêng.',
        remixReview: 'Mạnh mẽ, hào sảng, thể hiện cốt cách người con của buôn làng giữa núi rừng đại ngàn.',
        warning: 'BẢN SẮC CỒNG CHIÊNG: Rất hòa hợp với kiềng bạc và vòng tay trầm hương.',
        score: 95
      },
      mong: {
        name: 'Y Phục Cổ Truyền Dân Tộc Mông Nam',
        era: 'Vùng cao Tây Bắc – Đông Bắc • Thổ cẩm chàm',
        meaning: 'Đường viền thêu tay tỉ mỉ và sắc chàm bền bỉ theo năm tháng, tượng trưng cho sự kiên cường trước thiên nhiên.',
        remixReview: 'Phom áo khoác ngắn khỏe khoắn, phối màu tương phản mạnh mẽ đầy cá tính đương đại.',
        warning: 'ĐẠT CHUẨN BẢN SẮC: Tôn vinh nét đẹp văn hóa đa dạng các dân tộc Việt Nam.',
        score: 96
      }
    }
  };

  // =========================================================================
  // 3. TRẠNG THÁI LỰA CHỌN CỦA NGƯỜI DÙNG (SELECTION STATE)
  // =========================================================================

  const selectionState = {
    // Bước 1: Bối cảnh
    spaceContext: 'Di tích lịch sử - văn hóa',
    timeContext: 'Bình Minh',

    // Bước 2: Phối đồ
    gender: 'Nu', // 'Nu' hoặc 'Nam' (ĐÃ XÓA HOÀN TOÀN UNISEX)
    outfitType: 'aotac',
    colorCode: 'LienHoa',
    colorName: 'Liên Hoa Hồng Phấn',
    pantsId: 'quan_linh', // 'quan_linh', 'quan_phi', 'quan_moga' cho Nữ; 'quan_so', 'quan_trang', 'quan_dui' cho Nam
    selectedAccessories: ['khan_dong', 'non_la'], // Tối đa 4 món
    style: 'Trang trọng'
  };

  // Cấu hình chuẩn mực API Base URL tự động theo window.location.origin (hỗ trợ cả Localhost, Cloud Preview và Production Publish)
  const API_BASE_URL = window.location.origin;

  // Khởi tạo ngay lập tức bộ nhớ ảnh với toàn bộ 226 vật phẩm tĩnh chuẩn mực (không bị rỗng khi vừa mở trang hoặc khi deploy)
  const apiItemsMap = new Map(Object.entries(PRESET_ITEMS_MAP));

  let isApiItemsLoaded = false;
  async function loadApiItems() {
    if (isApiItemsLoaded) return;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${API_BASE_URL}/api/clothes`, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) return;
      const data = await res.json();
      isApiItemsLoaded = true;
      const items = data.clothes_info?.items || [];
      items.forEach(item => {
        if (!item) return;
        const imgUrl = item.image_url || item.image_filename;
        if (!imgUrl) return;

        // Bỏ qua dòng tiêu đề Google Sheet hoặc ID banner không phải vật phẩm
        if (
          imgUrl.includes('1hAOAiuqgILU_qpoyWoXN2t4CPDdBoTEQHEzduhDe-zI') ||
          (item.id || '').includes('Studio') ||
          (item.id || '').includes('palettes')
        ) {
          return;
        }

        const id = (item.id || '').toLowerCase().trim();
        if (id) {
          apiItemsMap.set(id, imgUrl);
          // Key không có timestamp (ví dụ: aotac_nu_xichkim_1790758895441 -> aotac_nu_xichkim)
          const withoutTimestamp = id.replace(/_\d{10,}$/, '');
          if (withoutTimestamp !== id) {
            apiItemsMap.set(withoutTimestamp, imgUrl);
          }
          // Key không có số thứ tự (ví dụ: quan_so_nam_1 -> quan_so_nam)
          const withoutNum = id.replace(/_\d+$/, '');
          if (withoutNum !== id) {
            apiItemsMap.set(withoutNum, imgUrl);
          }
        }

        const name = (item.name || '').toLowerCase().trim();
        if (name) {
          apiItemsMap.set(name, imgUrl);
        }

        // Tách fileId nếu là liên kết Google Drive lh3 hoặc uc
        const driveMatch = imgUrl.match(/(?:\/d\/|[?&]id=)([a-zA-Z0-9_-]{20,})/);
        if (driveMatch && driveMatch[1]) {
          apiItemsMap.set(driveMatch[1], imgUrl);
        }

        const filename = imgUrl.split('/').pop();
        if (filename && !filename.includes('?')) {
          apiItemsMap.set(filename.toLowerCase(), imgUrl);
          const cleanFname = filename.replace(/\.(jpg|jpeg|png|webp)$/i, '').toLowerCase();
          apiItemsMap.set(cleanFname, imgUrl);
          const cleanWithoutNum = cleanFname.replace(/_\d+$/, '');
          if (cleanWithoutNum !== cleanFname) {
            apiItemsMap.set(cleanWithoutNum, imgUrl);
          }
        }
      });
      // Re-render UI catalogs với đường dẫn ảnh thực tế từ Supabase
      renderOutfitCatalog();
      renderPantsCatalog();
      renderAccessoriesCatalog();
      renderResultShowcase();
    } catch (err) {
      console.warn('Lỗi khi tải danh sách vật phẩm từ /api/clothes:', err);
    }
  }

  function getItemImageUrl(identifier, fallbackFile = '') {
    const cleanId = (identifier || '').toLowerCase().trim();
    const cleanFile = (fallbackFile || '').replace(/\.(jpg|jpeg|png|webp)$/i, '').toLowerCase().trim();
    const cleanFileNoNum = cleanFile.replace(/_\d+$/, '');
    const cleanIdNoNum = cleanId.replace(/_\d+$/, '');

    // 1. Khớp trực tiếp ID hoặc Tên file
    if (cleanId && apiItemsMap.has(cleanId)) return apiItemsMap.get(cleanId);
    if (cleanIdNoNum && apiItemsMap.has(cleanIdNoNum)) return apiItemsMap.get(cleanIdNoNum);
    if (cleanFile && apiItemsMap.has(cleanFile)) return apiItemsMap.get(cleanFile);
    if (cleanFileNoNum && apiItemsMap.has(cleanFileNoNum)) return apiItemsMap.get(cleanFileNoNum);

    // 2. Khớp chuỗi con (tối thiểu 5 ký tự để tránh nhầm lẫn)
    const targets = [cleanFileNoNum, cleanFile, cleanIdNoNum, cleanId].filter(t => t && t.length >= 5);
    for (const target of targets) {
      for (const [key, url] of apiItemsMap.entries()) {
        if (key.length < 5 || key.includes('studio') || key.includes('palettes')) continue;
        if (key.includes(target) || target.includes(key)) return url;
      }
    }

    // Fallbacks riêng biệt theo từng loại (TUYỆT ĐỐI KHÔNG FALLBACK CHUNG VỀ VÒNG TAY):
    if (cleanId.includes('quan') || cleanFile.includes('quan')) {
      return 'https://lh3.googleusercontent.com/d/1EK1y6PtBNp9LoHBrFeHtLr61WvcGpgYz'; // Quần Lĩnh Nữ
    }
    if (cleanId.includes('khan') || cleanFile.includes('khan')) {
      return 'https://lh3.googleusercontent.com/d/11-mBjdmU7izcCsuVvCj09w_STMrDjykp'; // Khăn Đóng
    }
    if (cleanId.includes('non') || cleanFile.includes('non')) {
      return 'https://lh3.googleusercontent.com/d/1UF6_U8wUzEWzI_FPbavGOBEh7LNp4O71'; // Nón Lá
    }
    if (cleanId.includes('man') || cleanFile.includes('man')) {
      return 'https://lh3.googleusercontent.com/d/1MoIC0yrdvDSznhl-hEgWG93IdM3tTmsK'; // Mấn Xếp
    }
    if (cleanId.includes('kieng') || cleanFile.includes('kieng')) {
      return 'https://lh3.googleusercontent.com/d/1raiSduQJ4qADB8q9SSLRmLcDE6_Pbx9R'; // Kiềng Bạc
    }

    // Phụ kiện mặc định: Kiềng Cổ Bạc Tròn
    return 'https://lh3.googleusercontent.com/d/1raiSduQJ4qADB8q9SSLRmLcDE6_Pbx9R';
  }

  // Helper: Lấy đường dẫn ảnh áo từ dataset với thuật toán thông minh đa tầng
  function getCostumeImageSrc(colorCode, gender, type) {
    const cType = (type || 'aotac').toLowerCase();
    const cGender = (gender || 'nu').toLowerCase();
    const cColor = (colorCode || 'xichkim').toLowerCase();

    // 1. Khớp chính xác Kiểu áo + Giới tính + Màu sắc (O(1) direct lookup)
    const exactKey = `${cType}_${cGender}_${cColor}`;
    if (apiItemsMap.has(exactKey)) return apiItemsMap.get(exactKey);

    // 2. Khớp chuỗi con có chứa exactKey
    for (const [key, url] of apiItemsMap.entries()) {
      if (key.includes(exactKey)) return url;
    }

    // 3. Khớp Kiểu áo + Màu sắc
    for (const [key, url] of apiItemsMap.entries()) {
      if (key.includes(cType) && key.includes(cColor)) return url;
    }

    // 4. Khớp Kiểu áo + Giới tính
    const prefix3 = `${cType}_${cGender}`;
    for (const [key, url] of apiItemsMap.entries()) {
      if (key.includes(prefix3)) return url;
    }

    // 5. Khớp Kiểu áo
    for (const [key, url] of apiItemsMap.entries()) {
      if (key.includes(cType)) return url;
    }

    // 6. Dataset filename fallback
    const filename = COSTUMES_DATASET[colorCode]?.[gender]?.[type] || '';
    if (filename) {
      const cleanFname = filename.replace(/\.(jpg|jpeg|png|webp)$/i, '').toLowerCase();
      if (apiItemsMap.has(cleanFname)) return apiItemsMap.get(cleanFname);
      const cleanNoNum = cleanFname.replace(/_\d+$/, '');
      if (apiItemsMap.has(cleanNoNum)) return apiItemsMap.get(cleanNoNum);
    }

    // Fallback: Chuẩn mực Áo Tấc Nữ Liên Hoa (TUYỆT ĐỐI KHÔNG DÙNG VÒNG TAY)
    return 'https://lh3.googleusercontent.com/d/1MRVgfXK-2dXA3JwOtREZt6CmaPltUcbf';
  }

  // =========================================================================
  // 4. KHỞI TẠO VÀ RENDER GIAO DIỆN BƯỚC 2
  // =========================================================================

  // A. Đổ dữ liệu Áo theo Giới tính & Màu sắc
  const outfitContainer = document.getElementById('outfit-catalog-container');

  function renderOutfitCatalog() {
    if (!outfitContainer) return;

    const currentGender = selectionState.gender;
    const genderCatalog = OUTFITS_INFO[currentGender];
    const types = Object.keys(genderCatalog);

    outfitContainer.innerHTML = types.map(type => {
      const item = genderCatalog[type];
      const isSelected = type === selectionState.outfitType;
      const imgSrc = getCostumeImageSrc(selectionState.colorCode, currentGender, type);

      return `
        <div class="outfit-type-card ${isSelected ? 'selected' : ''}" data-type="${type}">
          <div class="outfit-check-badge">✓</div>
          <div class="outfit-card-img-wrap">
            <img src="${imgSrc}" alt="${item.name}" class="outfit-card-thumb" loading="lazy" onerror="this.onerror=null; this.src='https://lh3.googleusercontent.com/d/1MRVgfXK-2dXA3JwOtREZt6CmaPltUcbf';">
          </div>
          <div class="outfit-card-body">
            <h5 class="outfit-card-name">${item.name}</h5>
            <span class="outfit-card-era">${item.era}</span>
          </div>
        </div>
      `;
    }).join('');

    // Gán sự kiện click cho thẻ áo
    document.querySelectorAll('.outfit-type-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.outfit-type-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        const type = card.getAttribute('data-type');
        selectionState.outfitType = type;
        updateQuickSummary();
      });
    });
  }

  // B. Đổ dữ liệu 10 Bảng Màu Truyền Thống
  const colorContainer = document.getElementById('color-palette-container');
  const colorSelectionHint = document.getElementById('color-selection-hint');

  function renderColorPalettes() {
    if (!colorContainer) return;

    colorContainer.innerHTML = COLOR_PALETTES.map(c => {
      const isSelected = c.code === selectionState.colorCode;
      return `
        <div class="color-swatch-item ${isSelected ? 'selected' : ''}" data-code="${c.code}" data-name="${c.name}">
          <div class="color-circle" style="background: ${c.hex};"></div>
          <div class="color-text-wrap">
            <span class="color-name-label">${c.name}</span>
            <span class="color-tone-desc">${c.desc}</span>
          </div>
        </div>
      `;
    }).join('');

    document.querySelectorAll('.color-swatch-item').forEach(swatch => {
      swatch.addEventListener('click', () => {
        document.querySelectorAll('.color-swatch-item').forEach(s => s.classList.remove('selected'));
        swatch.classList.add('selected');
        
        selectionState.colorCode = swatch.getAttribute('data-code');
        selectionState.colorName = swatch.getAttribute('data-name');

        if (colorSelectionHint) {
          colorSelectionHint.textContent = `Đang chọn: ${selectionState.colorName} (Toàn bộ ảnh áo đã đổi sang màu này)`;
        }

        // CẬP NHẬT NGAY LẬP TỨC ẢNH ÁO CỦA TẤT CẢ 10 THẺ ÁO SANG MÀU MỚI!
        renderOutfitCatalog();
        updateQuickSummary();
      });
    });
  }

  // C. Đổ dữ liệu Quần (Pants) theo Nam / Nữ
  const pantsContainer = document.getElementById('pants-catalog-container');
  const pantsBlockTitle = document.getElementById('pants-block-title');

  function renderPantsCatalog() {
    if (!pantsContainer) return;

    const currentGender = selectionState.gender;
    const pantsList = PANTS_DATASET[currentGender] || PANTS_DATASET.Nu;

    if (pantsBlockTitle) {
      pantsBlockTitle.textContent = `2. CHỌN QUẦN ĐI KÈM (PHÂN THEO ${currentGender === 'Nam' ? 'NAM GIỚI' : 'NỮ GIỚI'})`;
    }

    pantsContainer.innerHTML = pantsList.map(p => {
      const isSelected = p.id === selectionState.pantsId;
      const imgSrc = getItemImageUrl(p.id, p.file);

      return `
        <div class="pants-card-item ${isSelected ? 'selected' : ''}" data-id="${p.id}" data-name="${p.name}">
          <div class="pants-check-badge">✓</div>
          <img src="${imgSrc}" alt="${p.name}" class="pants-card-thumb" onerror="this.onerror=null; this.src='https://lh3.googleusercontent.com/d/1EK1y6PtBNp9LoHBrFeHtLr61WvcGpgYz';">
          <h5 class="pants-card-name">${p.name}</h5>
          <p class="pants-card-desc">${p.desc}</p>
        </div>
      `;
    }).join('');

    document.querySelectorAll('.pants-card-item').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.pants-card-item').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectionState.pantsId = card.getAttribute('data-id');
        updateQuickSummary();
      });
    });
  }

  // D. Đổ dữ liệu 20 Phụ Kiện (CHỌN TỐI ĐA 4 MÓN)
  const accessoriesContainer = document.getElementById('accessories-catalog-container');
  const accessoryCountBadge = document.getElementById('accessory-count-badge');

  function renderAccessoriesCatalog() {
    if (!accessoriesContainer) return;

    accessoriesContainer.innerHTML = ACCESSORIES_DATASET.map(acc => {
      const isSelected = selectionState.selectedAccessories.includes(acc.id);
      const imgSrc = getItemImageUrl(acc.id, acc.file);

      return `
        <div class="accessory-card-item ${isSelected ? 'selected' : ''}" data-id="${acc.id}" data-name="${acc.name}" data-img="${imgSrc}">
          <div class="accessory-check-badge">✓</div>
          <img src="${imgSrc}" alt="${acc.name}" class="accessory-card-thumb" onerror="this.onerror=null; this.src='https://lh3.googleusercontent.com/d/11-mBjdmU7izcCsuVvCj09w_STMrDjykp';">
          <span class="accessory-card-name">${acc.name}</span>
        </div>
      `;
    }).join('');

    const HEADWEAR_IDS = ['khan_dong', 'man_xep', 'non_la', 'non_quai_thao'];

    document.querySelectorAll('.accessory-card-item').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-id');

        if (card.classList.contains('selected')) {
          // Bỏ chọn
          card.classList.remove('selected');
          selectionState.selectedAccessories = selectionState.selectedAccessories.filter(item => item !== id);
        } else {
          if (HEADWEAR_IDS.includes(id)) {
            selectionState.selectedAccessories = selectionState.selectedAccessories.filter(item => !HEADWEAR_IDS.includes(item));
            document.querySelectorAll('.accessory-card-item').forEach(el => {
              if (HEADWEAR_IDS.includes(el.getAttribute('data-id')) && el.getAttribute('data-id') !== id) {
                el.classList.remove('selected');
              }
            });
          }

          // Chọn mới: KIỂM TRA GIỚI HẠN TỐI ĐA 4 MÓN
          if (selectionState.selectedAccessories.length >= 4) {
            alert('Bạn chỉ được chọn tối đa 4 món phụ kiện đi kèm!');
            return;
          }
          card.classList.add('selected');
          if (!selectionState.selectedAccessories.includes(id)) {
            selectionState.selectedAccessories.push(id);
          }
        }

        if (accessoryCountBadge) {
          accessoryCountBadge.textContent = `Đã chọn: ${selectionState.selectedAccessories.length}/4 (tối đa 4 món)`;
        }
        updateQuickSummary();
      });
    });
  }

  // =========================================================================
  // 5. QUẢN LÝ CHUYỂN BƯỚC Ở WINDOW 3 (TIẾN TRÌNH DỪNG CHUẨN XÁC Ở BƯỚC 3)
  // =========================================================================

  const stepItems = document.querySelectorAll('.step-item');
  const stepContainers = document.querySelectorAll('.step-container');
  const fillLine1 = document.getElementById('fill-line-1');
  const fillLine2 = document.getElementById('fill-line-2');

  let currentStep = 1;

  const STEP_DETAILS = {
    1: { badge: 'Bước 1 / 3', tag: 'Bối cảnh', title: 'Chọn Bối Cảnh & Không Gian' },
    2: { badge: 'Bước 2 / 3', tag: 'Phối đồ', title: 'Trang Phục & Phối Đồ Cổ Phong' },
    3: { badge: 'Bước 3 / 3', tag: 'Kết quả', title: 'Kết Quả & Đánh Giá Ý Nghĩa' }
  };

  const spMobileBadge = document.getElementById('sp-mobile-badge');
  const spMobileTag = document.getElementById('sp-mobile-step-tag');
  const spMobileTitle = document.getElementById('sp-mobile-title');
  const spMobilePrev = document.getElementById('sp-mobile-prev');
  const spMobileNext = document.getElementById('sp-mobile-next');
  const spTrackSegments = document.querySelectorAll('.sp-track-segment');

  let isStepTransitioning = false;

  function goToStep(stepNumber) {
    if (stepNumber < 1 || stepNumber > 3) return;
    if (stepNumber === currentStep && stepContainers[stepNumber - 1]?.classList.contains('active-step')) return;
    if (isStepTransitioning) return;

    const isForward = stepNumber >= currentStep;
    const oldStep = currentStep;
    currentStep = stepNumber;
    isStepTransitioning = true;

    const oldContainer = stepContainers[oldStep - 1];
    const newContainer = stepContainers[stepNumber - 1];

    // Cập nhật trạng thái từng bước trên thanh tiến trình Desktop
    stepItems.forEach((item, idx) => {
      const stepIndex = idx + 1;
      if (stepIndex === stepNumber) {
        item.classList.add('active');
        item.classList.remove('completed');
      } else if (stepIndex < stepNumber) {
        item.classList.remove('active');
        item.classList.add('completed');
      } else {
        item.classList.remove('active');
        item.classList.remove('completed');
      }
    });

    // Cập nhật tiến trình thu gọn trên Mobile (hiện 1 bước tại 1 thời điểm)
    if (spMobileBadge && STEP_DETAILS[stepNumber]) {
      spMobileBadge.textContent = STEP_DETAILS[stepNumber].badge;
    }
    if (spMobileTag && STEP_DETAILS[stepNumber]) {
      spMobileTag.textContent = STEP_DETAILS[stepNumber].tag;
    }
    if (spMobileTitle && STEP_DETAILS[stepNumber]) {
      spMobileTitle.textContent = STEP_DETAILS[stepNumber].title;
    }
    if (spMobilePrev) {
      spMobilePrev.disabled = (stepNumber === 1);
      spMobilePrev.style.opacity = (stepNumber === 1) ? '0.35' : '1';
      spMobilePrev.style.cursor = (stepNumber === 1) ? 'not-allowed' : 'pointer';
    }
    if (spMobileNext) {
      spMobileNext.disabled = (stepNumber === 3);
      spMobileNext.style.opacity = (stepNumber === 3) ? '0.35' : '1';
      spMobileNext.style.cursor = (stepNumber === 3) ? 'not-allowed' : 'pointer';
    }
    spTrackSegments.forEach((segment, idx) => {
      if (idx + 1 === stepNumber) {
        segment.classList.add('active');
      } else {
        segment.classList.remove('active');
      }
    });

    // CẬP NHẬT ĐOẠN NỐI TIẾN TRÌNH:
    if (fillLine1 && fillLine2) {
      if (stepNumber === 1) {
        fillLine1.style.width = '0%';
        fillLine2.style.width = '0%';
      } else if (stepNumber === 2) {
        fillLine1.style.width = '100%';
        fillLine2.style.width = '0%';
      } else if (stepNumber === 3) {
        fillLine1.style.width = '100%';
        fillLine2.style.width = '100%';
      }
    }

    if (stepNumber === 3) {
      renderResultShowcase();
    }

    // Hiệu ứng chuyển bước: Bước cũ trượt ra ngoài, bước mới trượt vào
    if (oldContainer && newContainer && oldContainer !== newContainer && oldContainer.classList.contains('active-step')) {
      oldContainer.classList.remove('step-slide-in-right', 'step-slide-in-left', 'step-slide-out-left', 'step-slide-out-right');
      void oldContainer.offsetWidth;
      oldContainer.classList.add(isForward ? 'step-slide-out-left' : 'step-slide-out-right');

      setTimeout(() => {
        oldContainer.classList.remove('active-step', 'step-slide-out-left', 'step-slide-out-right');
        oldContainer.style.display = 'none';

        stepContainers.forEach((c, idx) => {
          if (idx + 1 !== stepNumber) {
            c.classList.remove('active-step', 'step-slide-in-right', 'step-slide-in-left', 'step-slide-out-left', 'step-slide-out-right');
            c.style.display = 'none';
          }
        });

        newContainer.style.display = 'block';
        newContainer.classList.remove('step-slide-out-left', 'step-slide-out-right', 'step-slide-in-right', 'step-slide-in-left');
        void newContainer.offsetWidth; // force reflow
        newContainer.classList.add('active-step', isForward ? 'step-slide-in-right' : 'step-slide-in-left');

        const panel = document.querySelector('.w3-interactive-panel');
        if (panel) {
          panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        setTimeout(() => {
          isStepTransitioning = false;
        }, 340);
      }, 160);
    } else if (newContainer) {
      stepContainers.forEach((c, idx) => {
        if (idx + 1 !== stepNumber) {
          c.classList.remove('active-step', 'step-slide-in-right', 'step-slide-in-left', 'step-slide-out-left', 'step-slide-out-right');
          c.style.display = 'none';
        }
      });
      newContainer.style.display = 'block';
      newContainer.classList.remove('step-slide-out-left', 'step-slide-out-right');
      void newContainer.offsetWidth;
      newContainer.classList.add('active-step', isForward ? 'step-slide-in-right' : 'step-slide-in-left');
      isStepTransitioning = false;
    }
  }

  stepItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetStep = parseInt(item.getAttribute('data-step') || '1', 10);
      goToStep(targetStep);
    });
  });

  // Sự kiện nút chuyển bước trên Mobile Indicator
  if (spMobilePrev) {
    spMobilePrev.addEventListener('click', () => {
      if (currentStep > 1) goToStep(currentStep - 1);
    });
  }
  if (spMobileNext) {
    spMobileNext.addEventListener('click', () => {
      if (currentStep < 3) goToStep(currentStep + 1);
    });
  }
  spTrackSegments.forEach(segment => {
    segment.addEventListener('click', () => {
      const targetStep = parseInt(segment.getAttribute('data-step') || '1', 10);
      goToStep(targetStep);
    });
  });

  const btnNextToStep2 = document.getElementById('btn-next-step2');
  if (btnNextToStep2) {
    btnNextToStep2.addEventListener('click', () => {
      const customInput = document.getElementById('custom-space-input');
      if (customInput && customInput.value.trim() !== '') {
        selectionState.spaceContext = customInput.value.trim();
      }
      goToStep(2);
      updateQuickSummary();
    });
  }

  const btnBackToStep1 = document.getElementById('btn-back-step1');
  if (btnBackToStep1) {
    btnBackToStep1.addEventListener('click', () => goToStep(1));
  }

  const btnNextToStep3 = document.getElementById('btn-next-step3');
  if (btnNextToStep3) {
    btnNextToStep3.addEventListener('click', () => goToStep(3));
  }

  const btnEditOutfit = document.getElementById('btn-edit-outfit');
  if (btnEditOutfit) {
    btnEditOutfit.addEventListener('click', () => goToStep(2));
  }

  const btnNewOutfit = document.getElementById('btn-new-outfit');
  if (btnNewOutfit) {
    btnNewOutfit.addEventListener('click', () => {
      resetAllSelections();
      goToStep(1);
    });
  }

  const btnResetW3 = document.getElementById('btn-reset-w3');
  if (btnResetW3) {
    btnResetW3.addEventListener('click', () => {
      resetAllSelections();
      goToStep(1);
    });
  }

  // Click vào 4 ô tiêu chí để hiện nhận xét tương ứng
  document.querySelectorAll('.score-pillar-card').forEach(card => {
    card.addEventListener('click', () => {
      const targetId = card.getAttribute('data-target');
      const targetSection = document.getElementById(targetId);
      const isAlreadyActive = card.classList.contains('active');

      // Tắt trạng thái active của tất cả các ô và các đoạn nhận xét
      document.querySelectorAll('.score-pillar-card').forEach(c => c.classList.remove('active'));
      document.querySelectorAll('.culture-section-item').forEach(sec => sec.classList.remove('active'));

      // Nếu bấm lại vào ô đang mở thì đóng lại, nếu bấm ô mới thì mở ô đó
      if (!isAlreadyActive && targetSection) {
        card.classList.add('active');
        targetSection.classList.add('active');
      }
    });
  });

  // =========================================================================
  // 6. TƯƠNG TÁC BỐI CẢNH & THAY ĐỔI GIỚI TÍNH (NAM / NỮ)
  // =========================================================================

  // Không gian
  const spaceCards = document.querySelectorAll('.space-context-card');
  const customSpaceInput = document.getElementById('custom-space-input');

  spaceCards.forEach(card => {
    card.addEventListener('click', () => {
      spaceCards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectionState.spaceContext = card.getAttribute('data-value') || 'Di tích lịch sử - văn hóa';
      if (customSpaceInput) customSpaceInput.value = '';
      updateQuickSummary();
    });
  });

  if (customSpaceInput) {
    customSpaceInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (val) {
        spaceCards.forEach(c => c.classList.remove('selected'));
        selectionState.spaceContext = val;
      } else {
        const first = spaceCards[0];
        if (first) {
          first.classList.add('selected');
          selectionState.spaceContext = first.getAttribute('data-value') || 'Di tích lịch sử - văn hóa';
        }
      }
      updateQuickSummary();
    });
  }

  // Thời gian
  const timeCards = document.querySelectorAll('.time-context-card');
  timeCards.forEach(card => {
    card.addEventListener('click', () => {
      timeCards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectionState.timeContext = card.getAttribute('data-value') || 'Bình Minh';
      updateQuickSummary();
    });
  });

  // Tab Giới tính: NỮ / NAM (ĐÃ XÓA UNISEX)
  const genderTabs = document.querySelectorAll('.gender-tab-btn');
  genderTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      genderTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const newGender = tab.getAttribute('data-gender') || 'Nu';
      selectionState.gender = newGender;

      // Cập nhật mặc định kiểu áo và quần cho giới tính mới
      if (newGender === 'Nam') {
        if (!OUTFITS_INFO.Nam[selectionState.outfitType]) {
          selectionState.outfitType = 'aotac';
        }
        selectionState.pantsId = 'quan_so';
      } else {
        if (!OUTFITS_INFO.Nu[selectionState.outfitType]) {
          selectionState.outfitType = 'aotac';
        }
        selectionState.pantsId = 'quan_linh';
      }

      // Render lại Áo và Quần cho giới tính tương ứng
      renderOutfitCatalog();
      renderPantsCatalog();
      updateQuickSummary();
    });
  });

  // Cập nhật thanh tóm tắt nhanh ở đáy màn hình
  function updateQuickSummary() {
    const summaryTextElem = document.getElementById('quick-summary-text');
    if (!summaryTextElem) return;

    const currentGender = selectionState.gender;
    const outfitInfo = OUTFITS_INFO[currentGender]?.[selectionState.outfitType] || OUTFITS_INFO.Nu.aotac;
    
    // Tìm tên quần
    const pantsList = PANTS_DATASET[currentGender] || PANTS_DATASET.Nu;
    const pantsItem = pantsList.find(p => p.id === selectionState.pantsId) || pantsList[0];

    // Tìm tên các phụ kiện
    const chosenAccNames = ACCESSORIES_DATASET
      .filter(a => selectionState.selectedAccessories.includes(a.id))
      .map(a => a.name);

    const accDisplay = chosenAccNames.length > 0 
      ? chosenAccNames.join(', ') + ` (${chosenAccNames.length}/4)`
      : 'Chưa kèm phụ kiện (0/4)';

    summaryTextElem.textContent = `${outfitInfo.name} (${selectionState.colorName}) • ${pantsItem.name} • ${selectionState.spaceContext} (${selectionState.timeContext}) • Phụ kiện: ${accDisplay}`;
  }

  function resetAllSelections() {
    spaceCards.forEach((c, idx) => {
      if (idx === 0) c.classList.add('selected');
      else c.classList.remove('selected');
    });
    selectionState.spaceContext = 'Di tích lịch sử - văn hóa';
    if (customSpaceInput) customSpaceInput.value = '';

    timeCards.forEach((c, idx) => {
      if (idx === 0) c.classList.add('selected');
      else c.classList.remove('selected');
    });
    selectionState.timeContext = 'Bình Minh';

    genderTabs.forEach(t => {
      if (t.getAttribute('data-gender') === 'Nu') t.classList.add('active');
      else t.classList.remove('active');
    });
    selectionState.gender = 'Nu';
    selectionState.outfitType = 'aotac';
    selectionState.colorCode = 'LienHoa';
    selectionState.colorName = 'Liên Hoa Hồng Phấn';
    selectionState.pantsId = 'quan_linh';
    selectionState.selectedAccessories = ['khan_dong', 'non_la'];
    selectionState.style = 'Trang trọng';

    if (accessoryCountBadge) {
      accessoryCountBadge.textContent = 'Đã chọn: 2 / 4 (Tối đa 4 món)';
    }

    renderOutfitCatalog();
    renderColorPalettes();
    renderPantsCatalog();
    renderAccessoriesCatalog();
    updateQuickSummary();
  }

  // =========================================================================
  // 7. BƯỚC 3: CÔNG CỤ ĐÁNH GIÁ CHUYÊN GIA DI SẢN & HIỂN THỊ KẾT QUẢ REMIX
  // =========================================================================

  /**
   * ĐỘNG CƠ ĐÁNH GIÁ CHUYÊN GIA CỔ PHỤC VIỆT NAM TOÀN DIỆN:
   * Phân tích chặt chẽ 4 trụ cột chuẩn mực văn hóa:
   * 1. Lễ Nghi & Bối Cảnh Sự Kiện (25 điểm) - Kiểm tra kiêng kỵ cưới hỏi, tang lễ, đền chùa
   * 2. Sắc Thái & Thời Điểm Trong Ngày (25 điểm) - Kiểm tra ánh sáng, nhiệt độ, phong thủy
   * 3. Quy Chuẩn Y Quan & Phối Quần/Phụ Kiện (25 điểm) - Kiểm tra quy tắc 'Áo the quần lĩnh', sự hòa hợp
   * 4. Thẩm Mỹ Remix & Sáng Tạo Di Sản (25 điểm) - Kiểm tra tổng thể thẩm mỹ
   */
  function evaluateCulturalOutfit(state, outfit, selectedPants, chosenAccList) {
    const space = (state.spaceContext || 'Di tích lịch sử - văn hóa').trim();
    const time = state.timeContext || 'Ban Ngày';
    const color = state.colorCode || 'XichKim';
    const colorName = state.colorName || 'Xích Kim Cung Đình';
    const outfitType = state.outfitType || 'aotac';
    const gender = state.gender || 'Nu';
    const accCount = chosenAccList.length;

    const lowerSpace = space.toLowerCase();
    const pantsName = (selectedPants && selectedPants.name) ? selectedPants.name : 'Quần Lĩnh';
    const isDarkPants = pantsName.toLowerCase().includes('lĩnh') || pantsName.toLowerCase().includes('đen') || pantsName.toLowerCase().includes('sa');
    const isWhitePants = pantsName.toLowerCase().includes('trắng') || pantsName.toLowerCase().includes('bạch') || pantsName.toLowerCase().includes('ngà');

    // NHẬN DIỆN CÁC SỰ KIỆN ĐẶC BIỆT
    const isFuneral = lowerSpace.includes('tang') || lowerSpace.includes('đám ma') || lowerSpace.includes('viếng') || lowerSpace.includes('mộ') || lowerSpace.includes('nhà tang') || lowerSpace.includes('cúng giỗ') || lowerSpace.includes('giỗ') || lowerSpace.includes('chết');
    const isWedding = lowerSpace.includes('cưới') || lowerSpace.includes('hôn lễ') || lowerSpace.includes('vu quy') || lowerSpace.includes('thành hôn') || lowerSpace.includes('đám hỏi') || lowerSpace.includes('hỷ') || lowerSpace.includes('ngày cưới');
    const isHeritageSite = lowerSpace.includes('di tích') || lowerSpace.includes('cố đô') || lowerSpace.includes('hoàng thành') || lowerSpace.includes('đền') || lowerSpace.includes('chùa') || lowerSpace.includes('lăng') || lowerSpace.includes('miếu');
    const isFestival = lowerSpace.includes('lễ hội') || lowerSpace.includes('hội lim') || lowerSpace.includes('hoa đăng') || lowerSpace.includes('đền hùng');
    const isOldTown = lowerSpace.includes('phố cổ') || lowerSpace.includes('làng cổ') || lowerSpace.includes('hội an') || lowerSpace.includes('đường lâm');
    const isModernStreet = lowerSpace.includes('phố đi bộ') || lowerSpace.includes('văn hóa') || lowerSpace.includes('nghệ thuật') || lowerSpace.includes('đương đại');
    const isNaturePark = lowerSpace.includes('du lịch') || lowerSpace.includes('công viên') || lowerSpace.includes('sinh thái') || lowerSpace.includes('sông');
    const isGraduation = lowerSpace.includes('kỷ yếu') || lowerSpace.includes('tốt nghiệp') || lowerSpace.includes('trường');

    // =========================================================================
    // TRỤ CỘT 1: LỄ NGHI & BỐI CẢNH SỰ KIỆN (Thang 25 điểm)
    // =========================================================================
    let contextScore = 25;
    let contextReview = '';
    let isSevereTaboo = false;
    let tabooWarningText = '';

    // 1.1. KIỂM TRA TANG LỄ / ĐÁM MA / CÚNG GIỖ
    if (isFuneral) {
      if (['XichKim', 'HoangYen', 'LienHoa', 'TuKhi'].includes(color)) {
        // VI PHẠM CỰC KỲ NGHIÊM TRỌNG: Mặc đồ đỏ/hồng/vàng rực đi đám ma
        contextScore = 3;
        isSevereTaboo = true;
        tabooWarningText = `<strong>❌ VI PHẠM LỄ TANG NGHIÊM TRỌNG:</strong> Tuyệt đối cấm kỵ mặc trang phục màu đỏ rực (${colorName}) hoặc các tông màu hoa hòe sặc sỡ khi tham dự đám tang, tang lễ! Đây là hành vi bất kính tột cùng đối với người đã khuất và gia quyến. Trong điển chế tang phục Việt Nam, chốn tang lễ chỉ chấp nhận sắc Trắng (Bạch Ngọc), Đen thuần hoặc màu chàm/trầm tối giản.`;
        contextReview = `Sự kiện mang tính chất tang lễ trang nghiêm, u buồn. Việc diện y phục sắc <strong>${colorName}</strong> rực rỡ vi phạm nghiêm trọng thuần phong mỹ tục và đạo lý hiếu kính của người Việt.`;
      } else if (['BachNgoc', 'HuyenChu', 'ThoHoang'].includes(color)) {
        contextScore = 25;
        contextReview = `Trang phục màu <strong>${colorName}</strong> thể hiện trọn vẹn sự khiêm nhường, thành kính và trang nghiêm, hoàn toàn chuẩn mực khi tham dự lễ tang hoặc cúng giỗ tưởng niệm.`;
      } else {
        contextScore = 18;
        contextReview = `Tông màu <strong>${colorName}</strong> ở mức tương đối nhã nhặn; tuy nhiên trong tang lễ cổ truyền người Việt, sắc Trắng (Bạch Ngọc) hoặc Đen thuần (Huyền Chu) vẫn là lựa chọn tôn nghiêm nhất.`;
      }
    } 
    // 1.2. KIỂM TRA HÔN LỄ / ĐÁM CƯỚI / HỶ SỰ
    else if (isWedding) {
      if (['HuyenChu'].includes(color)) {
        // ĐẠI KỴ: Mặc đồ đen tuyền đi đám cưới
        contextScore = 5;
        isSevereTaboo = true;
        tabooWarningText = `<strong>⚠️ ĐẠI KỴ HỶ SỰ:</strong> Trong văn hóa và phong tục cưới hỏi truyền thống của người Việt, đám cưới là ngày Đại Hỷ (niềm vui lớn). Trang phục màu đen tuyền (${colorName}) là màu kiêng kỵ tuyệt đối vì mang ý nghĩa u ám, xui xẻo và gợi nhớ đến tang tóc. Bạn nên chọn các gam Hỷ sắc như Đỏ Xích Kim, Hồng Liên Hoa hoặc Vàng Hoàng Yến.`;
        contextReview = `Đám cưới là ngày hỷ sự chúc phúc trăm năm. Việc diện y phục đen tuyền <strong>${colorName}</strong> phạm vào điều kiêng kỵ lớn trong tập quán cưới xin Việt Nam, mang lại cảm giác ảm đạm không phù hợp với không khí ngày vui.`;
      } else if (['XichKim', 'LienHoa', 'HoangYen'].includes(color)) {
        contextScore = 25;
        contextReview = `Sắc <strong>${colorName}</strong> là tông Hỷ sắc kinh điển trong lễ cưới truyền thống của người Việt, biểu trưng cho phúc lộc, may mắn, hạnh phúc viên mãn và cát tường như ý.`;
      } else if (['BachNgoc'].includes(color)) {
        contextScore = 24;
        contextReview = `Sắc Bạch Ngọc mang vẻ đẹp tinh khôi, thuần khiết và thanh tân rất trang nhã trong ngày cưới; khi phối cùng kim hoàn hoặc khăn đóng sẽ càng thêm rạng rỡ.`;
      } else {
        contextScore = 22;
        contextReview = `Sắc <strong>${colorName}</strong> mang vẻ đẹp thanh lịch khi dự tiệc cưới, tuy nhiên sắc Đỏ Xích Kim và Hồng Liên Hoa vẫn là chuẩn mực hỷ sự truyền thống rực rỡ nhất.`;
      }
    }
    // 1.3. DI TÍCH LỊCH SỬ / ĐỀN CHÙA
    else if (isHeritageSite) {
      if (['aotac', 'nhatbinh', 'nguthan', 'giaolinh', 'vienlinh'].includes(outfitType)) {
        contextScore = 25;
        contextReview = `Thức áo <strong>${outfit.name}</strong> mang trọn chuẩn mực lễ chế đỉnh cao, hoàn toàn tương thích và tôn nghiêm khi hiện diện tại không gian di sản <em>${space}</em>. Tà áo khép kín mực thước cùng phong thái đoan chính thể hiện sự tôn kính tuyệt đối trước tiền nhân.`;
      } else if (outfitType === 'tuthan') {
        contextScore = 23;
        contextReview = `Áo Tứ Thân mang hồn cốt dân gian thuần phác, hòa hợp dung dị với các đền chùa Bắc Bộ và chốn linh thiêng cổ kính, tạo cảm giác gần gũi nhưng vẫn giữ trọn sự đoan trang.`;
      } else {
        contextScore = 20;
        contextReview = `Bộ trang phục <strong>${outfit.name}</strong> mang nét duyên dáng, tuy nhiên khi vào chốn di tích tôn nghiêm cần chú ý cài khuy kín cổ, kết hợp phụ kiện nhã nhặn để giữ vẹn toàn phép tắc lễ nghi.`;
      }
    }
    // 1.4. LỄ HỘI TRUYỀN THỐNG
    else if (isFestival) {
      if (['tuthan', 'aotac', 'nhatbinh', 'giaolinh', 'doikham'].includes(outfitType)) {
        contextScore = 25;
        contextReview = `Tại <em>${space}</em>, thức áo <strong>${outfit.name}</strong> phát huy tối đa sinh khí lễ hội truyền thống Việt Nam. Phom dáng lộng lẫy và giàu tính biểu tượng giúp người mặc nổi bật giữa không gian hội hè rộn rã ngàn năm.`;
      } else {
        contextScore = 23;
        contextReview = `Thức áo <strong>${outfit.name}</strong> mang lại phong thái rạng ngời, rất phù hợp để du xuân, trẩy hội và hòa mình vào dòng người trẩy lộc tại <em>${space}</em>.`;
      }
    }
    // 1.5. PHỐ CỔ / LÀNG CỔ
    else if (isOldTown) {
      if (['nguthan', 'tuthan', 'aotac', 'giaolinh', 'aodai'].includes(outfitType)) {
        contextScore = 25;
        contextReview = `Sự trầm tích rêu phong của <em>${space}</em> như bức phông nền hoàn hảo cho tà áo <strong>${outfit.name}</strong>. Cấu trúc cổ truyền mộc mạc mà sang trọng khơi gợi mạnh mẽ chiều sâu ký ức thị thành xưa.`;
      } else {
        contextScore = 23;
        contextReview = `Trang phục <strong>${outfit.name}</strong> tạo điểm chạm thị giác tao nhã, hài hòa với mái ngói âm dương và những bức tường vàng cổ kính tại <em>${space}</em>.`;
      }
    }
    // 1.6. CÁC KHÔNG GIAN KHÁC
    else {
      contextScore = 23;
      contextReview = `Trang phục <strong>${outfit.name}</strong> giữ được tinh thần thanh lịch, trang trọng và thích ứng linh hoạt với bối cảnh <em>${space}</em> mà bạn đã lựa chọn.`;
    }

    // =========================================================================
    // TRỤ CỘT 2: SẮC THÁI & THỜI ĐIỂM TRONG NGÀY (Thang 25 điểm)
    // =========================================================================
    let weatherScore = 25;
    let weatherReview = '';

    if (time === 'Bình Minh') {
      if (color === 'HuyenChu') {
        weatherScore = 17;
        weatherReview = `⚠️ <strong>Lệch sắc thái ban mai:</strong> Tông màu đen tuyền (${colorName}) u tối làm giảm đi sinh khí trong trẻo, tinh khôi của buổi sớm mai. Bình minh thích hợp nhất với các tông màu thanh mát, tươi sáng như Bạch Ngọc, Liên Hoa, Phỉ Thúy.`;
      } else if (['BachNgoc', 'LienHoa', 'PhiThuy', 'BichThuy'].includes(color)) {
        weatherScore = 25;
        weatherReview = `Tông <strong>${colorName}</strong> phối hợp hoàn mỹ với ánh sáng bình minh trong trẻo. Ánh nắng sớm tinh khôi chiếu xuyên qua thớ vải tạo nên hiệu ứng thanh khiết, tao nhã như sương mai đọng trên cánh sen.`;
      } else {
        weatherScore = 23;
        weatherReview = `Sắc độ của tông <strong>${colorName}</strong> dưới ánh dương ban mai tạo độ tương phản bắt mắt, thể hiện sức sống của y quan truyền thống khi ngày mới bắt đầu.`;
      }
    } else if (time === 'Giữa Trưa') {
      if (color === 'HuyenChu') {
        weatherScore = 16;
        weatherReview = `⚠️ <strong>Bất lợi quang nhiệt:</strong> Giữa trưa nắng gắt với nhiệt độ cao, việc diện nguyên cây áo đen tuyền (${colorName}) hấp thụ bức xạ nhiệt rất lớn, gây cảm giác bức bối ngột ngạt cho người mặc và tạo cảm giác nặng nề dưới ánh nắng hè.`;
      } else if (['HoangYen', 'ThanhLam', 'XichKim'].includes(color)) {
        weatherScore = 25;
        weatherReview = `Dưới cường độ quang phổ mạnh mẽ của buổi trưa, tông <strong>${colorName}</strong> phản chiếu uy quyền cung đình vương giả. Sắc độ đậm đà không bị bạc màu dưới nắng gắt mà trái lại càng làm nổi bật từng đường kim thêu hoa văn tinh xảo.`;
      } else {
        weatherScore = 23;
        weatherReview = `Tông màu <strong>${colorName}</strong> mang lại cảm giác dịu mắt giữa tiết trời ban trưa rực rỡ, giúp người mặc luôn giữ được phong thái thư thái, khoan thai.`;
      }
    } else if (time === 'Hoàng Hôn') {
      if (['TuKhi', 'XichKim', 'ThoHoang', 'HoangYen'].includes(color)) {
        weatherScore = 25;
        weatherReview = `Sự hòa quyện tuyệt đỉnh giữa ráng chiều hoàng hôn đỏ tía và tông <strong>${colorName}</strong>! Ánh hoàng hôn vàng ấm phủ lên mặt vải lụa tạo nên một tuyệt tác thị giác đậm chất thơ hoài cổ.`;
      } else {
        weatherScore = 23;
        weatherReview = `Thời khắc chuyển giao ngày và đêm lúc hoàng hôn làm nổi bật sắc thái thâm trầm của tông <strong>${colorName}</strong>, mang lại cảm giác cổ kính và sâu lắng.`;
      }
    } else if (time === 'Ban Đêm') {
      if (['XichKim', 'BachNgoc', 'ThanhLam', 'TuKhi'].includes(color)) {
        weatherScore = 25;
        weatherReview = `Trong không gian màn đêm huyền ảo hòa cùng ánh đèn lồng, hoa đăng lung linh, tông <strong>${colorName}</strong> có khả năng bắt sáng và tạo tương phản thị giác xuất sắc. Tà áo nổi bật lộng lẫy, vừa huyền bí vừa sang trọng quý phái.`;
      } else if (color === 'HuyenChu') {
        weatherScore = 21;
        weatherReview = `Áo đen tuyền trong màn đêm dễ bị chìm vào phông nền tối; cần bổ sung thêm phụ kiện kim hoàn sáng (như kiềng bạc, trâm cài) để tạo điểm nhấn bắt sáng.`;
      } else {
        weatherScore = 24;
        weatherReview = `Ánh sáng lung linh ban đêm tôn vinh vẻ thanh tao nhẹ nhàng của sắc <strong>${colorName}</strong>, tạo nên diện mạo nhã nhặn, duyên dáng.`;
      }
    } else { // Ban Ngày chung
      weatherScore = 25;
      weatherReview = `Ánh sáng ban ngày chan hòa tôn vinh trọn vẹn 100% sắc thái nguyên bản của bảng màu <strong>${colorName}</strong> cùng độ óng ả của tơ tằm truyền thống.`;
    }

    // =========================================================================
    // TRỤ CỘT 3: QUY CHUẨN Y QUAN & PHỐI QUẦN/PHỤ KIỆN (Thang 25 điểm)
    // =========================================================================
    let ensembleScore = 25;
    let ensembleReview = '';
    let isPantsClash = false;

    // KIỂM TRA LỖI "ÁO ĐEN QUẦN TRẮNG" (Huyền Chu + Quần trắng)
    if (color === 'HuyenChu' && isWhitePants) {
      isPantsClash = true;
      ensembleScore = 12; // Bị trừ nặng vì phạm quy chuẩn 'Áo the quần lĩnh'
      ensembleReview = `⚠️ <strong>LỆCH CHUẨN PHỐI ÁO - QUẦN:</strong> Theo quy tắc phục sức mẫu mực của người Việt xưa (<em>'Áo the quần lĩnh'</em>), áo đen (Huyền Chu) bắt buộc phải đi cùng <strong>Quần Lĩnh Đen</strong> hoặc Sa Đen bóng mờ để tạo nên chỉnh thể trang nghiêm, nho nhã. Việc phối áo đen với quần lụa trắng tạo nên độ tương phản quá chọi gắt, phá vỡ cấu trúc đồng bộ của cổ phục truyền thống và dễ gây cảm giác cọc cạch, lai căng.`;
    } else if (color === 'HuyenChu' && isDarkPants) {
      ensembleScore = 25;
      ensembleReview = `Sự kết hợp giữa áo đen Huyền Chu và <strong>${pantsName}</strong> tái hiện chuẩn xác quy tắc <em>'Áo the quần lĩnh'</em> kinh điển của tiền nhân, toát lên vẻ trang nghiêm, đạo mạo và mực thước đỉnh cao.`;
    } else {
      if (accCount === 0) {
        ensembleScore = 22;
        ensembleReview = `Bộ trang phục phối cùng <strong>${pantsName}</strong> giữ được vẻ mộc mạc, tinh khôi. Tuy nhiên, nếu bổ sung thêm 1-2 món phụ kiện lễ chế (như Khăn đóng, Kiềng bạc hoặc Quạt trầm hương) sẽ nâng tầm khí chất quý phái của người mặc.`;
      } else if (accCount <= 3) {
        ensembleScore = 25;
        const accListText = chosenAccList.map(a => a.name).join(', ');
        ensembleReview = `Sự phối hợp giữa áo <strong>${outfit.name}</strong>, <strong>${pantsName}</strong> và ${accCount} món phụ kiện (<em>${accListText}</em>) đạt đến độ hài hòa mực thước kinh điển: 'Quý ở sự thanh nhã, trọng ở nét đoan trang'. Phụ kiện nâng đỡ cho phom áo mà không gây rườm rà.`;
      } else { // 4 phụ kiện
        ensembleScore = 24;
        const accListText = chosenAccList.map(a => a.name).join(', ');
        ensembleReview = `Tổng thể trang hoàng lộng lẫy với ${accCount} món phụ kiện (<em>${accListText}</em>). Bộ đồ toát lên vẻ quyền quý cung đình, vừa khít giới hạn quy chuẩn 4 món không vượt quá phạm trù lễ nghi.`;
      }
    }

    // =========================================================================
    // TRỤ CỘT 4: THẨM MỸ REMIX & SÁNG TẠO DI SẢN (Thang 25 điểm)
    // =========================================================================
    let aestheticsScore = 24;
    if (isSevereTaboo) {
      aestheticsScore = 5; // Phạt thẩm mỹ khi vi phạm đại kỵ
    } else if (isPantsClash) {
      aestheticsScore = 15; // Phạt thẩm mỹ khi phối cọc cạch
    } else {
      aestheticsScore = (state.style === 'Haidang' || state.style === 'Remix') ? 24 : 25;
    }

    // TỔNG ĐIỂM CHUYÊN GIA
    const totalScore = Math.max(15, Math.min(100, contextScore + weatherScore + ensembleScore + aestheticsScore));

    // Lời khuyên của Chuyên gia Cổ phục
    let expertAdvice = '';
    if (isFuneral && ['XichKim', 'HoangYen', 'LienHoa', 'TuKhi'].includes(color)) {
      expertAdvice = `<strong>Khuyến nghị cấp thiết:</strong> Hãy đổi ngay tông màu sang Bạch Ngọc (Trắng), Huyền Chu (Đen) hoặc Thổ Hoàng (Trầm) khi tham gia tang lễ. Giữ phụ kiện tối giản nhất có thể để thể hiện lòng kính trọng phân ưu cùng gia quyến.`;
    } else if (isWedding && ['HuyenChu'].includes(color)) {
      expertAdvice = `<strong>Khuyến nghị cấp thiết:</strong> Hãy chuyển sang tông màu Hỷ sắc như Xích Kim (Đỏ cung đình) hoặc Hồng Liên Hoa để mang lại may mắn, cát tường cho cô dâu chú rể trong ngày đại hỷ.`;
    } else if (isPantsClash) {
      expertAdvice = `<strong>Khuyên dùng:</strong> Hãy chọn lại <em>Quần Lĩnh Đen</em> hoặc <em>Quần Sa Đen</em> khi mặc áo đen Huyền Chu để tạo nên set 'Áo the quần lĩnh' chuẩn chỉ theo mỹ tục ngàn xưa.`;
    } else if (outfitType === 'aotac') {
      expertAdvice = `Khi diện Áo Tấc, người mặc nên luôn giữ hai tay chắp ngang bụng hoặc để buông tự nhiên trong tư thế chắp tay cung kính, để hai dải thụng tay rủ thẳng tắp đoan trang. Kết hợp cùng guốc mộc và khăn đóng chữ Nhân sẽ hoàn thiện phong thái danh gia vọng tộc chuẩn mực.`;
    } else if (outfitType === 'nhatbinh') {
      expertAdvice = `Áo Nhật Bình có điểm nhấn ở dải ngũ sắc hoa văn cổ áo và viền tay. Hãy cài trâm cài tóc phượng hoàng hoặc đeo kiềng bạc để tạo điểm sáng cho gương mặt, bước đi chậm rãi khoan thai nhằm tôn vinh dáng vẻ cao quý của bậc vương phi.`;
    } else if (outfitType === 'tuthan') {
      expertAdvice = `Áo Tứ Thân đẹp nhất khi hai vạt trước buông lơi duyên dáng hoặc buộc vạt nhẹ nhàng, kết hợp cùng dải yếm sen bên trong và nón quai thao / khăn mỏ quạ, mang lại nét duyên ngầm Kinh Bắc thuần khiết.`;
    } else if (outfitType === 'giaolinh') {
      expertAdvice = `Cổ áo Giao Lĩnh vắt chéo sang phải theo truyền thống 'Hữu khâm'. Chú ý giữ mép cổ áo phẳng phiu, có thể đeo thêm vòng ngọc bội hoặc thẻ bài ngự tứ bên hông để tăng thêm chiều sâu lịch sử thời Lý - Trần - Lê.`;
    } else if (outfitType === 'nguthan') {
      expertAdvice = `Áo Ngũ Thân tay chẽn là biểu tượng của tinh thần nho nhã mực thước. Cúc cài bên phải cần cài đủ 5 hạt tượng trưng cho Ngũ thường (Nhân, Lễ, Nghĩa, Trí, Tín), cổ đứng ôm khít gáy thể hiện cốt cách đoan chính.`;
    } else {
      expertAdvice = `Để bộ trang phục đạt hiệu quả thị giác cao nhất, hãy chú ý tư thế đĩnh đạc, nụ cười nhẹ nhàng và ánh mắt tự tin. Tinh thần của người mặc chính là linh hồn thắp sáng vẻ đẹp ngàn năm của cổ phục Việt.`;
    }

    // Phân loại danh hiệu & Huy hiệu cảnh báo
    let badgeText = `${totalScore}% • XUẤT SẮC`;
    let badgeColor = '#10B981';
    let warningIcon = '✓';
    let warningTitle = 'ĐẠT CHUẨN LỄ NGHI XUẤT SẮC:';
    let warningText = '';

    if (isSevereTaboo) {
      badgeText = `${totalScore}% • VI PHẠM LỄ NGHI`;
      badgeColor = '#EF4444';
      warningIcon = '❌';
      warningText = tabooWarningText;
    } else if (isPantsClash) {
      badgeText = `${totalScore}% • CẦN ĐIỀU CHỈNH QUẦN`;
      badgeColor = '#F59E0B';
      warningIcon = '⚠️';
      warningText = `<strong>LƯU Ý QUY CHUẨN PHỐI ĐỒ:</strong> Bộ trang phục đang phối Áo đen (Huyền Chu) với Quần lụa trắng. Theo chuẩn phục sức người Việt xưa <em>'Áo the quần lĩnh'</em>, áo đen nên đi cùng Quần lĩnh đen / sa đen để đạt vẻ đẹp tề chỉnh và chuẩn mực nhất.`;
    } else if (totalScore >= 95) {
      badgeText = `${totalScore}% • XUẤT SẮC`;
      badgeColor = '#10B981';
      warningIcon = '✓';
      warningTitle = 'BẢO CHỨNG DI SẢN XUẤT SẮC:';
      warningText = `<strong>${warningTitle}</strong> Bộ y phục <strong>${outfit.name}</strong> (Tông <em>${colorName}</em>) hòa hợp sâu sắc với thời điểm <em>${time}</em> và không gian <em>${space}</em>. Sự phối hợp phục sức vừa tôn vinh quy chế cổ nhân vừa đáp ứng hoàn hảo cảm quan thẩm mỹ đương đại.`;
    } else if (totalScore >= 85) {
      badgeText = `${totalScore}% • RẤT TỐT`;
      badgeColor = '#059669';
      warningIcon = '✓';
      warningTitle = 'ĐẠT CHUẨN PHỤC SỨC TRANG TRỌNG:';
      warningText = `<strong>${warningTitle}</strong> Bộ y phục <strong>${outfit.name}</strong> phối hợp hài hòa với bối cảnh <em>${space}</em> và thời gian <em>${time}</em>.`;
    } else {
      badgeText = `${totalScore}% • TƯƠNG ĐỐI HỢP`;
      badgeColor = '#F59E0B';
      warningIcon = '⚠️';
      warningTitle = 'LƯU Ý LỄ NGHI & BỐI CẢNH:';
      warningText = `<strong>${warningTitle}</strong> Bộ y phục có một vài điểm cần lưu ý để đạt độ hòa hợp tối đa với bối cảnh và thời tiết.`;
    }

    let smartSuggestion = null;

    if (isSevereTaboo || isPantsClash) {
      let suggestedColorCode = state.colorCode;
      let suggestedColorName = state.colorName;
      let suggestedPantsId = state.pantsId;
      let reason = "";

      const spaceLower = (state.spaceContext || "").toLowerCase();

      if (spaceLower.includes('tang lễ') || spaceLower.includes('tang chế') || isFuneral) {
        suggestedColorCode = 'BachNgoc';
        suggestedColorName = 'Bạch Ngọc (Trắng Ngà Tinh Khôi)';
        suggestedPantsId = (state.gender === 'Nam') ? 'quan_dui_nam_3' : 'quan_linh_nu_4';
        reason = `Tại không gian tang lễ, sắc phục rực rỡ phạm đại kị tang chế. Chuyên gia đề xuất giữ dáng áo hiện tại, chuyển sang sắc <strong>Bạch Ngọc</strong> thanh tĩnh và quần lĩnh đen trang nghiêm.`;
      } else if (spaceLower.includes('đám cưới') || spaceLower.includes('hỷ sự') || isWedding) {
        suggestedColorCode = 'XichKim';
        suggestedColorName = 'Xích Kim Cung Đình (Đỏ Son)';
        reason = `Hỷ sự đòi hỏi sắc màu hân hoan thay vì sắc tối u. Chuyên gia đề xuất chuyển sang tông <strong>Xích Kim</strong> để rạng rỡ phúc lộc.`;
      } else if (isPantsClash) {
        suggestedPantsId = (state.gender === 'Nam') ? 'quan_dui_nam_3' : 'quan_linh_nu_4';
        reason = `Điển chế cổ phục yêu cầu sự đồng điệu. Chuyên gia đề xuất chuyển về đúng <strong>Quần Lĩnh Đen truyền thống</strong> để chuẩn chỉnh nguyên tắc phối y quan.`;
      } else {
        reason = `Hiệu chỉnh màu sắc và thành phần phối đồ để đạt độ chuẩn mực di sản tuyệt đối.`;
      }

      smartSuggestion = {
        title: "✨ GỢI Ý CHUYÊN GIA: GIỮ PHOM ÁO - HOÁ GIẢI ĐẠI KỊ",
        colorCode: suggestedColorCode,
        colorName: suggestedColorName,
        pantsId: suggestedPantsId,
        reason: reason
      };
    }

    return {
      totalScore,
      contextScore,
      weatherScore,
      ensembleScore,
      aestheticsScore,
      badgeText,
      badgeColor,
      warningIcon,
      warningText,
      contextReview,
      weatherReview,
      ensembleReview,
      expertAdvice,
      smartSuggestion
    };
  }

  function renderResultShowcase() {
    // Đóng tất cả tab nhận xét để hiển thị bảng điểm gọn gàng mặc định
    document.querySelectorAll('.score-pillar-card').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.culture-section-item').forEach(sec => sec.classList.remove('active'));

    const currentGender = selectionState.gender;
    const outfit = OUTFITS_INFO[currentGender]?.[selectionState.outfitType] || OUTFITS_INFO.Nu.aotac;

    // 1. Ảnh lớn kết quả từ Dataset 200 bộ
    const mainImgSrc = getCostumeImageSrc(selectionState.colorCode, currentGender, selectionState.outfitType);
    const resultImg = document.getElementById('result-main-image');
    if (resultImg) {
      resultImg.src = mainImgSrc;
      resultImg.alt = `${outfit.name} - ${selectionState.colorName}`;
    }

    // 2. Hiển thị Quần đã chọn
    const pantsList = PANTS_DATASET[currentGender] || PANTS_DATASET.Nu;
    const selectedPants = pantsList.find(p => p.id === selectionState.pantsId) || pantsList[0];
    const attachedPantsImg = document.getElementById('attached-pants-img');
    const attachedPantsName = document.getElementById('attached-pants-name');
    if (attachedPantsImg) {
      attachedPantsImg.src = getItemImageUrl(selectedPants.id, selectedPants.file);
      attachedPantsImg.alt = selectedPants.name;
    }
    if (attachedPantsName) {
      attachedPantsName.textContent = selectedPants.name;
    }

    // 3. Hiện rõ hình ảnh các phụ kiện đi kèm đã chọn (Tối đa 4 món)
    const attachedAccGrid = document.getElementById('attached-accessories-grid');
    const resultAccCount = document.getElementById('result-acc-count');
    const chosenAccList = ACCESSORIES_DATASET.filter(a => selectionState.selectedAccessories.includes(a.id));

    if (resultAccCount) {
      resultAccCount.textContent = chosenAccList.length;
    }

    if (attachedAccGrid) {
      if (chosenAccList.length === 0) {
        attachedAccGrid.innerHTML = `
          <div style="grid-column: 1 / -1; font-size: 13px; color: rgba(253,245,244,0.7); text-align: center; padding: 12px;">
            Không kèm phụ kiện phụ (0/4).
          </div>
        `;
      } else {
        attachedAccGrid.innerHTML = chosenAccList.map(a => `
          <div class="attached-acc-thumb-card">
            <img src="${getItemImageUrl(a.id, a.file)}" alt="${a.name}" class="attached-acc-img" onerror="this.onerror=null; this.src='https://lh3.googleusercontent.com/d/11-mBjdmU7izcCsuVvCj09w_STMrDjykp';">
            <span class="attached-acc-name">${a.name}</span>
          </div>
        `).join('');
      }
    }

    // 4. CHẠY ĐỘNG CƠ ĐÁNH GIÁ CHUYÊN GIA DI SẢN (4 TRỤ CỘT)
    const evalResult = evaluateCulturalOutfit(selectionState, outfit, selectedPants, chosenAccList);

    // Cập nhật tổng điểm & thanh tiến trình
    const scoreBadge = document.getElementById('result-score-badge');
    const scoreBar = document.getElementById('result-score-bar');
    if (scoreBadge) {
      scoreBadge.textContent = evalResult.badgeText;
      scoreBadge.style.color = evalResult.badgeColor;
      scoreBadge.style.borderColor = evalResult.badgeColor;
    }
    if (scoreBar) {
      scoreBar.style.width = `${evalResult.totalScore}%`;
    }

    // Cập nhật 4 Trụ cột điểm chi tiết
    const pContext = document.getElementById('score-pillar-context');
    const fContext = document.getElementById('fill-pillar-context');
    if (pContext && fContext) {
      pContext.textContent = `${evalResult.contextScore}/25`;
      fContext.style.width = `${(evalResult.contextScore / 25) * 100}%`;
    }

    const pTime = document.getElementById('score-pillar-time');
    const fTime = document.getElementById('fill-pillar-time');
    if (pTime && fTime) {
      pTime.textContent = `${evalResult.weatherScore}/25`;
      fTime.style.width = `${(evalResult.weatherScore / 25) * 100}%`;
    }

    const pEnsemble = document.getElementById('score-pillar-ensemble');
    const fEnsemble = document.getElementById('fill-pillar-ensemble');
    if (pEnsemble && fEnsemble) {
      pEnsemble.textContent = `${evalResult.ensembleScore}/25`;
      fEnsemble.style.width = `${(evalResult.ensembleScore / 25) * 100}%`;
    }

    const pAes = document.getElementById('score-pillar-aesthetics');
    const fAes = document.getElementById('fill-pillar-aesthetics');
    if (pAes && fAes) {
      pAes.textContent = `${evalResult.aestheticsScore}/25`;
      fAes.style.width = `${(evalResult.aestheticsScore / 25) * 100}%`;
    }

    // 5. Phần Cảnh Báo / Bảo Chứng Phù Hợp Văn Hóa
    const warningText = document.getElementById('cultural-warning-text');
    const warningBox = document.getElementById('cultural-warning-box');
    const warningIcon = document.getElementById('cultural-warning-icon');
    if (warningText) {
      warningText.innerHTML = evalResult.warningText;
    }
    if (warningIcon) {
      warningIcon.textContent = evalResult.warningIcon;
      warningIcon.style.color = evalResult.badgeColor;
    }
    if (warningBox) {
      warningBox.style.borderColor = evalResult.badgeColor;
    }

    // Xử lý render Smart Remedy Container
    const remedyContainer = document.getElementById('smart-remedy-container');
    if (remedyContainer) {
      if (evalResult.smartSuggestion) {
        remedyContainer.innerHTML = `
          <div class="smart-remedy-card">
            <div class="smart-remedy-title"><span>💡</span> ${evalResult.smartSuggestion.title}</div>
            <div class="smart-remedy-desc">${evalResult.smartSuggestion.reason}</div>
            <button type="button" class="btn-smart-apply" id="btn-apply-smart-remedy">
              ✨ Áp dụng trang phục chuẩn này ngay
            </button>
          </div>
        `;

        // Lắng nghe sự kiện click để tự động fix state và re-render
        const applyBtn = document.getElementById('btn-apply-smart-remedy');
        if (applyBtn) {
          applyBtn.onclick = () => {
            selectionState.colorCode = evalResult.smartSuggestion.colorCode;
            selectionState.colorName = evalResult.smartSuggestion.colorName;

            let pId = evalResult.smartSuggestion.pantsId;
            if (pId.includes('quan_dui')) pId = 'quan_dui';
            else if (pId.includes('quan_linh')) pId = 'quan_linh';
            else if (pId.includes('quan_so')) pId = 'quan_so';
            selectionState.pantsId = pId;

            renderOutfitCatalog();
            renderColorPalettes();
            renderPantsCatalog();
            updateQuickSummary();

            // Gọi lại hàm render để cập nhật toàn bộ giao diện và tăng điểm số lên 95-100%
            renderResultShowcase();
          };
        }
      } else {
        remedyContainer.innerHTML = ''; // Ẩn đi nếu không có đại kị
      }
    }

    // 6. Tiêu đề, Niên đại
    const titleElem = document.getElementById('result-outfit-title');
    if (titleElem) {
      titleElem.textContent = `${outfit.name} – Tông ${selectionState.colorName}`;
    }

    const eraElem = document.getElementById('result-outfit-era');
    if (eraElem) {
      eraElem.textContent = `Niên đại: ${outfit.era}`;
    }

    // 7. Chi tiết đánh giá chuyên gia 4 phần
    const weatherRevElem = document.getElementById('result-expert-weather-review');
    if (weatherRevElem) {
      weatherRevElem.innerHTML = evalResult.weatherReview;
    }

    const contextRevElem = document.getElementById('result-expert-context-review');
    if (contextRevElem) {
      contextRevElem.innerHTML = evalResult.contextReview;
    }

    const ensembleRevElem = document.getElementById('result-expert-ensemble-review');
    if (ensembleRevElem) {
      ensembleRevElem.innerHTML = evalResult.ensembleReview;
    }

    const meaningElem = document.getElementById('result-outfit-meaning');
    if (meaningElem) {
      meaningElem.textContent = outfit.meaning;
    }

    const adviceElem = document.getElementById('result-expert-advice');
    if (adviceElem) {
      adviceElem.innerHTML = evalResult.expertAdvice;
    }

    // 8. Danh sách tổng hợp thành phần đang mặc
    const compList = document.getElementById('result-components-list');
    if (compList) {
      const accNames = chosenAccList.map(a => a.name).join(', ') || 'Không kèm phụ kiện phụ';
      compList.innerHTML = `
        <li class="outfit-component-entry"><strong>Bối cảnh không gian:</strong> ${selectionState.spaceContext}</li>
        <li class="outfit-component-entry"><strong>Thời gian chụp / diễn ra:</strong> ${selectionState.timeContext}</li>
        <li class="outfit-component-entry"><strong>Áo chủ đạo:</strong> ${outfit.name} (Tông màu: ${selectionState.colorName})</li>
        <li class="outfit-component-entry"><strong>Quần đi kèm:</strong> ${selectedPants.name}</li>
        <li class="outfit-component-entry"><strong>Giới tính:</strong> ${currentGender === 'Nam' ? 'Nam giới' : 'Nữ giới'}</li>
        <li class="outfit-component-entry"><strong>Phụ kiện đi kèm (${chosenAccList.length}/4):</strong> ${accNames}</li>
      `;
    }

    // Lưu vào lịch sử "Đồ đã lưu"
    saveCurrentOutfitToStorage();
  }

  // =========================================================================
  // 8. TÍCH HỢP PHÓNG TO ẢNH KẾT QUẢ
  // =========================================================================

  const showcaseFrame = document.getElementById('showcase-img-frame');
  const btnZoomResult = document.getElementById('btn-zoom-result');
  const modalLightbox = document.getElementById('modal-lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const btnCloseLightbox = document.getElementById('btn-close-lightbox');

  function openZoomModal() {
    const currentSrc = document.getElementById('result-main-image')?.getAttribute('src') || '';
    if (lightboxImg && modalLightbox) {
      lightboxImg.src = currentSrc;
      modalLightbox.classList.add('active');
    }
  }

  if (showcaseFrame) {
    showcaseFrame.addEventListener('click', openZoomModal);
  }
  if (btnZoomResult) {
    btnZoomResult.addEventListener('click', openZoomModal);
  }
  if (btnCloseLightbox && modalLightbox) {
    btnCloseLightbox.addEventListener('click', () => {
      modalLightbox.classList.remove('active');
    });
  }

  // =========================================================================
  // 9. CHIA SẺ PHỐI ĐỒ: KHÔNG BỊ 404, HIỆN PREVIEW ẢNH
  // =========================================================================

  const btnShareResult = document.getElementById('btn-share-result');
  const modalSharePreview = document.getElementById('modal-share-preview');
  const btnCloseShare = document.getElementById('btn-close-share');
  const shareCardImg = document.getElementById('share-card-img');
  const shareCardTitle = document.getElementById('share-card-title');
  const shareCardContext = document.getElementById('share-card-context');
  const shareUrlInput = document.getElementById('share-url-input');
  const btnCopyShareUrl = document.getElementById('btn-copy-share-url');

  if (btnShareResult && modalSharePreview) {
    btnShareResult.addEventListener('click', () => {
      const currentSrc = document.getElementById('result-main-image')?.getAttribute('src') || '';
      const outfit = OUTFITS_INFO[selectionState.gender]?.[selectionState.outfitType] || OUTFITS_INFO.Nu.aotac;
      
      if (shareCardImg) shareCardImg.src = currentSrc;
      if (shareCardTitle) shareCardTitle.textContent = `${outfit.name} (${selectionState.colorName})`;
      if (shareCardContext) shareCardContext.textContent = `Bối cảnh: ${selectionState.spaceContext} • ${selectionState.timeContext}`;

      const validShareUrl = `${window.location.origin}${window.location.pathname}?remix=${selectionState.outfitType}&color=${selectionState.colorCode}&gender=${selectionState.gender}&pants=${selectionState.pantsId}&space=${encodeURIComponent(selectionState.spaceContext)}`;
      if (shareUrlInput) shareUrlInput.value = validShareUrl;

      modalSharePreview.classList.add('active');
    });
  }

  if (btnCloseShare && modalSharePreview) {
    btnCloseShare.addEventListener('click', () => modalSharePreview.classList.remove('active'));
  }

  if (btnCopyShareUrl && shareUrlInput) {
    btnCopyShareUrl.addEventListener('click', () => {
      shareUrlInput.select();
      navigator.clipboard.writeText(shareUrlInput.value).then(() => {
        btnCopyShareUrl.textContent = '✓ Đã chép!';
        setTimeout(() => {
          btnCopyShareUrl.textContent = 'Sao chép';
        }, 2000);
      });
    });
  }

  // =========================================================================
  // 10. MODAL ĐỒ ĐÃ LƯU
  // =========================================================================

  function saveCurrentOutfitToStorage() {
    const outfit = OUTFITS_INFO[selectionState.gender]?.[selectionState.outfitType] || OUTFITS_INFO.Nu.aotac;
    const pantsList = PANTS_DATASET[selectionState.gender] || PANTS_DATASET.Nu;
    const selectedPants = pantsList.find(p => p.id === selectionState.pantsId) || pantsList[0];
    const accNames = ACCESSORIES_DATASET
      .filter(a => selectionState.selectedAccessories.includes(a.id))
      .map(a => a.name).join(', ') || 'Không kèm';

    const savedItem = {
      title: `${outfit.name} (${selectionState.colorName})`,
      pants: selectedPants.name,
      context: `${selectionState.spaceContext} • ${selectionState.timeContext}`,
      accessories: accNames,
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    };

    try {
      const existing = JSON.parse(localStorage.getItem('viet_phuc_saved_outfits') || '[]');
      if (!existing.some(item => item.title === savedItem.title && item.context === savedItem.context && item.pants === savedItem.pants)) {
        existing.unshift(savedItem);
        if (existing.length > 10) existing.pop();
        localStorage.setItem('viet_phuc_saved_outfits', JSON.stringify(existing));
      }
    } catch (e) {
      console.warn('LocalStorage warning:', e);
    }
  }

  function updateModalBodyLock() {
    const anyActive = document.querySelectorAll('.modal-overlay.active').length > 0;
    document.body.classList.toggle('modal-open', anyActive);
  }

  const btnOpenSaved = document.getElementById('btn-open-saved');
  const modalSaved = document.getElementById('modal-saved-outfits');
  const btnCloseSaved = document.getElementById('btn-close-saved');
  const savedListContainer = document.getElementById('saved-outfits-list-container');

  function renderSavedOutfitsList() {
    try {
      const savedList = JSON.parse(localStorage.getItem('viet_phuc_saved_outfits') || '[]');
      if (savedListContainer) {
        if (savedList.length === 0) {
          savedListContainer.innerHTML = '<p style="color: rgba(253,245,244,0.7); text-align: center; padding: 20px;">Chưa có bộ trang phục nào được lưu.</p>';
        } else {
          savedListContainer.innerHTML = savedList.map((item, idx) => `
            <div class="saved-outfit-item" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; position: relative;">
              <div>
                <h4 style="color: #FFFFFF; font-size: 15px; font-weight: 800;">${item.title}</h4>
                <p style="color: var(--color-gold-light); font-size: 13px; margin-top: 2px;">👖 Quần: ${item.pants || 'Chuẩn mực'}</p>
                <p style="color: rgba(253,245,244,0.85); font-size: 13px; margin-top: 2px;">📍 Bối cảnh: ${item.context}</p>
                <p style="color: rgba(253,245,244,0.75); font-size: 12px; margin-top: 2px;">💎 Phụ kiện: ${item.accessories}</p>
                <span style="font-size: 11.5px; color: rgba(253,245,244,0.6); display: inline-block; margin-top: 4px;">${item.time}</span>
              </div>
              <button type="button" class="btn-delete-saved" data-index="${idx}" title="Xóa bộ phối đồ này" style="background: rgba(239,68,68,0.2); border: 1px solid #EF4444; color: #EF4444; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; transition: all 0.2s;">✕</button>
            </div>
          `).join('');

          savedListContainer.querySelectorAll('.btn-delete-saved').forEach(btn => {
            btn.addEventListener('click', (e) => {
              e.stopPropagation();
              const index = parseInt(btn.getAttribute('data-index'), 10);
              let list = JSON.parse(localStorage.getItem('viet_phuc_saved_outfits') || '[]');
              list.splice(index, 1);
              localStorage.setItem('viet_phuc_saved_outfits', JSON.stringify(list));
              renderSavedOutfitsList();
            });
          });
        }
      }
    } catch (e) {
      console.warn(e);
    }
  }

  if (btnOpenSaved && modalSaved) {
    btnOpenSaved.addEventListener('click', () => {
      renderSavedOutfitsList();
      modalSaved.classList.add('active');
      updateModalBodyLock();
    });
  }

  if (btnCloseSaved && modalSaved) {
    btnCloseSaved.addEventListener('click', () => {
      modalSaved.classList.remove('active');
      updateModalBodyLock();
    });
  }

  // =========================================================================
  // 11. LẬT FLASHCARD Ở WINDOW 4 (ĐÃ XÓA CHỮ MẶT SAU)
  // =========================================================================

  const flashcardInners = document.querySelectorAll('.flashcard-inner');
  flashcardInners.forEach(card => {
    card.addEventListener('click', () => {
      card.classList.toggle('flipped');
    });
  });

  // =========================================================================
  // 12. SUPABASE AUTHENTICATION: ĐĂNG NHẬP, ĐĂNG KÝ, QUẢN LÝ PHIÊN
  // =========================================================================

  let toastTimer = null;
  function showToastNotification(message, isError = false) {
    const toast = document.getElementById('toast-notify');
    if (!toast) return;
    toast.textContent = message;
    if (isError) {
      toast.style.background = 'linear-gradient(135deg, #991b1b, #7f1d1d)';
      toast.style.borderColor = '#f87171';
      toast.style.color = '#ffffff';
    } else {
      toast.style.background = 'linear-gradient(135deg, #065f46, #047857)';
      toast.style.borderColor = 'var(--color-gold)';
      toast.style.color = '#ffffff';
    }
    toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 3800);
  }

  const modalLogin = document.getElementById('modal-login');
  const modalRegister = document.getElementById('modal-register');
  const btnCloseLogin = document.getElementById('btn-close-login');
  const btnCloseRegister = document.getElementById('btn-close-register');
  const btnSwitchToRegister = document.getElementById('btn-switch-to-register');
  const btnSwitchToLogin = document.getElementById('btn-switch-to-login');

  if (btnCloseLogin && modalLogin) {
    btnCloseLogin.addEventListener('click', () => modalLogin.classList.remove('active'));
  }

  if (btnCloseRegister && modalRegister) {
    btnCloseRegister.addEventListener('click', () => modalRegister.classList.remove('active'));
  }

  if (btnSwitchToRegister && modalLogin && modalRegister) {
    btnSwitchToRegister.addEventListener('click', () => {
      modalLogin.classList.remove('active');
      modalRegister.classList.add('active');
    });
  }

  if (btnSwitchToLogin && modalLogin && modalRegister) {
    btnSwitchToLogin.addEventListener('click', () => {
      modalRegister.classList.remove('active');
      modalLogin.classList.add('active');
    });
  }

  let currentUser = null;

  // Cập nhật giao diện Header & Mobile Drawer khi có / không có đăng nhập
  function updateAuthUI(user) {
    const headerAuthWrap = document.getElementById('header-auth-wrap');
    const mobileAuthWrap = document.getElementById('mobile-nav-auth-wrap');

    if (user) {
      // Lấy tên hiển thị ưu tiên theo thứ tự: Google Metadata -> Full name -> Email -> Username
      const displayName = 
        user.user_metadata?.full_name || 
        user.user_metadata?.name || 
        user.full_name || 
        (user.email ? user.email.split('@')[0] : user.username) || 
        'Thành viên';

      const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture;
      const avatarIcon = avatarUrl 
        ? `<img src="${avatarUrl}" alt="Avatar" style="width: 22px; height: 22px; border-radius: 50%; object-fit: cover; border: 1.5px solid var(--color-gold);">` 
        : `<span style="font-size: 14px;">👤</span>`;

      // 1. Desktop Header
      if (headerAuthWrap) {
        headerAuthWrap.innerHTML = `
          <div class="user-profile-badge" style="display: inline-flex; align-items: center; gap: 8px; background: rgba(12, 87, 118, 0.45); border: 1.5px solid var(--color-gold); padding: 5px 14px; border-radius: 20px; box-shadow: 0 0 12px rgba(212, 175, 55, 0.3);">
            ${avatarIcon}
            <span style="font-size: 13.5px; font-weight: 700; color: #FFFFFF; font-family: var(--font-serif);">${displayName}</span>
          </div>
          <button type="button" class="nav-btn-auth" id="btn-logout" style="padding: 7px 16px; font-size: 12.5px; border-color: rgba(253,245,244,0.4);">
            Đăng xuất
          </button>
        `;
        const btnLogout = document.getElementById('btn-logout');
        if (btnLogout) {
          btnLogout.addEventListener('click', logoutUser);
        }
      }

      // 2. Mobile Drawer
      if (mobileAuthWrap) {
        mobileAuthWrap.innerHTML = `
          <div style="background: rgba(12, 87, 118, 0.4); border: 1.5px solid var(--color-gold); border-radius: 14px; padding: 12px 14px; text-align: center; margin-bottom: 10px;">
            <div style="font-size: 11px; color: var(--color-gold-light); text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Thành viên đang đăng nhập</div>
            <div style="font-size: 16px; font-weight: 800; color: #FFFFFF; margin-top: 6px; font-family: var(--font-serif); display: flex; align-items: center; justify-content: center; gap: 8px;">
              ${avatarIcon}
              <span>${displayName}</span>
            </div>
          </div>
          <button type="button" class="mobile-auth-btn mobile-btn-register" id="mobile-btn-logout">
            Đăng xuất tài khoản
          </button>
        `;
        const mobileBtnLogout = document.getElementById('mobile-btn-logout');
        if (mobileBtnLogout) {
          mobileBtnLogout.addEventListener('click', () => {
            closeMobileNav();
            logoutUser();
          });
        }
      }
    } else {
      // Khôi phục nút Đăng ký & Đăng nhập ban đầu
      if (headerAuthWrap) {
        headerAuthWrap.innerHTML = `
          <button type="button" class="nav-btn-auth" id="btn-open-register">Đăng ký</button>
          <button type="button" class="nav-btn-highlight" id="btn-open-login">Đăng nhập</button>
        `;
        const bRegister = document.getElementById('btn-open-register');
        const bLogin = document.getElementById('btn-open-login');
        if (bRegister && modalRegister) bRegister.addEventListener('click', () => modalRegister.classList.add('active'));
        if (bLogin && modalLogin) bLogin.addEventListener('click', () => modalLogin.classList.add('active'));
      }

      if (mobileAuthWrap) {
        mobileAuthWrap.innerHTML = `
          <button type="button" class="mobile-auth-btn mobile-btn-register" id="mobile-btn-register">Đăng ký tài khoản</button>
          <button type="button" class="mobile-auth-btn mobile-btn-login" id="mobile-btn-login">Đăng nhập</button>
        `;
        const mRegister = document.getElementById('mobile-btn-register');
        const mLogin = document.getElementById('mobile-btn-login');
        if (mRegister && modalRegister) {
          mRegister.addEventListener('click', () => {
            closeMobileNav();
            modalRegister.classList.add('active');
          });
        }
        if (mLogin && modalLogin) {
          mLogin.addEventListener('click', () => {
            closeMobileNav();
            modalLogin.classList.add('active');
          });
        }
      }
    }
  }

  // Kiểm tra phiên đăng nhập từ Supabase Auth
  async function checkAuthSession() {
    const savedUserStr = localStorage.getItem('vietphuc_user');
    if (savedUserStr) {
      try {
        currentUser = JSON.parse(savedUserStr);
        updateAuthUI(currentUser);
      } catch (e) {}
    }

    try {
      // 1. Kiểm tra session hiện tại trong Supabase Client
      const { data, error } = await supabase.auth.getSession();
      if (data?.session?.user) {
        currentUser = data.session.user;
        localStorage.setItem('vietphuc_user', JSON.stringify(currentUser));
        if (data.session.access_token) {
          localStorage.setItem('vietphuc_auth_token', data.session.access_token);
        }
        updateAuthUI(currentUser);
        return;
      }

      // 2. Nếu getSession chưa có session nhưng có token lưu trong localStorage
      const token = localStorage.getItem('vietphuc_auth_token');
      if (token) {
        const { data: userData, error: userError } = await supabase.auth.getUser(token);
        if (userData?.user) {
          currentUser = userData.user;
          localStorage.setItem('vietphuc_user', JSON.stringify(currentUser));
          updateAuthUI(currentUser);
          return;
        }
      }

      // 3. Nếu không có phiên hợp lệ và không có savedUserStr
      if (!savedUserStr) {
        localStorage.removeItem('vietphuc_auth_token');
        localStorage.removeItem('vietphuc_user');
        currentUser = null;
        updateAuthUI(null);
      }
    } catch (e) {
      console.warn('Lỗi kiểm tra phiên Supabase Auth:', e);
    }
  }

  // Đăng xuất
  async function logoutUser() {
    try {
      await supabase.auth.signOut();
    } catch (e) {}
    localStorage.removeItem('vietphuc_auth_token');
    localStorage.removeItem('vietphuc_user');
    currentUser = null;
    updateAuthUI(null);
    showToastNotification('Đã đăng xuất tài khoản thành công!');
  }

  // Submit Đăng Nhập (form-login)
  const formLogin = document.getElementById('form-login');
  if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const emailInput = document.getElementById('login-username');
      const passwordInput = document.getElementById('login-password');
      const submitBtn = document.getElementById('btn-submit-login');

      const email = emailInput ? emailInput.value.trim() : '';
      const password = passwordInput ? passwordInput.value : '';

      if (!email || !password) {
        showToastNotification('Vui lòng nhập đầy đủ Email và mật khẩu!', true);
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Đang xác thực tài khoản...';
      }

      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email,
          password: password,
        });

        if (error) {
          showToastNotification(error.message || 'Email hoặc mật khẩu không chính xác!', true);
        } else {
          currentUser = data.user;
          localStorage.setItem('vietphuc_user', JSON.stringify(data.user));
          if (data.session?.access_token) {
            localStorage.setItem('vietphuc_auth_token', data.session.access_token);
          }
          updateAuthUI(currentUser);
          showToastNotification('Đăng nhập thành công!');

          // TỰ ĐỘNG ĐÓNG CỬA SỔ ĐĂNG NHẬP & XÓA TRẮNG FORM
          const modalLogin = document.getElementById('modal-login');
          if (modalLogin) {
            modalLogin.classList.remove('active');
          }
          if (emailInput) emailInput.value = '';
          if (passwordInput) passwordInput.value = '';
        }
      } catch (err) {
        showToastNotification('Lỗi kết nối khi đăng nhập!', true);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Xác Nhận Đăng Nhập';
        }
      }
    });
  }

  // Submit Đăng Ký (form-register)
  const formRegister = document.getElementById('form-register');
  if (formRegister) {
    formRegister.addEventListener('submit', async (e) => {
      e.preventDefault();
      const emailInput = document.getElementById('reg-username');
      const passwordInput = document.getElementById('reg-password');
      const confirmInput = document.getElementById('reg-password-confirm');
      const submitBtn = document.getElementById('btn-submit-register');

      const email = emailInput ? emailInput.value.trim() : '';
      const password = passwordInput ? passwordInput.value : '';
      const confirmPassword = confirmInput ? confirmInput.value : '';

      if (!email || !password) {
        showToastNotification('Vui lòng nhập đầy đủ thông tin đăng ký!', true);
        return;
      }

      if (password.length < 6) {
        showToastNotification('Mật khẩu phải có độ dài ít nhất 6 ký tự!', true);
        return;
      }

      if (password !== confirmPassword) {
        showToastNotification('Mật khẩu nhập lại không khớp. Vui lòng kiểm tra lại!', true);
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Đang khởi tạo tài khoản...';
      }

      try {
        const { data, error } = await supabase.auth.signUp({
          email: email,
          password: password,
          options: {
            data: { full_name: email.split('@')[0] }
          }
        });

        if (error) {
          showToastNotification(error.message || 'Không thể đăng ký tài khoản!', true);
        } else {
          showToastNotification('Đăng ký thành công! Đang chuyển sang màn hình đăng nhập...');
          
          // Chuyển sang modal đăng nhập và điền sẵn email
          const modalRegister = document.getElementById('modal-register');
          const modalLogin = document.getElementById('modal-login');
          if (modalRegister) modalRegister.classList.remove('active');
          if (modalLogin) modalLogin.classList.add('active');

          const loginEmailInput = document.getElementById('login-username');
          if (loginEmailInput) loginEmailInput.value = email;
          if (emailInput) emailInput.value = '';
          if (passwordInput) passwordInput.value = '';
          if (confirmInput) confirmInput.value = '';
        }
      } catch (err) {
        showToastNotification('Lỗi kết nối khi đăng ký!', true);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Xác Nhận Đăng Ký';
        }
      }
    });
  }

  // Xử lý Google OAuth Login & Register (Dùng domain động window.location.origin)
  const btnGoogleLogin = document.getElementById('btn-google-login');
  const btnGoogleRegister = document.getElementById('btn-google-register');

  function handleGoogleAuth() {
    const isCloudEnv = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
    if (isCloudEnv) {
      const userConfirm = confirm(
        "⚠️ LƯU Ý KHI ĐĂNG NHẬP GOOGLE TRÊN CLOUD:\n\n" +
        "Hiện tại hệ thống Supabase Auth của dự án đang cấu hình mặc định chuyển hướng kết quả về máy cục bộ 'localhost:3000'.\n\n" +
        "👉 Để khắc phục triệt để: Bạn hãy vào Supabase Console > Authentication > URL Configuration > Thêm địa chỉ trang web hiện tại vào danh sách 'Redirect URLs'.\n\n" +
        "💡 GIẢI PHÁP TIỆN LỢI NGAY LẬP TỨC:\n" +
        "Bạn hãy ĐĂNG KÝ hoặc ĐĂNG NHẬP bằng Email & Mật khẩu ngay trên ứng dụng này (100% dữ liệu xử lý trực tiếp trên Cloud, cực kỳ nhanh chóng).\n" +
        "Ví dụ tài khoản đã tạo sẵn cho bạn:\n" +
        "• Tài khoản/Email: dev123@gmail.com\n" +
        "• Mật khẩu: 123456\n\n" +
        "Bạn có muốn tiếp tục tiến hành Đăng nhập với Google không?"
      );
      if (!userConfirm) return;
    }

    const redirectUrl = `${window.location.origin}`;
    const googleAuthUrl = `https://zertfkpvzmtckgbmleql.supabase.co/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectUrl)}`;
    
    // Mở OAuth trong Popup window để không bị cản bởi iframe security/403
    const authWindow = window.open(googleAuthUrl, 'google_oauth_popup', 'width=550,height=650');
    if (!authWindow) {
      window.location.href = googleAuthUrl;
    }
  }

  if (btnGoogleLogin) btnGoogleLogin.addEventListener('click', handleGoogleAuth);
  if (btnGoogleRegister) btnGoogleRegister.addEventListener('click', handleGoogleAuth);

  // Lắng nghe sự kiện đăng nhập từ Popup
  window.addEventListener('message', async (event) => {
    if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
      if (event.data.token) {
        localStorage.setItem('vietphuc_auth_token', event.data.token);
      }
      if (event.data.user) {
        currentUser = event.data.user;
        localStorage.setItem('vietphuc_user', JSON.stringify(currentUser));
        updateAuthUI(currentUser);
      }
      await checkAuthSession();
      showToastNotification('Đăng nhập với Google thành công!');

      const modalLogin = document.getElementById('modal-login');
      const modalRegister = document.getElementById('modal-register');
      if (modalLogin) modalLogin.classList.remove('active');
      if (modalRegister) modalRegister.classList.remove('active');
    }
  });

  // Kiểm tra callback OAuth Google từ URL (nếu có #access_token hoặc token trong URL)
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  const oauthToken = hashParams.get('access_token');
  const oauthRefreshToken = hashParams.get('refresh_token');

  if (oauthToken) {
    localStorage.setItem('vietphuc_auth_token', oauthToken);

    (async () => {
      try {
        if (oauthRefreshToken) {
          const { data } = await supabase.auth.setSession({
            access_token: oauthToken,
            refresh_token: oauthRefreshToken
          });
          if (data?.user) {
            currentUser = data.user;
            localStorage.setItem('vietphuc_user', JSON.stringify(data.user));
            updateAuthUI(currentUser);
          }
        } else {
          const { data } = await supabase.auth.getUser(oauthToken);
          if (data?.user) {
            currentUser = data.user;
            localStorage.setItem('vietphuc_user', JSON.stringify(data.user));
            updateAuthUI(currentUser);
          }
        }
      } catch (e) {
        console.warn('Lỗi lưu phiên OAuth Google:', e);
      }

      window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
      showToastNotification('Đăng nhập với Google thành công!');

      const modalLogin = document.getElementById('modal-login');
      const modalRegister = document.getElementById('modal-register');
      if (modalLogin) modalLogin.classList.remove('active');
      if (modalRegister) modalRegister.classList.remove('active');

      if (window.opener) {
        try {
          window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', token: oauthToken, user: currentUser }, '*');
          window.close();
        } catch (e) {}
      }
    })();
  }

  // Lắng nghe trực tiếp các thay đổi phiên đăng nhập từ Supabase
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      currentUser = session.user;
      localStorage.setItem('vietphuc_user', JSON.stringify(currentUser));
      if (session.access_token) {
        localStorage.setItem('vietphuc_auth_token', session.access_token);
      }
      updateAuthUI(currentUser);
      const modalLogin = document.getElementById('modal-login');
      const modalRegister = document.getElementById('modal-register');
      if (modalLogin) modalLogin.classList.remove('active');
      if (modalRegister) modalRegister.classList.remove('active');
    } else if (event === 'SIGNED_OUT') {
      currentUser = null;
      localStorage.removeItem('vietphuc_auth_token');
      localStorage.removeItem('vietphuc_user');
      updateAuthUI(null);
    }
  });

  // Khởi chạy kiểm tra phiên đăng nhập ngay khi trang tải xong
  checkAuthSession();

  // =========================================================================
  // 13. VIDEO DEMO TRONG WINDOW 2
  // =========================================================================

  const videoOverlay = document.getElementById('w2-video-overlay');
  const demoVideo = document.getElementById('w2-demo-video');
  if (videoOverlay && demoVideo) {
    videoOverlay.addEventListener('click', () => {
      videoOverlay.style.display = 'none';
      demoVideo.play().catch(() => {});
    });

    demoVideo.addEventListener('pause', () => {
      if (demoVideo.currentTime === 0 || demoVideo.ended) {
        videoOverlay.style.display = 'flex';
      }
    });
  }

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('active');
        updateModalBodyLock();
      }
    });
  });

  // Tự động kiểm tra URL params nếu được truy cập qua link chia sẻ
  const urlParams = new URLSearchParams(window.location.search);
  const remixParam = urlParams.get('remix');
  if (remixParam) {
    const genderParam = urlParams.get('gender') || 'Nu';
    selectionState.gender = genderParam;
    if (OUTFITS_INFO[genderParam]?.[remixParam]) {
      selectionState.outfitType = remixParam;
    }
    const colorParam = urlParams.get('color');
    if (colorParam && COLOR_PALETTES.some(c => c.code === colorParam)) {
      selectionState.colorCode = colorParam;
      selectionState.colorName = COLOR_PALETTES.find(c => c.code === colorParam)?.name || selectionState.colorName;
    }
    const pantsParam = urlParams.get('pants');
    if (pantsParam) selectionState.pantsId = pantsParam;
    const spaceParam = urlParams.get('space');
    if (spaceParam) selectionState.spaceContext = decodeURIComponent(spaceParam);

    showWindow('window-3');
    goToStep(3);
  }

  // =========================================================================
  // QUẢN TRỊ ĐỒNG BỘ: GOOGLE SHEETS & GOOGLE DRIVE SANG SUPABASE
  // =========================================================================
  const modalAdminSync = document.getElementById('modal-admin-sync');
  // Khởi tạo các catalog ở Bước 2
  loadApiItems();
  renderOutfitCatalog();
  renderColorPalettes();
  renderPantsCatalog();
  renderAccessoriesCatalog();
  updateQuickSummary();
});
