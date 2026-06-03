import { jsPDF } from "jspdf";
import logoUrl from "@/assets/mor-academy-logo.png";

type Cert = {
  codigo: string;
  nota: number;
  fecha_emision: string;
  employees: { nombre: string; dui: string } | null;
  courses: { nombre: string; duracion_min?: number | null } | null;
};

const NAVY: [number, number, number] = [27, 42, 75];
const GOLD: [number, number, number] = [184, 142, 56];
const CREAM: [number, number, number] = [250, 247, 240];
const INK: [number, number, number] = [40, 45, 60];
const MUTED: [number, number, number] = [120, 122, 135];

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

  // Fondo
  doc.setFillColor(...CREAM);
  doc.rect(0, 0, W, H, "F");

  // Marco doble navy + línea dorada interior
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(2);
  doc.rect(24, 24, W - 48, H - 48);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.rect(34, 34, W - 68, H - 68);

  // Logo centrado arriba
  let logoImg: HTMLImageElement | null = null;
  try { logoImg = await loadImage(logoUrl); } catch { /* ignore */ }

  const logoTop = 56;
  let headerBottom = logoTop;
  if (logoImg) {
    const ratio = logoImg.width / logoImg.height;
    const logoH = 64;
    const logoW = logoH * ratio;
    doc.addImage(logoImg, "PNG", (W - logoW) / 2, logoTop, logoW, logoH);
    headerBottom = logoTop + logoH;
  } else {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...NAVY);
    doc.setFontSize(24);
    doc.text("MOR ACADEMY", W / 2, logoTop + 30, { align: "center" });
    headerBottom = logoTop + 40;
  }

  // Título principal
  const titleY = headerBottom + 60;
  doc.setFont("times", "normal");
  doc.setTextColor(...NAVY);
  doc.setFontSize(42);
  doc.text("CERTIFICADO DE APROBACIÓN", W / 2, titleY, { align: "center", charSpace: 3 });

  // Línea dorada decorativa bajo el título
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(1);
  doc.line(W / 2 - 60, titleY + 14, W / 2 + 60, titleY + 14);

  // "Se otorga el presente certificado a"
  const introY = titleY + 50;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.setFontSize(12);
  doc.text("Se otorga el presente certificado a", W / 2, introY, { align: "center" });

  // Nombre del participante
  const nameY = introY + 40;
  doc.setFont("times", "bold");
  doc.setTextColor(...NAVY);
  doc.setFontSize(34);
  doc.text(cert.employees?.nombre ?? "—", W / 2, nameY, { align: "center" });

  // "por haber completado satisfactoriamente la capacitación"
  const byY = nameY + 36;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...INK);
  doc.setFontSize(12);
  doc.text("por haber completado satisfactoriamente la capacitación", W / 2, byY, { align: "center" });

  // Nombre del curso — auto-ajuste a 1 o 2 líneas
  const courseName = cert.courses?.nombre ?? "—";
  doc.setFont("times", "bolditalic");
  doc.setTextColor(...NAVY);
  const maxW = W * 0.75;
  let fSize = 24;
  let lines: string[] = [courseName];
  while (fSize >= 14) {
    doc.setFontSize(fSize);
    lines = doc.splitTextToSize(courseName, maxW);
    if (lines.length <= 2 && lines.every((l) => doc.getTextWidth(l) <= maxW)) break;
    fSize -= 2;
  }
  const lineH = fSize * 1.2;
  const courseStartY = byY + 36;
  lines.slice(0, 2).forEach((l, i) =>
    doc.text(l, W / 2, courseStartY + i * lineH, { align: "center" })
  );
  const courseEndY = courseStartY + (Math.min(lines.length, 2) - 1) * lineH;

  // Bloque de metadatos: tres columnas separadas, bien lejos del curso
  const metaTop = Math.max(courseEndY + 50, H - 170);
  const colXs = [W * 0.25, W * 0.5, W * 0.75];
  const labels = ["NOTA OBTENIDA", "FECHA DE EMISIÓN", "HORAS DE FORMACIÓN"];
  const fecha = new Date(cert.fecha_emision).toLocaleDateString("es-SV", {
    day: "numeric", month: "long", year: "numeric",
  });
  const horas = cert.courses?.duracion_min
    ? `${Math.max(1, Math.round(cert.courses.duracion_min / 60))} horas`
    : "—";
  const values = [`${cert.nota}%`, fecha, horas];

  // Etiquetas
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...GOLD);
  doc.setFontSize(9);
  labels.forEach((l, i) => doc.text(l, colXs[i], metaTop, { align: "center", charSpace: 1 }));

  // Valores
  doc.setFont("times", "normal");
  doc.setTextColor(...NAVY);
  doc.setFontSize(15);
  values.forEach((v, i) => doc.text(v, colXs[i], metaTop + 22, { align: "center" }));

  // Separadores verticales finos
  doc.setDrawColor(210, 205, 190);
  doc.setLineWidth(0.4);
  doc.line((colXs[0] + colXs[1]) / 2, metaTop - 6, (colXs[0] + colXs[1]) / 2, metaTop + 28);
  doc.line((colXs[1] + colXs[2]) / 2, metaTop - 6, (colXs[1] + colXs[2]) / 2, metaTop + 28);

  // Pie: código de verificación
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.5);
  doc.line(W / 2 - 140, H - 70, W / 2 + 140, H - 70);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...NAVY);
  doc.setFontSize(10);
  doc.text(`Código de verificación: ${cert.codigo}`, W / 2, H - 56, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.setFontSize(8);
  doc.text(
    "Verifica la autenticidad de este certificado en la plataforma MOR ACADEMY",
    W / 2, H - 44, { align: "center" }
  );

  doc.save(`certificado-${cert.codigo}.pdf`);
}
