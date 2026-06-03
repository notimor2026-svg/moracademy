import { jsPDF } from "jspdf";
import logoUrl from "@/assets/mor-academy-logo.png";

type Cert = {
  codigo: string;
  nota: number;
  fecha_emision: string;
  employees: { nombre: string; dui: string } | null;
  courses: { nombre: string; duracion_min?: number | null } | null;
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function downloadCertificate(cert: Cert) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();   // 792
  const H = doc.internal.pageSize.getHeight();  // 612

  // Fondo blanco
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, W, H, "F");

  // Marco sencillo
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(1);
  doc.rect(30, 30, W - 60, H - 60);

  // Logo centrado arriba
  let logoImg: HTMLImageElement | null = null;
  try { logoImg = await loadImage(logoUrl); } catch { /* ignore */ }

  let y = 60;
  if (logoImg) {
    const ratio = logoImg.width / logoImg.height;
    const logoH = 50;
    const logoW = logoH * ratio;
    doc.addImage(logoImg, "PNG", (W - logoW) / 2, y, logoW, logoH);
    y += logoH + 20;
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("MOR ACADEMY", W / 2, y + 20, { align: "center" });
    y += 40;
  }

  // Título
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.text("CERTIFICADO DE APROBACIÓN", W / 2, y, { align: "center" });
  y += 30;

  // Subtítulo
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text("Se otorga el presente certificado a", W / 2, y, { align: "center" });
  y += 30;

  // Nombre participante
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.text(cert.employees?.nombre ?? "—", W / 2, y, { align: "center" });
  y += 28;

  // Texto curso
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text("por haber completado satisfactoriamente la capacitación", W / 2, y, { align: "center" });
  y += 26;

  // Nombre del curso (auto-ajuste)
  const courseName = cert.courses?.nombre ?? "—";
  doc.setFont("helvetica", "bolditalic");
  doc.setFontSize(20);
  const maxW = W * 0.78;
  let fSize = 20;
  let lines: string[] = [courseName];
  while (fSize >= 12) {
    doc.setFontSize(fSize);
    lines = doc.splitTextToSize(courseName, maxW);
    if (lines.length <= 2) break;
    fSize -= 2;
  }
  const lineH = fSize * 1.3;
  lines.slice(0, 2).forEach((l, i) =>
    doc.text(l, W / 2, y + i * lineH, { align: "center" })
  );
  y += Math.min(lines.length, 2) * lineH + 40;

  // Metadatos: tres columnas
  const colXs = [W * 0.25, W * 0.5, W * 0.75];
  const labels = ["NOTA OBTENIDA", "FECHA DE EMISIÓN", "HORAS DE FORMACIÓN"];
  const fecha = new Date(cert.fecha_emision).toLocaleDateString("es-SV", {
    day: "numeric", month: "long", year: "numeric",
  });
  const horas = cert.courses?.duracion_min
    ? `${Math.max(1, Math.round(cert.courses.duracion_min / 60))} horas`
    : "—";
  const values = [`${cert.nota}%`, fecha, horas];

  // Líneas separadoras
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.4);
  doc.line(colXs[0], y - 10, colXs[2], y - 10);

  // Etiquetas
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  labels.forEach((l, i) => doc.text(l, colXs[i], y, { align: "center" }));

  // Valores
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  values.forEach((v, i) => doc.text(v, colXs[i], y + 22, { align: "center" }));

  // Línea inferior
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.4);
  doc.line(colXs[0], y + 36, colXs[2], y + 36);

  // Código de verificación
  const footerY = H - 60;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`Código de verificación: ${cert.codigo}`, W / 2, footerY, { align: "center" });
  doc.text("Verifica la autenticidad de este certificado en la plataforma MOR ACADEMY", W / 2, footerY + 12, { align: "center" });

  doc.save(`certificado-${cert.codigo}.pdf`);
}
