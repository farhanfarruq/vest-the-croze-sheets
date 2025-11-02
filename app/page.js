"use client"; // Wajib ada untuk React Hooks

import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { jsPDF } from 'jspdf';

// Setup base URL untuk API (kita panggil API kita sendiri)
const api = axios.create({
  baseURL: '/api', // Ini akan otomatis mengarah ke Vercel Serverless Function
});

// Helper function
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
};

const monthNames = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

// ===================================
// KOMPONEN LOGIN
// ===================================
function LoginScreen({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    // Kita hardcode login di frontend karena kita tidak pakai database user
    if (username === 'admin' && password === 'admin123') {
      sessionStorage.setItem('isLoggedIn', 'true'); // Simpan status login
      onLoginSuccess();
    } else {
      alert('Username atau password salah!');
    }
  };

  return (
    <div id="loginScreen" className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">VEST THE CROZE</h1>
          <p className="text-gray-600">Sistem Manajemen Kas Angkatan</p>
        </div>
        <form id="loginForm" className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
            <input
              type="text"
              id="username"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Masukkan username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <input
              type="password"
              id="password"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Masukkan password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition duration-200 font-medium">
            Masuk
          </button>
        </form>
      </div>
    </div>
  );
}

// ===================================
// KOMPONEN APLIKASI UTAMA
// ===================================
function MainApp({ onLogout }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [data, setData] = useState({ members: [], payments: {}, transactions: [], monthlyAmount: 20000 });
  const [isLoading, setIsLoading] = useState(true); // State loading

  // Fungsi untuk fetch semua data dari server
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/data');
      setData(response.data);
    } catch (error) {
      console.error('Gagal mengambil data:', error);
      alert('Gagal mengambil data dari Google Sheet. Cek konsol (F12) dan pastikan API key sudah benar.');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch data saat komponen dimuat
  useEffect(() => {
    fetchData();
  }, []);

  // --- Kalkulasi ---
  const { totalIncome, totalExpense, totalBalance } = useMemo(() => {
    const memberPayments = Object.keys(data.payments).length * data.monthlyAmount;
    const additionalIncome = data.transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalIncome = memberPayments + additionalIncome;

    const totalExpense = data.transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalBalance = totalIncome - totalExpense;
    return { totalIncome, totalExpense, totalBalance };
  }, [data]);

  // --- Helper API Functions ---
  const handleAddMember = async (name) => {
    try {
      const newId = Math.max(0, ...data.members.map(m => m.id)) + 1;
      await api.post('/data', { action: 'ADD_MEMBER', id: newId, name: name.toUpperCase() });
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Gagal menambah anggota:', error);
    }
  };

  const handleToggleStatus = async (id) => {
    try {
      const member = data.members.find(m => m.id === id);
      const newStatus = !member.active;
      await api.post('/data', { action: 'TOGGLE_MEMBER_STATUS', id, newStatus });
      fetchData();
    } catch (error) {
      console.error('Gagal mengubah status:', error);
    }
  };

  const handleDeleteMember = async (id) => {
    // Menghapus member dari Google Sheet itu rumit.
    // Kita nonaktifkan saja.
    alert('Fitur hapus anggota belum didukung, silakan nonaktifkan anggota atau hapus manual di Google Sheet.');
    // if (window.confirm('Yakin ingin menghapus anggota ini? Ini akan menghapus semua riwayat pembayaran mereka.')) {
    //   // Logika hapus... (perlu API khusus)
    // }
  };

  const handleTogglePayment = async (memberId, month) => {
    try {
      const paymentKey = `${memberId}-${month}`;
      await api.post('/data', { action: 'TOGGLE_PAYMENT', paymentKey, memberId, month });
      fetchData();
    } catch (error) {
      console.error('Gagal mengubah status pembayaran:', error);
    }
  };

  const handleAddTransaction = async (type, description, amount) => {
    try {
      const newId = Date.now(); // Pakai timestamp sebagai ID unik
      const date = new Date().toLocaleDateString('id-ID');
      await api.post('/data', { 
        action: 'ADD_TRANSACTION', 
        id: newId, 
        date, 
        description, 
        type, 
        amount: parseInt(amount) 
      });
      fetchData();
    } catch (error) {
      console.error('Gagal menambah transaksi:', error);
    }
  };

  const handleDeleteTransaction = async (id) => {
    if (window.confirm('Yakin ingin menghapus transaksi ini? (Baris di GSheet akan dikosongkan)')) {
      try {
        await api.post('/data', { action: 'DELETE_TRANSACTION', id });
        fetchData();
      } catch (error) {
        console.error('Gagal menghapus transaksi:', error);
      }
    }
  };

  const handleUpdateMonthlyAmount = async (amount) => {
    // Fitur ini perlu API khusus untuk menyimpan 1 value.
    // Untuk saat ini, kita skip.
    alert('Mengubah nominal kas harus dilakukan manual di Google Sheet (untuk saat ini).');
  };

  // --- Tampilan Loading ---
  if (isLoading) {
    return (
        <div className="min-h-screen flex items-center justify-center">
            <h1 className="text-2xl font-bold text-gray-700 animate-pulse">
                Menyambungkan ke Google Sheets...
            </h1>
        </div>
    );
  }

  // --- Render ---
  return (
    <div id="mainApp">
      <Header onLogout={onLogout} />
      <Navigation activeTab={activeTab} onTabClick={setActiveTab} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && (
          <DashboardTab 
            data={data}
            totalIncome={totalIncome}
            totalExpense={totalExpense}
            totalBalance={totalBalance}
          />
        )}
        {activeTab === 'members' && (
          <MembersTab 
            members={data.members} 
            payments={data.payments}
            monthlyAmount={data.monthlyAmount}
            onAddMember={handleAddMember}
            onToggleStatus={handleToggleStatus}
            onDeleteMember={handleDeleteMember}
          />
        )}
        {activeTab === 'payments' && (
          <PaymentsTab 
            members={data.members}
            payments={data.payments}
            monthlyAmount={data.monthlyAmount}
            onTogglePayment={handleTogglePayment}
            onUpdateMonthlyAmount={handleUpdateMonthlyAmount}
          />
        )}
        {activeTab === 'transactions' && (
          <TransactionsTab 
            transactions={data.transactions}
            onAddTransaction={handleAddTransaction}
            onDeleteTransaction={handleDeleteTransaction}
          />
        )}
        {activeTab === 'reports' && (
          <ReportsTab 
            data={data}
            totalIncome={totalIncome}
            totalExpense={totalExpense}
            totalBalance={totalBalance}
          />
        )}
      </main>
    </div>
  );
}

