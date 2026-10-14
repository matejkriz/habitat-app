import { QRCodeSVG } from "qrcode.react";

export function PaymentQrCode({ value }: { value: string }) {
  return (
    <QRCodeSVG value={value} size={288} level="H" marginSize={4}
      role="img" aria-label="QR kód pro platbu obědů" title="QR kód pro platbu obědů"
      className="mx-auto h-auto max-w-full"
      imageSettings={{ src: "/habitat-logo.webp", width: 64, height: 21, excavate: true }} />
  );
}
