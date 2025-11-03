// farhanfarruq/vest-the-croze-sheets/vest-the-croze-sheets-34f986b55464a5f0894793a1aac95a7c4a4d53b8/app/layout.js

// PASTIKAN CSS DI-IMPORT DENGAN PATH ALIAS
import "./globals.css";
export const metadata = {
  title: "Kas VEST THE CROZE",
  description: "Aplikasi Kas Angkatan VEST THE CROZE",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      {/* Ini juga sudah saya perbaiki (gradient, bukan linear)
        Walaupun ini tidak akan jalan jika CSS-nya tidak ke-load 
      */}
      <body className="bg-linear-to-br from-blue-50 to-indigo-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}