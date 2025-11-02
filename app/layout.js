import "./globals.css";

export const metadata = {
  title: "Kas VEST THE CROZE",
  description: "Aplikasi Kas Angkatan VEST THE CROZE",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body className="bg-linear-to-br from-blue-50 to-indigo-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}