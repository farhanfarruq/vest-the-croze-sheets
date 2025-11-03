// app/api/data/route.js
// Next.js App Router API for Google Sheets (Node runtime + safe PRIVATE_KEY handling)

import { NextResponse } from 'next/server';
import { GoogleAuth } from 'google-auth-library';
import { google } from 'googleapis';

// Ensure this route runs on Node.js runtime (not Edge)
export const runtime = 'nodejs';

// --- Daftar Anggota Awal (Seeding) ---
// Daftar ini akan ditambahkan ke Google Sheet jika sheet 'Members' kosong
const initialMembers = [
    "AGAM FARROS ADHYASTA HAKIM", "AHMAD BISRI AS'ARI", "AHMAD IZZUDDIN ZAINI", "AKMAL MIZHU DAIJI",
    "AL GHAZI RYANDRI SYA'BANA", "ALVIS ZULFIKAR SIDIK", "ARFAN BAIHAQI", "BAGAS RESTU WIJAYA",
    "FAAZ HADYAN NUR PRADITYA", "FALIH ARSYAD ILYASA", "FATIH ALFA YASYA", "FAWWAZ IRHAM BILAL",
    "GILANG NURFI RAMADHANI", "KEANO ZAKY ALHABSYI", "LAINUFAR IFTIKAR ZAIN", "M FATA ADZ DZAKI",
    "MAGHFI CAHYA RAMADANA", "MAITSAHAFIZH LUBNA HILMI", "MATSNA MUNA ZAHRAN", "MUCHAMMAD ARIFIN ILHAM",
    "MUHAMMAD AR RA'UF PUTRA AGUSNI", "VINO WAHYU DIARTAMA", "FACHRI RAMADHAN SYAHPUTRA", "AFZAN KHOIRONI ABADI",
    "AHMAD RIFQI ALI", "ARFAN IZZUL HAQ", "MUHAMMAD AUFA WIJDAN", "MUHAMMAD 'AZZAM MUWAFFIQ",
    "MUHAMMAD BINTANG RAHMATULLOH", "MUHAMMAD DAFFA RAMADHAN", "MUHAMMAD HAMIZAL FADLI", "MUHAMMAD RAFIF ULIL ALBAB",
    "MUHAMMAD SHODEK", "MUHAMMAD SYIFA'I", "MUJIB RIDWAN HARTONO", "NADHINDRA RADITYA NATAMA",
    "NAUFAL RIZQY AL FAKHRI", "NAUFAL YUDHA PRATAMA", "RAFIF HAFIY KARIM", "RAIHAN DANI NASRULLOH",
    "RIDHO AKBAR MAULANA", "RIFQI SUFYAN MUZAKI", "USRIYA AHMAD", "WAHIB EFENDI",
    "WISNU SUJUD ANGGARA", "ZAKIY MAULANA HASAN", "ALEO RAFIF SAPUTRA", "ALVINO GHANI RIZQ PUTRA SAMUDRA",
    "ARKAN HIBATULLAH", "BRILLIANT DANNIZ APRILLIO", "CELESTA DZAKY XYLOPIO", "DIMAS GUNTUR MULYONO",
    "FACHRI RAMADHAN SYAHPUTRA", "FAJAR SYAPUTRA PRATAMA", "HANIF HAZZA ABDUHU YASYKUR", "HUDA MAHDI SUKLA ASSAJID",
    "MAHBUBI SYABANA", "MOCHAMMAD FAIRLY UNO AZFAR", "MUHAMMAD BAYU AZANDY", "MUHAMMAD GALANG AHZA AZZAMI",
    "NICO PUTRA FERDIANSYAH", "NIZAR ALI", "RAFFASYA ATHARRAYHAN ARDANA", "RAFID ARHAB MULIA",
    "RASYID NASRULLAH", "SURYA ADI NUGROHO", "ZAZINUL MUSTHOFA SABIKIS", "ZULFAN NUR FAUZI"
];
// ------------------------------------


