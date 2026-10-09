import fs from "fs";
import path from "path";
import { google } from "googleapis";
function extractGoogleDriveFileId(input) {
  if (!input || typeof input !== "string") return null;
  const trimmed = input.trim();
  const fileDMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]{20,})/);
  if (fileDMatch && fileDMatch[1]) return fileDMatch[1];
  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
  if (idParamMatch && idParamMatch[1]) return idParamMatch[1];
  const lh3Match = trimmed.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]{20,})/);
  if (lh3Match && lh3Match[1]) return lh3Match[1];
  const thumbMatch = trimmed.match(/thumbnail\?id=([a-zA-Z0-9_-]{20,})/);
  if (thumbMatch && thumbMatch[1]) return thumbMatch[1];
  if (!trimmed.includes("/") && /^[a-zA-Z0-9_-]{25,50}$/.test(trimmed)) {
    return trimmed;
  }
  return null;
}
function toGoogleDriveDirectLink(input, preferredFormat = "lh3") {
  if (!input) return { directUrl: "", isGoogleDrive: false, fileId: null };
  const fileId = extractGoogleDriveFileId(input);
  if (fileId) {
    const directUrl = preferredFormat === "lh3" ? `https://lh3.googleusercontent.com/d/${fileId}` : `https://drive.google.com/uc?export=view&id=${fileId}`;
    return {
      directUrl,
      isGoogleDrive: true,
      fileId
    };
  }
  return {
    directUrl: input.trim(),
    isGoogleDrive: false,
    fileId: null
  };
}
function resolveServiceAccountCredentials(customKey) {
  if (customKey) {
    if (typeof customKey === "object") return customKey;
    if (typeof customKey === "string") {
      try {
        return JSON.parse(customKey);
      } catch (e) {
        console.warn("[Google Auth] Kh\xF4ng th\u1EC3 parse customKey string:", e);
      }
    }
  }
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    try {
      return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    } catch (e) {
      console.warn("[Google Auth] Kh\xF4ng th\u1EC3 parse GOOGLE_SERVICE_ACCOUNT_KEY env:", e);
    }
  }
  const candidatePaths = [
    process.env.GOOGLE_SERVICE_ACCOUNT_PATH,
    path.resolve(process.cwd(), "credentials.json"),
    path.resolve(process.cwd(), "backend", "credentials.json")
  ].filter(Boolean);
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, "utf8");
        return JSON.parse(raw);
      } catch (e) {
        console.warn(`[Google Auth] L\u1ED7i \u0111\u1ECDc file ${p}:`, e);
      }
    }
  }
  return null;
}
async function getGoogleSheetsClient(customCredentials) {
  const credentials = resolveServiceAccountCredentials(customCredentials);
  if (credentials && credentials.client_email && credentials.private_key) {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key.replace(/\\n/g, "\n")
      },
      scopes: [
        "https://www.googleapis.com/auth/spreadsheets.readonly",
        "https://www.googleapis.com/auth/drive.readonly"
      ]
    });
    const sheets = google.sheets({ version: "v4", auth });
    return {
      sheets,
      authType: "service_account",
      clientEmail: credentials.client_email,
      projectId: credentials.project_id || "unknown"
    };
  }
  return {
    sheets: null,
    authType: "none",
    clientEmail: null,
    projectId: null
  };
}
async function fetchPublicSheetCsvRows(sheetId, sheetName = "Items") {
  const encodedSheet = encodeURIComponent(sheetName);
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodedSheet}`;
  const res = await fetch(csvUrl);
  if (!res.ok) {
    const fallbackUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;
    const fallbackRes = await fetch(fallbackUrl);
    if (!fallbackRes.ok) {
      throw new Error(`Kh\xF4ng th\u1EC3 t\u1EA3i Google Sheet c\xF4ng khai (HTTP ${fallbackRes.status}). Vui l\xF2ng chia s\u1EBB Sheet \u1EDF ch\u1EBF \u0111\u1ED9 c\xF4ng khai ho\u1EB7c c\xE0i \u0111\u1EB7t file credentials.json.`);
    }
    const text2 = await fallbackRes.text();
    return parseCsvToRows(text2);
  }
  const text = await res.text();
  return parseCsvToRows(text);
}
function parseCsvToRows(csvText) {
  const rows = [];
  const lines = csvText.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    const row = [];
    let insideQuote = false;
    let entry = "";
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (insideQuote && line[i + 1] === '"') {
          entry += '"';
          i++;
        } else {
          insideQuote = !insideQuote;
        }
      } else if (char === "," && !insideQuote) {
        row.push(entry.trim());
        entry = "";
      } else {
        entry += char;
      }
    }
    row.push(entry.trim());
    rows.push(row);
  }
  return rows;
}
function normalizeColumnHeader(header) {
  const clean = (header || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/^(id|ma|ma_vat_pham|item_id)$/.test(clean)) return "id";
  if (/^(name|ten|ten_vat_pham|ten_trang_phuc|title)$/.test(clean)) return "name";
  if (/^(category|phan_loai|loai|the_loai|type)$/.test(clean)) return "category";
  if (/^(gender|gioi_tinh|phai)$/.test(clean)) return "gender";
  if (/^(colorfolder|color_folder|thu_muc_mau|tong_mau_goc|color_code)$/.test(clean)) return "colorFolder";
  if (/^(colorname|color_name|ten_mau|sac_mau|color)$/.test(clean)) return "colorName";
  if (/^(image_filename|image|link_anh|url_anh|anh|drive_url|hinh_anh|photo)$/.test(clean)) return "image_filename";
  if (/^(description|mo_ta|chi_tiet|gioi_thieu|ghi_chu)$/.test(clean)) return "description";
  if (/^(suitable_events|su_kien|boi_canh|su_kien_phu_hop|events)$/.test(clean)) return "suitable_events";
  if (/^(recommended_colors|mau_phoi|mau_goi_y|mau_khuyen_nghi|colors)$/.test(clean)) return "recommended_colors";
  return clean;
}
async function readItemsFromGoogleSheet(options) {
  const { sheetId, range = "Items!A1:Z", serviceAccountCredentials } = options;
  const errors = [];
  let rawValues = [];
  let authMethod = "public_csv_fallback";
  const { sheets, authType, clientEmail } = await getGoogleSheetsClient(serviceAccountCredentials);
  if (sheets) {
    try {
      console.log(`[Google Sheets API] \u0110ang k\u1EBFt n\u1ED1i b\u1EB1ng Service Account (${clientEmail})...`);
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range
      });
      rawValues = response.data.values || [];
      authMethod = `service_account (${clientEmail})`;
      console.log(`[Google Sheets API] \u0110\xE3 \u0111\u1ECDc th\xE0nh c\xF4ng ${rawValues.length} d\xF2ng t\u1EEB Sheet!`);
    } catch (apiErr) {
      console.warn(`[Google Sheets API Warning] L\u1ED7i Service Account: ${apiErr.message}. Th\u1EED chuy\u1EC3n sang public sheet...`);
      errors.push(`Google Sheets API Service Account error: ${apiErr.message}`);
    }
  }
  if (rawValues.length === 0) {
    try {
      const sheetName = range.split("!")[0] || "Items";
      rawValues = await fetchPublicSheetCsvRows(sheetId, sheetName);
      authMethod = "public_web_export";
      console.log(`[Google Sheets Public] \u0110\xE3 \u0111\u1ECDc ${rawValues.length} d\xF2ng t\u1EEB Google Sheet c\xF4ng khai.`);
    } catch (csvErr) {
      errors.push(`Public export error: ${csvErr.message}`);
    }
  }
  if (rawValues.length === 0) {
    throw new Error(
      `Kh\xF4ng th\u1EC3 \u0111\u1ECDc d\u1EEF li\u1EC7u t\u1EEB Google Sheet (ID: ${sheetId}). Vui l\xF2ng ki\u1EC3m tra: 1) File credentials.json c\xF3 email \u0111\xE3 \u0111\u01B0\u1EE3c Share quy\u1EC1n Viewer tr\xEAn Sheet, ho\u1EB7c 2) Chia s\u1EBB Google Sheet \u1EDF ch\u1EBF \u0111\u1ED9 "B\u1EA5t k\u1EF3 ai c\xF3 li\xEAn k\u1EBFt \u0111\u1EC1u xem \u0111\u01B0\u1EE3c". Chi ti\u1EBFt: ${errors.join(" | ")}`
    );
  }
  const headerRow = rawValues[0].map((h) => String(h || ""));
  const headerMap = {};
  headerRow.forEach((colName, index) => {
    headerMap[index] = normalizeColumnHeader(colName);
  });
  const parsedItems = [];
  let directLinksCount = 0;
  for (let r = 1; r < rawValues.length; r++) {
    const row = rawValues[r];
    if (!row || row.length === 0) continue;
    const itemObj = {};
    row.forEach((val, colIdx) => {
      const fieldKey = headerMap[colIdx];
      if (fieldKey) {
        itemObj[fieldKey] = typeof val === "string" ? val.trim() : val;
      }
    });
    if (!itemObj.id && !itemObj.name) {
      continue;
    }
    let category = "skin";
    const catRaw = String(itemObj.category || "").toLowerCase();
    const idRaw = String(itemObj.id || "").toLowerCase();
    const nameRaw = String(itemObj.name || "").toLowerCase();
    if (catRaw.includes("acc") || catRaw.includes("phu_kien") || catRaw.includes("trang_suc") || catRaw.includes("ph\u1EE5 ki\u1EC7n") || catRaw.includes("trang s\u1EE9c") || catRaw.includes("m\u0169") || catRaw.includes("n\xF3n") || catRaw.includes("kh\u0103n") || catRaw.includes("v\xF2ng") || idRaw.startsWith("khan_") || idRaw.startsWith("non_") || idRaw.startsWith("man_") || idRaw.startsWith("tram_") || idRaw.startsWith("kieng_") || idRaw.startsWith("khuyen_") || idRaw.startsWith("hoa_tai_") || idRaw.startsWith("day_chuyen_") || idRaw.startsWith("vong_") || idRaw.startsWith("lac_") || idRaw.startsWith("choker_") || idRaw.startsWith("quat_") || idRaw.startsWith("bo_3_vong") || idRaw.startsWith("nhan_") || nameRaw.includes("kh\u0103n") || nameRaw.includes("n\xF3n") || nameRaw.includes("m\u1EA5n") || nameRaw.includes("tr\xE2m") || nameRaw.includes("ki\u1EC1ng") || nameRaw.includes("khuy\xEAn") || nameRaw.includes("hoa tai") || nameRaw.includes("d\xE2y chuy\u1EC1n") || nameRaw.includes("v\xF2ng") || nameRaw.includes("l\u1EAFc") || nameRaw.includes("choker") || nameRaw.includes("qu\u1EA1t") || nameRaw.includes("nh\u1EABn")) {
      category = "accessory";
    } else if (idRaw.startsWith("quanlai_") || nameRaw.includes("quan l\u1EA1i") || nameRaw.includes("m\xE3ng b\xE0o")) {
      category = "skin";
    } else if (catRaw.includes("pant") || catRaw.includes("quan") || catRaw.includes("qu\u1EA7n") || idRaw.startsWith("quan_")) {
      category = "pants";
    }
    const rawImage = String(itemObj.image_filename || "");
    const { directUrl, isGoogleDrive } = toGoogleDriveDirectLink(rawImage, "lh3");
    if (isGoogleDrive) {
      directLinksCount++;
    }
    const suitableEvents = Array.isArray(itemObj.suitable_events) ? itemObj.suitable_events : typeof itemObj.suitable_events === "string" && itemObj.suitable_events.length > 0 ? itemObj.suitable_events.split(/[,;]+/).map((s) => s.trim()).filter(Boolean) : [];
    const recommendedColors = Array.isArray(itemObj.recommended_colors) ? itemObj.recommended_colors : typeof itemObj.recommended_colors === "string" && itemObj.recommended_colors.length > 0 ? itemObj.recommended_colors.split(/[,;]+/).map((s) => s.trim()).filter(Boolean) : [];
    const finalItem = {
      id: String(itemObj.id || `item_${r}`),
      name: String(itemObj.name || `V\u1EADt ph\u1EA9m ${r}`),
      category,
      gender: itemObj.gender || "Chung",
      colorFolder: itemObj.colorFolder || "",
      colorName: itemObj.colorName || "",
      image_filename: directUrl || rawImage,
      description: itemObj.description || "",
      suitable_events: suitableEvents,
      recommended_colors: recommendedColors,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
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
async function syncGoogleSheetToSupabase(supabase, options) {
  const {
    sheetId,
    range = "Items!A1:Z",
    serviceAccountCredentials,
    chunkSize = 50,
    dryRun = false
  } = options;
  console.log(`[Google Sheets Sync] B\u1EAFt \u0111\u1EA7u \u0111\u1ED3ng b\u1ED9 t\u1EEB Sheet ID: ${sheetId}, range: ${range}...`);
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
  rows.forEach((item) => {
    if (item.category === "skin") categories.skin++;
    else if (item.category === "pants") categories.pants++;
    else if (item.category === "accessory") categories.accessory++;
  });
  if (dryRun) {
    return {
      success: true,
      message: `[DRY-RUN] \u0110\xE3 \u0111\u1ECDc th\xE0nh c\xF4ng ${rows.length} v\u1EADt ph\u1EA9m t\u1EEB Google Sheet (ch\u01B0a ghi v\xE0o Supabase).`,
      sheet_id: sheetId,
      sheet_range: range,
      total_rows_found: totalRawRows,
      items_synced: rows.length,
      items_skipped: totalRawRows - rows.length,
      direct_drive_links_count: directLinksCount,
      categories,
      sample_items: rows.slice(0, 5),
      synced_at: (/* @__PURE__ */ new Date()).toISOString(),
      errors: errors.length > 0 ? errors : void 0
    };
  }
  let itemsSynced = 0;
  const syncErrors = [...errors];
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from("clothes_items").upsert(chunk, { onConflict: "id" });
    if (error) {
      const errMsg = `L\u1ED7i upsert t\u1EA1i chunk ${i + 1}-${i + chunk.length}: ${error.message}`;
      console.error(`[Google Sheets Sync Error]`, errMsg);
      syncErrors.push(errMsg);
    } else {
      itemsSynced += chunk.length;
    }
  }
  const isSuccess = itemsSynced > 0;
  const message = isSuccess ? `\u0110\u1ED3ng b\u1ED9 th\xE0nh c\xF4ng ${itemsSynced}/${rows.length} v\u1EADt ph\u1EA9m t\u1EEB Google Sheet l\xEAn Supabase (Ph\u01B0\u01A1ng th\u1EE9c x\xE1c th\u1EF1c: ${authMethod})!` : `Kh\xF4ng th\u1EC3 \u0111\u1ED3ng b\u1ED9 v\xE0o b\u1EA3ng Supabase. L\u1ED7i: ${syncErrors.join(" | ")}`;
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
    errors: syncErrors.length > 0 ? syncErrors : void 0,
    synced_at: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function generateGoogleSheetTemplateData(items) {
  const headers = [
    "id",
    "name",
    "category",
    "gender",
    "colorFolder",
    "colorName",
    "image_filename",
    "description",
    "suitable_events",
    "recommended_colors"
  ];
  const dataRows = items.map((item) => [
    item.id,
    item.name,
    item.category,
    item.gender || "Chung",
    item.colorFolder || "",
    item.colorName || "",
    item.image_filename,
    item.description || "",
    (item.suitable_events || []).join(", "),
    (item.recommended_colors || []).join(", ")
  ]);
  return [headers, ...dataRows];
}
export {
  extractGoogleDriveFileId,
  generateGoogleSheetTemplateData,
  getGoogleSheetsClient,
  normalizeColumnHeader,
  readItemsFromGoogleSheet,
  resolveServiceAccountCredentials,
  syncGoogleSheetToSupabase,
  toGoogleDriveDirectLink
};