// --- Komponen Header ---
function Header({ onLogout }) {
  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <h1 className="text-2xl font-bold text-gray-900">VEST THE CROZE</h1>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">Admin</span>
            <button onClick={onLogout} className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition duration-200">
              Keluar
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

// --- Komponen Navigasi ---
function Navigation({ activeTab, onTabClick }) {
  const tabs = ['dashboard', 'members', 'payments', 'transactions', 'reports'];
  const tabNames = {
    dashboard: 'Dashboard',
    members: 'Anggota',
    payments: 'Pembayaran',
    transactions: 'Transaksi',
    reports: 'Laporan'
  };

  return (
    <nav className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex space-x-8 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => onTabClick(tab)}
              className={`tab-btn py-4 px-2 border-b-2 font-medium whitespace-nowrap ${
                activeTab === tab 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tabNames[tab]}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}

// --- Komponen Tab: Dashboard ---
function DashboardTab({ data, totalIncome, totalExpense, totalBalance }) {
  const currentMonth = new Date().getMonth();
  const unpaidMembers = data.members.filter(member => {
    if (!member.active) return false;
    const paymentKey = `${member.id}-${currentMonth}`;
    return !data.payments[paymentKey];
  });

  return (
    <div id="dashboardTab" className="tab-content fade-in">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard title="Total Pemasukan" value={formatCurrency(totalIncome)} color="green" />
        <StatCard title="Total Pengeluaran" value={formatCurrency(totalExpense)} color="red" />
        <StatCard title="Saldo Kas" value={formatCurrency(totalBalance)} color="blue" />
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Anggota Belum Bayar Bulan Ini ({monthNames[currentMonth]})</h3>
        <div id="unpaidMembers" className="space-y-2 max-h-60 overflow-y-auto">
          {unpaidMembers.length === 0 ? (
            <p className="text-gray-500">Semua anggota sudah membayar kas bulan ini!</p>
          ) : (
            unpaidMembers.map(member => (
              <div key={member.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <span className="text-sm font-medium text-red-800">{member.name}</span>
                <span className="text-xs text-red-600">Belum bayar</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, color }) {
  const colors = {
    green: 'bg-green-100 text-green-600',
    red: 'bg-red-100 text-red-600',
    blue: 'bg-blue-100 text-blue-600'
  };
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center">
        <div className={`p-3 rounded-full ${colors[color]}`}>
          {/* SVG icon placeholder */}
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"></path></svg>
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

// --- Komponen Tab: Members ---
function MembersTab({ members, payments, monthlyAmount, onAddMember, onToggleStatus, onDeleteMember }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');

  const filteredMembers = members.filter(member =>
    member.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const calculateMemberTotalPayments = (memberId) => {
    let total = 0;
    for (let month = 0; month < 12; month++) {
      if (payments[`${memberId}-${month}`]) {
        total += monthlyAmount;
      }
    }
    return total;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (newMemberName.trim()) {
      onAddMember(newMemberName.trim());
      setNewMemberName('');
      setIsModalOpen(false);
    }
  };

  return (
    <div id="membersTab" className="tab-content fade-in">
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <h3 className="text-lg font-semibold text-gray-900">Daftar Anggota</h3>
          <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-4 w-full md:w-auto">
            <input
              type="text"
              placeholder="Cari nama anggota..."
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full md:w-auto"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition duration-200 w-full md:w-auto">
              Tambah Anggota
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Bayar</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredMembers.map(member => (
                <tr key={member.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{member.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${member.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {member.active ? 'Aktif' : 'Tidak Aktif'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(calculateMemberTotalPayments(member.id))}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button onClick={() => onToggleStatus(member.id)} className="text-blue-600 hover:text-blue-900 mr-3">
                      {member.active ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                    <button onClick={() => onDeleteMember(member.id)} className="text-red-600 hover:text-red-900">
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Member Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Tambah Anggota Baru</h3>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nama Lengkap</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  required
                />
              </div>
              <div className="flex space-x-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 transition duration-200">
                  Batal
                </button>
                <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition duration-200">
                  Tambah
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Komponen Tab: Payments ---
function PaymentsTab({ members, payments, monthlyAmount, onTogglePayment, onUpdateMonthlyAmount }) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [currentMonthlyAmount, setCurrentMonthlyAmount] = useState(monthlyAmount);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setCurrentMonthlyAmount(monthlyAmount);
  }, [monthlyAmount]);

  const handleAmountBlur = () => {
    const newAmount = parseInt(currentMonthlyAmount);
    if (newAmount && newAmount !== monthlyAmount) {
      onUpdateMonthlyAmount(newAmount);
    } else {
        setCurrentMonthlyAmount(monthlyAmount);
    }
  };

  const filteredMembers = members.filter(member =>
    member.active && member.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div id="paymentsTab" className="tab-content fade-in">
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <h3 className="text-lg font-semibold text-gray-900">Pembayaran Kas</h3>
          <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-4 w-full md:w-auto">
            <select 
              id="monthFilter" 
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 w-full md:w-auto"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            >
              {monthNames.map((name, index) => (
                <option key={index} value={index}>{name}</option>
              ))}
            </select>
            <input 
              type="number" 
              id="monthlyAmount" 
              placeholder="Nominal per bulan" 
              value={currentMonthlyAmount}
              onChange={(e) => setCurrentMonthlyAmount(e.target.value)}
              onBlur={handleAmountBlur}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 w-full md:w-auto"
            />
          </div>
        </div>
        <div className="mb-4">
          <input 
            type="text" 
            id="paymentSearch" 
            placeholder="Cari nama anggota..." 
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="paymentsList">
          {filteredMembers.map(member => {
            const paymentKey = `${member.id}-${selectedMonth}`;
            const isPaid = payments[paymentKey] || false;
            return (
              <div key={member.id} className={`p-4 border rounded-lg ${isPaid ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900">{member.name}</h4>
                    <p className="text-sm text-gray-600">{formatCurrency(monthlyAmount)}</p>
                  </div>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isPaid}
                      onChange={() => onTogglePayment(member.id, selectedMonth)}
                      className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className={`ml-2 text-sm ${isPaid ? 'text-green-600' : 'text-gray-600'}`}>
                      {isPaid ? 'Lunas' : 'Belum'}
                    </span>
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// --- Komponen Tab: Transactions ---
function TransactionsTab({ transactions, onAddTransaction, onDeleteTransaction }) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');

  const handleIncomeSubmit = (e) => {
    e.preventDefault();
    onAddTransaction('income', description, amount);
    setDescription('');
    setAmount('');
  };

  const handleExpenseSubmit = (e) => {
    e.preventDefault();
    onAddTransaction('expense', description, amount);
    setDescription('');
    setAmount('');
  };

  return (
    <div id="transactionsTab" className="tab-content fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income Form */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Tambah Pemasukan (Lain-lain)</h3>
          <form className="space-y-4" onSubmit={handleIncomeSubmit}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Deskripsi</label>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Jumlah</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required />
            </div>
            <button type="submit" className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition duration-200">
              Tambah Pemasukan
            </button>
          </form>
        </div>

        {/* Expense Form */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Tambah Pengeluaran</h3>
          <form className="space-y-4" onSubmit={handleExpenseSubmit}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Deskripsi</label>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Jumlah</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required />
            </div>
            <button type="submit" className="w-full bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition duration-200">
              Tambah Pengeluaran
            </button>
          </form>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-white rounded-xl shadow-sm p-6 mt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Riwayat Transaksi</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tanggal</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deskripsi</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipe</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jumlah</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {transactions.sort((a, b) => b.id - a.id).map(transaction => ( // Urutkan terbaru di atas
                <tr key={transaction.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {transaction.date}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{transaction.description}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${transaction.type === 'income' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {transaction.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(transaction.amount)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button onClick={() => onDeleteTransaction(transaction.id)} className="text-red-600 hover:text-red-900">
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// --- Komponen Tab: Reports ---
function ReportsTab({ data, totalIncome, totalExpense, totalBalance }) {
    
    // Ambil link Google Sheet Anda dari .env
    // Kita tidak bisa baca .env di client, jadi kita hardcode linknya
    // Ganti dengan link Google Sheet Anda
    const googleSheetLink = `https://docs.google.com/spreadsheets/d/${process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID_FOR_CLIENT}/edit`;
  
  const exportToPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text('Laporan Kas VEST THE CROZE', 20, 20);
    
    doc.setFontSize(12);
    doc.text(`Total Pemasukan: ${formatCurrency(totalIncome)}`, 20, 40);
    doc.text(`Total Pengeluaran: ${formatCurrency(totalExpense)}`, 20, 50);
    doc.text(`Saldo Akhir: ${formatCurrency(totalBalance)}`, 20, 60);
    
    doc.text('Rincian Pembayaran Anggota:', 20, 80);
    
    let yPos = 90;
    data.members.forEach((member) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      
      let paidMonths = 0;
      for (let month = 0; month < 12; month++) {
        if (data.payments[`${member.id}-${month}`]) paidMonths++;
      }
      
      const totalPaid = paidMonths * data.monthlyAmount;
      doc.text(`${member.name}: ${formatCurrency(totalPaid)} (${paidMonths}/12 bulan)`, 20, yPos);
      yPos += 10;
    });
    
    doc.save('laporan-kas-vest-the-croze.pdf');
  };

  return (
    <div id="reportsTab" className="tab-content fade-in">
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <h3 className="text-lg font-semibold text-gray-900">Laporan Kas</h3>
          <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-4 w-full md:w-auto">
            <button onClick={exportToPDF} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition duration-200">
              Export PDF
            </button>
            <a 
              href={`https://docs.google.com/spreadsheets/d/${process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID}/export?format=xlsx`}
              target="_blank" 
              rel="noopener noreferrer"
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition duration-200 text-center"
            >
              Download Excel
            </a>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-gray-600">Total Pemasukan</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(totalIncome)}</p>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <p className="text-sm text-gray-600">Total Pengeluaran</p>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(totalExpense)}</p>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-gray-600">Saldo Akhir</p>
            <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalBalance)}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Anggota</th>
                {monthNames.map(m => <th key={m} className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{m.substring(0,3)}</th>)}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.members.map(member => {
                let totalPaid = 0;
                const paymentsRow = [];
                for (let month = 0; month < 12; month++) {
                  const isPaid = data.payments[`${member.id}-${month}`] || false;
                  paymentsRow.push(isPaid);
                  if (isPaid) totalPaid += data.monthlyAmount;
                }
                return (
                  <tr key={member.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{member.name}</td>
                    {paymentsRow.map((paid, index) => (
                      <td key={index} className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`w-4 h-4 inline-block rounded-full ${paid ? 'bg-green-500' : 'bg-red-500'}`}></span>
                      </td>
                    ))}
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{formatCurrency(totalPaid)}</td>
                  </tr>
                );
})}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


// ===================================
// KOMPONEN APP (ROOT)
// ===================================
export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Cek session login sederhana
  useEffect(() => {
    if (sessionStorage.getItem('isLoggedIn') === 'true') {
      setIsLoggedIn(true);
    }
  }, []);

  const handleLogin = () => {
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('isLoggedIn');
    setIsLoggedIn(false);
  };

  return (
    <>
      {isLoggedIn ? (
        <MainApp onLogout={handleLogout} />
      ) : (
        <LoginScreen onLoginSuccess={handleLogin} />
      )}
    </>
  );
}