// --- Helpers ---------------------------------------------------------------
function getPrivateKey() {
  let key = process.env.GOOGLE_PRIVATE_KEY || '';
  key = key.trim();
  // strip accidental wrapping quotes
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  // turn literal \n into real newlines (works for .env.local one-liners & Vercel)
  key = key.replace(/\\n/g, '\n');
  // normalize CRLF to LF
  key = key.replace(/\r\n/g, '\n');
  return key;
}

function getAuth() {
  return new GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: getPrivateKey(),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

async function getSheets() {
  const auth = getAuth();
  const client = await auth.getClient();
  return google.sheets({ version: 'v4', auth: client });
}

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

async function readSheet(sheets, range) {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range,
    });
    return res.data.values || [];
  } catch (err) {
    console.error(`Error membaca sheet ${range}:`, err.message);
    throw new Error(`Gagal membaca sheet ${range}`);
  }
}

function sheetDataToObjects(data) {
  if (!data || data.length === 0) return [];
  const headers = data[0];
  return data.slice(1).map((row) => {
    const obj = {};
    headers.forEach((header, i) => {
      obj[header] = row[i];
    });
    return obj;
  });
}

// --- API Handlers ----------------------------------------------------------
export async function GET() {
  try {
    console.log('GET /api/data: Mulai mengambil data...');
    const sheets = await getSheets();

    // --- MODIFIKASI DIMULAI ---
    // 1. Baca sheet 'Members' terlebih dahulu
    let membersData = await readSheet(sheets, 'Members!A:C');

    // 2. Cek apakah sheet kosong (<= 1 berarti hanya ada header, atau tidak ada sama sekali)
    if (membersData.length <= 1) {
      console.log('GET /api/data: Sheet Members kosong, melakukan seeding data...');
      
      // 3. Ubah array initialMembers menjadi format yang bisa diterima Google Sheets
      // [[id, name, active], [id, name, active], ...]
      const newMembersValues = initialMembers.map((name, index) => {
        return [
          index + 1,        // Kolom A: ID
          name,             // Kolom B: Name
          'TRUE'            // Kolom C: Active (sebagai string "TRUE")
        ];
      });

      // 4. Tambahkan (append) semua data anggota baru ke Google Sheet
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Members!A:C', // Ini akan menambah di baris kosong pertama
        valueInputOption: 'USER_ENTERED',
        resource: { values: newMembersValues },
      });
      
      console.log('GET /api/data: Seeding selesai. Membaca ulang data members...');
      // 5. Baca ulang data members setelah diisi
      membersData = await readSheet(sheets, 'Members!A:C');
    }
    // --- MODIFIKASI SELESAI ---


    // 6. Lanjutkan mengambil sisa data (Payments & Transactions)
    // 'membersData' sudah kita miliki, jadi kita hapus dari Promise.all
    const [paymentsData, transactionsData] = await Promise.all([
      // readSheet(sheets, 'Members!A:C'), // <-- DIHAPUS DARI SINI
      readSheet(sheets, 'Payments!A:C'),
      readSheet(sheets, 'Transactions!A:E'),
    ]);

    const members = sheetDataToObjects(membersData)
      .map((m) => ({
        ...m,
        id: m.id ? parseInt(m.id, 10) : undefined,
        active: m.active === 'TRUE',
      }))
      .filter((m) => Number.isFinite(m.id));

    const transactions = sheetDataToObjects(transactionsData)
      .map((t) => ({
        ...t,
        id: t.id ? parseInt(t.id, 10) : undefined,
        amount: t.amount ? parseInt(t.amount, 10) : 0,
      }))
      .filter((t) => Number.isFinite(t.id));

    // Build payments lookup (TRUE if exists)
    const payments = {};
    paymentsData.slice(1).forEach((row) => {
      if (row && row[0]) payments[row[0]] = true; // paymentKey in col A
    });

    const monthlyAmount = 20000; // TODO: optionally read from a Config sheet

    console.log('GET /api/data: Data berhasil diambil.');
    return NextResponse.json({ members, payments, transactions, monthlyAmount });
  } catch (err) {
    console.error('Error di GET /api/data:', err.message);
    return NextResponse.json(
      { message: 'Internal Server Error', error: err.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { action } = body;
    const sheets = await getSheets();
    console.log(`POST /api/data: Action = ${action}`);

    if (action === 'ADD_MEMBER') {
      const { id, name } = body;
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Members!A:C',
        valueInputOption: 'USER_ENTERED',
        resource: { values: [[id, name, 'TRUE']] },
      });
      return NextResponse.json({ success: true, message: 'Anggota ditambahkan' });
    }

    if (action === 'ADD_TRANSACTION') {
      const { id, date, description, type, amount } = body;
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Transactions!A:E',
        valueInputOption: 'USER_ENTERED',
        resource: { values: [[id, date, description, type, amount]] },
      });
      return NextResponse.json({ success: true, message: 'Transaksi ditambahkan' });
    }

    if (action === 'TOGGLE_PAYMENT') {
      const { paymentKey, memberId, month } = body;
      const data = await readSheet(sheets, 'Payments!A:C');
      const rowIndex = data.findIndex((row) => row && row[0] === paymentKey);

      if (rowIndex > 0) {
        console.log(`TOGGLE_PAYMENT: Menghapus pembayaran di baris ${rowIndex + 1}`);
        await sheets.spreadsheets.values.clear({
          spreadsheetId: SPREADSHEET_ID,
          range: `Payments!A${rowIndex + 1}:C${rowIndex + 1}`,
        });
        return NextResponse.json({ success: true, message: 'Pembayaran dibatalkan' });
      } else {
        console.log('TOGGLE_PAYMENT: Menambah pembayaran baru');
        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: 'Payments!A:C',
          valueInputOption: 'USER_ENTERED',
          resource: { values: [[paymentKey, memberId, month]] },
        });
        return NextResponse.json({ success: true, message: 'Pembayaran dicatat' });
      }
    }

    if (action === 'DELETE_TRANSACTION') {
      const { id } = body;
      const data = await readSheet(sheets, 'Transactions!A:E');
      const rowIndex = data.findIndex((row) => row && row[0] && parseInt(row[0], 10) === id);

      if (rowIndex > 0) {
        console.log(`DELETE_TRANSACTION: Menghapus transaksi di baris ${rowIndex + 1}`);
        await sheets.spreadsheets.values.clear({
          spreadsheetId: SPREADSHEET_ID,
          range: `Transactions!A${rowIndex + 1}:E${rowIndex + 1}`,
        });
        return NextResponse.json({ success: true, message: 'Transaksi dihapus' });
      }
      return NextResponse.json({ success: false, message: 'Transaksi tidak ditemukan' }, { status: 404 });
    }

    if (action === 'TOGGLE_MEMBER_STATUS') {
      const { id, newStatus } = body;
      const data = await readSheet(sheets, 'Members!A:C');
      const rowIndex = data.findIndex((row) => row && row[0] && parseInt(row[0], 10) === id);

      if (rowIndex > 0) {
        console.log(`TOGGLE_MEMBER_STATUS: Mengubah status di baris ${rowIndex + 1}`);
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `Members!C${rowIndex + 1}`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [[newStatus ? 'TRUE' : 'FALSE']] },
        });
        return NextResponse.json({ success: true, message: 'Status anggota diupdate' });
      }
      return NextResponse.json({ success: false, message: 'Anggota tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Action tidak diketahui' }, { status: 400 });
  } catch (err) {
    console.error('Error di POST /api/data:', err.message);
    return NextResponse.json(
      { message: 'Internal Server Error', error: err.message },
      { status: 500 }
    );
  }
}
