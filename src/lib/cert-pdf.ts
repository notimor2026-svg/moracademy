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
const NAVY_SOFT: [number, number, number] = [40, 58, 95];
const GOLD: [number, number, number] = [184, 142, 56];
const CREAM: [number, number, number] = [245, 241, 232];
const INK: [number, number, number] = [30, 35, 50];
const MUTED: [number, number, number] = [110, 115, 130];

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
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  // Fondo crema
  doc.setFillColor(...CREAM);
  doc.rect(0, 0, W, H, "F");

  // Triángulos decorativos navy (esquinas)
  doc.setFillColor(...NAVY);
  doc.triangle(0, 0, 170, 0, 0, 170, "F");
  doc.triangle(W, H, W - 170, H, W, H - 170, "F");

  // Marco doble
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(2);
  doc.rect(22, 22, W - 44, H - 44);
  doc.setLineWidth(0.6);
  doc.rect(30, 30, W - 60, H - 60);

  // Logo + wordmark
  try {
    const img = await loadImage(logoUrl);
    const ratio = img.width / img.height;
    const h = 70;
    const w = h * ratio;
    doc.addImage(img, "PNG", (W - w) / 2, 55, w, h);
  } catch {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...NAVY);
    doc.setFontSize(28);
    doc.text("MOR ACADEMY", W / 2, 100, { align: "center" });
  }

  // CERTIFICADO
  doc.setFont("times", "normal");
  doc.setTextColor(...NAVY);
  doc.setFontSize(56);
  doc.text("CERTIFICADO", W / 2, 200, { align: "center", charSpace: 6 });

  // DE APROBACIÓN con dashes dorados
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GOLD);
  doc.setFontSize(14);
  const subtitle = "DE APROBACIÓN";
  doc.text(subtitle, W / 2, 230, { align: "center", charSpace: 8 });
  const subW = doc.getTextWidth(subtitle) + 8 * (subtitle.length - 1);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.8);
  const dashY = 226;
  doc.line(W / 2 - subW / 2 - 40, dashY, W / 2 - subW / 2 - 10, dashY);
  doc.line(W / 2 + subW / 2 + 10, dashY, W / 2 + subW / 2 + 40, dashY);

  // "Se otorga..."
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...INK);
  doc.setFontSize(13);
  doc.text("Se otorga el presente certificado a", W / 2, 270, { align: "center" });

  // Nombre
  doc.setFont("times", "bold");
  doc.setTextColor(...NAVY);
  doc.setFontSize(36);
  doc.text(cert.employees?.nombre ?? "—", W / 2, 315, { align: "center" });

  // Línea decorativa bajo el nombre
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.8);
  doc.line(W * 0.2, 335, W * 0.8, 335);

  // "por completar..."
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...INK);
  doc.setFontSize(13);
  doc.text("por completar satisfactoriamente la capacitación", W / 2, 370, { align: "center" });

  // Nombre del curso — auto-ajuste y wrap a 2 líneas
  const courseName = cert.courses?.nombre ?? "—";
  doc.setFont("times", "bold");
  doc.setTextColor(...NAVY);
  const maxWidth = W * 0.7;
  let fontSize = 26;
  let lines: string[] = [courseName];
  while (fontSize >= 14) {
    doc.setFontSize(fontSize);
    lines = doc.splitTextToSize(courseName, maxWidth);
    if (lines.length <= 2 && lines.every((l) => doc.getTextWidth(l) <= maxWidth)) break;
    fontSize -= 2;
  }
  const lineH = fontSize * 1.15;
  const startY = lines.length === 1 ? 400 : 392;
  lines.slice(0, 2).forEach((l, i) => doc.text(l, W / 2, startY + i * lineH, { align: "center" }));

  // Línea inferior
  const afterCourseY = startY + (Math.min(lines.length, 2) - 1) * lineH + 20;
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.8);
  doc.line(W * 0.2, afterCourseY, W * 0.8, afterCourseY);

  // Tres columnas: Nota / Fecha / Horas
  const metaY = afterCourseY + 30;
  const colXs = [W * 0.28, W * 0.5, W * 0.72];
  const fecha = new Date(cert.fecha_emision).toLocaleDateString("es-SV", {
    day: "numeric", month: "long", year: "numeric",
  });
  const horas = cert.courses?.duracion_min
    ? `${Math.max(1, Math.round(cert.courses.duracion_min / 60))} horas`
    : "—";
  const labels = ["Nota obtenida", "Fecha de emisión", "Horas de formación"];
  const values = [`${cert.nota}%`, fecha, horas];

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.setFontSize(10);
  labels.forEach((l, i) => doc.text(l, colXs[i], metaY, { align: "center" }));

  doc.setFont("times", "normal");
  doc.setTextColor(...NAVY_SOFT);
  doc.setFontSize(14);
  values.forEach((v, i) => doc.text(v, colXs[i], metaY + 22, { align: "center" }));

  // Separadores verticales entre columnas
  doc.setDrawColor(200, 195, 180);
  doc.setLineWidth(0.5);
  doc.line((colXs[0] + colXs[1]) / 2, metaY - 8, (colXs[0] + colXs[1]) / 2, metaY + 30);
  doc.line((colXs[1] + colXs[2]) / 2, metaY - 8, (colXs[1] + colXs[2]) / 2, metaY + 30);

  // Pie: código + verificación
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  doc.text(`Código de verificación: ${cert.codigo}`, W / 2, H - 60, { align: "center" });
  doc.setTextColor(...MUTED);
  doc.setFontSize(9);
  doc.text(
    "Verifica la autenticidad de este certificado en la plataforma MOR ACADEMY",
    W / 2,
    H - 45,
    { align: "center" },
  );

  doc.save(`certificado-${cert.codigo}.pdf`);
}
