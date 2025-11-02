import { NextResponse } from 'next/server';
import { GoogleAuth } from 'google-auth-library';
import { google } from 'googleapis';

// --- Konfigurasi Otentikasi ---
const auth = new GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'), // Ganti \\n menjadi \n
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

// --- Helper Functions ---

/**
 * Helper untuk membaca data dari sheet.
 */
async function readSheet(range) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: range,
    });
    return response.data.values || [];
  } catch (err) {
    console.error(`Error membaca sheet ${range}:`, err.message);
    throw new Error(`Gagal membaca sheet ${range}`);
  }
}

/**
 * Helper untuk mengubah data array [[]] menjadi array [{}].
 */
function sheetDataToObjects(data) {
  if (!data || data.length === 0) return [];
  const headers = data[0];
  return data.slice(1).map((row) => {
    let obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });
}

// --- FUNGSI UTAMA API ---

/**
 * GET: Mengambil semua data
 */
export async function GET() {
  try {
    console.log('GET /api/data: Mulai mengambil data...');
    // Baca 3 sheet secara paralel
    const [membersData, paymentsData, transactionsData] = await Promise.all([
      readSheet('Members!A:C'),
      readSheet('Payments!A:C'),
      readSheet('Transactions!A:E'),
    ]);

    // Ubah data mentah menjadi array of objects yang rapi
    const members = sheetDataToObjects(membersData).map(m => ({
        ...m,
        id: parseInt(m.id),
        active: m.active === 'TRUE'
    })).filter(m => m.id); // Filter baris kosong

    const transactions = sheetDataToObjects(transactionsData).map(t => ({
        ...t,
        id: parseInt(t.id),
        amount: parseInt(t.amount)
    })).filter(t => t.id); // Filter baris kosong

    // Untuk payments, kita buat object lookup agar lebih cepat
    const payments = {};
    paymentsData.slice(1).forEach(row => { // skip header
        // row[0] = paymentKey
        if (row[0]) { // Hanya proses jika paymentKey ada (tidak kosong)
            payments[row[0]] = true;
        }
    });

    // TODO: Ambil monthlyAmount. Untuk sekarang kita hardcode.
    const monthlyAmount = 20000;

    console.log('GET /api/data: Data berhasil diambil.');
    return NextResponse.json({ members, payments, transactions, monthlyAmount });

  } catch (err) {
    console.error('Error di GET /api/data:', err.message);
    return NextResponse.json({ message: 'Internal Server Error', error: err.message }, { status: 500 });
  }
}

/**
 * POST: Menulis data (Tambah member, bayar, dll)
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { action } = body;
    console.log(`POST /api/data: Action = ${action}`);

    // --- Aksi: Tambah Anggota ---
    if (action === 'ADD_MEMBER') {
      const { id, name } = body;
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Members!A:C',
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [[id, name, 'TRUE']], // id, name, active
        },
      });
      return NextResponse.json({ success: true, message: 'Anggota ditambahkan' });
    }

    // --- Aksi: Tambah Transaksi ---
    if (action === 'ADD_TRANSACTION') {
      const { id, date, description, type, amount } = body;
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Transactions!A:E',
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [[id, date, description, type, amount]],
        },
      });
      return NextResponse.json({ success: true, message: 'Transaksi ditambahkan' });
    }

    // --- Aksi: Toggle Pembayaran (Versi Sederhana) ---
    if (action === 'TOGGLE_PAYMENT') {
        const { paymentKey, memberId, month } = body;
        
        // 1. Baca semua data payments
        const data = await readSheet('Payments!A:C');
        
        // 2. Cari apakah sudah ada
        const rowIndex = data.findIndex(row => row[0] === paymentKey);
        
        if (rowIndex > 0) { // Ditemukan (lebih dari 0 karena 0 adalah header)
            // Hapus data di baris itu (menggunakan clear)
            console.log(`TOGGLE_PAYMENT: Menghapus pembayaran di baris ${rowIndex + 1}`);
            await sheets.spreadsheets.values.clear({
                spreadsheetId: SPREADSHEET_ID,
                range: `Payments!A${rowIndex + 1}:C${rowIndex + 1}`, // Mengosongkan baris
            });
            return NextResponse.json({ success: true, message: 'Pembayaran dibatalkan' });
        
        } else {
            // Tambah baris baru
            console.log('TOGGLE_PAYMENT: Menambah pembayaran baru');
            await sheets.spreadsheets.values.append({
                spreadsheetId: SPREADSHEET_ID,
                range: 'Payments!A:C',
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: [[paymentKey, memberId, month]],
                },
            });
            return NextResponse.json({ success: true, message: 'Pembayaran dicatat' });
        }
    }
    
    // --- Aksi: Hapus Transaksi ---
    if (action === 'DELETE_TRANSACTION') {
        const { id } = body;
        const data = await readSheet('Transactions!A:E');
        const rowIndex = data.findIndex(row => row[0] && parseInt(row[0]) === id);

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
    
    // --- Aksi: Toggle Status Anggota ---
    if (action === 'TOGGLE_MEMBER_STATUS') {
        const { id, newStatus } = body;
        const data = await readSheet('Members!A:C');
        const rowIndex = data.findIndex(row => row[0] && parseInt(row[0]) === id);

        if (rowIndex > 0) {
            console.log(`TOGGLE_MEMBER_STATUS: Mengubah status di baris ${rowIndex + 1}`);
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `Members!C${rowIndex + 1}`, // Hanya update kolom C (active)
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: [[newStatus ? 'TRUE' : 'FALSE']]
                }
            });
            return NextResponse.json({ success: true, message: 'Status anggota diupdate' });
        }
        return NextResponse.json({ success: false, message: 'Anggota tidak ditemukan' }, { status: 404 });
    }

    // Jika tidak ada aksi yang cocok
    return NextResponse.json({ message: 'Action tidak diketahui' }, { status: 400 });

  } catch (err) {
    console.error('Error di POST /api/data:', err.message, err.stack);
    return NextResponse.json({ message: 'Internal Server Error', error: err.message }, { status: 500 });
  }
}