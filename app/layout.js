import "./globals.css";

export const metadata = {
  title: "Tracking điều tiết POSM & trừ tồn kho",
  description: "Dashboard theo dõi tiến độ điều tiết POSM và tiến độ trừ tồn kho theo NPP",
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
