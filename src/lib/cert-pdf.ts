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

// Crop a region of an image and return a PNG dataURL
function cropImage(
  img: HTMLImageElement,
  sx: number, sy: number, sw: number, sh: number,
): string {
  const c = document.createElement("canvas");
  c.width = sw; c.height = sh;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  return c.toDataURL("image/png");
}

export async function downloadCertificate(cert: Cert) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  // Fondo crema
  doc.setFillColor(...CREAM);
  doc.rect(0, 0, W, H, "F");

  // Triángulos decorativos navy (esquinas sup-izq e inf-der)
  doc.setFillColor(...NAVY);
  doc.triangle(0, 0, 170, 0, 0, 170, "F");
  doc.triangle(W, H, W - 170, H, W, H - 170, "F");

  // Marco doble
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(2);
  doc.rect(22, 22, W - 44, H - 44);
  doc.setLineWidth(0.6);
  doc.rect(30, 30, W - 60, H - 60);

  // Cargar logo (vertical: shield arriba, wordmark abajo)
  let logoImg: HTMLImageElement | null = null;
  try { logoImg = await loadImage(logoUrl); } catch { /* ignore */ }

  // Marca de agua del escudo a la derecha
  if (logoImg) {
    try {
      // Recorta el escudo (parte superior ~58% del logo)
      const shieldCrop = cropImage(logoImg, 0, 0, logoImg.width, Math.floor(logoImg.height * 0.58));
      const ratio = (logoImg.width) / Math.floor(logoImg.height * 0.58);
      const wmH = 360;
      const wmW = wmH * ratio;
      const gState = (doc as any).GState ? new (doc as any).GState({ opacity: 0.08 }) : null;
      if (gState) (doc as any).setGState(gState);
      doc.addImage(shieldCrop, "PNG", W - wmW * 0.75, H / 2 - wmH / 2, wmW, wmH);
      if (gState) (doc as any).setGState(new (doc as any).GState({ opacity: 1 }));
    } catch { /* ignore */ }
  }

  // Encabezado: escudo + wordmark "MOR ACADEMY" en horizontal
  const headerY = 55;
  const headerH = 90;
  if (logoImg) {
    try {
      const shieldH = logoImg.height * 0.58;
      const shieldCrop = cropImage(logoImg, 0, 0, logoImg.width, Math.floor(shieldH));
      const sRatio = logoImg.width / shieldH;
      const sH = headerH;
      const sW = sH * sRatio;

      // Wordmark a la derecha del escudo
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...NAVY);
      doc.setFontSize(44);
      const wordmark = "MOR";
      const subWord = "ACADEMY";
      doc.setFontSize(20);
      const acadW = doc.getTextWidth(subWord);
      doc.setFontSize(44);
      const morW = doc.getTextWidth(wordmark);
      const textBlockW = Math.max(morW, acadW);
      const gap = 16;
      const totalW = sW + gap + textBlockW;
      const startX = (W - totalW) / 2;

      doc.addImage(shieldCrop, "PNG", startX, headerY, sW, sH);

      const textX = startX + sW + gap;
      doc.setFontSize(44);
      doc.text(wordmark, textX, headerY + 50);
      doc.setFontSize(20);
      doc.setFont("helvetica", "normal");
      doc.text(subWord, textX, headerY + 78, { charSpace: 2 });
    } catch {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...NAVY);
      doc.setFontSize(28);
      doc.text("MOR ACADEMY", W / 2, headerY + 50, { align: "center" });
    }
  } else {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...NAVY);
    doc.setFontSize(28);
    doc.text("MOR ACADEMY", W / 2, headerY + 50, { align: "center" });
  }

  // CERTIFICADO
  doc.setFont("times", "normal");
  doc.setTextColor(...NAVY);
  doc.setFontSize(54);
  doc.text("CERTIFICADO", W / 2, 200, { align: "center", charSpace: 6 });

  // DE APROBACIÓN con guiones dorados
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GOLD);
  doc.setFontSize(13);
  const subtitle = "DE APROBACIÓN";
  doc.text(subtitle, W / 2, 228, { align: "center", charSpace: 8 });
  const subW = doc.getTextWidth(subtitle) + 8 * (subtitle.length - 1);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.8);
  const dashY = 224;
  doc.line(W / 2 - subW / 2 - 40, dashY, W / 2 - subW / 2 - 10, dashY);
  doc.line(W / 2 + subW / 2 + 10, dashY, W / 2 + subW / 2 + 40, dashY);

  // "Se otorga..."
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...INK);
  doc.setFontSize(13);
  doc.text("Se otorga el presente certificado a", W / 2, 265, { align: "center" });

  // Nombre
  doc.setFont("times", "bold");
  doc.setTextColor(...NAVY);
  doc.setFontSize(38);
  doc.text(cert.employees?.nombre ?? "—", W / 2, 310, { align: "center" });

  // Línea decorativa bajo el nombre
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.8);
  doc.line(W * 0.2, 332, W * 0.8, 332);

  // "por completar..."
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...INK);
  doc.setFontSize(13);
  doc.text("por completar satisfactoriamente la capacitación", W / 2, 365, { align: "center" });

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
  const startY = lines.length === 1 ? 395 : 387;
  lines.slice(0, 2).forEach((l, i) => doc.text(l, W / 2, startY + i * lineH, { align: "center" }));

  // Línea inferior
  const afterCourseY = startY + (Math.min(lines.length, 2) - 1) * lineH + 18;
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.8);
  doc.line(W * 0.2, afterCourseY, W * 0.8, afterCourseY);

  // Tres columnas: Nota / Fecha / Horas
  const metaY = afterCourseY + 28;
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

  // Sello circular en la parte inferior
  const sealCx = W / 2;
  const sealCy = metaY + 90;
  const sealR = 38;
  // Anillo exterior dorado
  doc.setFillColor(...GOLD);
  doc.circle(sealCx, sealCy, sealR, "F");
  // Disco interior navy
  doc.setFillColor(...NAVY);
  doc.circle(sealCx, sealCy, sealR - 5, "F");
  // Texto curvo "MOR ACADEMY" arriba (aproximación: arco con letras)
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...CREAM);
  doc.setFontSize(7);
  const sealText = "MOR ACADEMY";
  const arcR = sealR - 11;
  const totalAngle = Math.PI * 0.7; // arco superior
  const startAngle = Math.PI + (Math.PI - totalAngle) / 2;
  const step = totalAngle / (sealText.length - 1);
  for (let i = 0; i < sealText.length; i++) {
    const a = startAngle + step * i;
    const x = sealCx + arcR * Math.cos(a);
    const y = sealCy + arcR * Math.sin(a);
    const rot = (a + Math.PI / 2) * (180 / Math.PI);
    doc.text(sealText[i], x, y, { angle: -rot + 180, align: "center" } as any);
  }
  // Escudo dentro del sello
  if (logoImg) {
    try {
      const shieldH = logoImg.height * 0.58;
      const shieldCrop = cropImage(logoImg, 0, 0, logoImg.width, Math.floor(shieldH));
      const sRatio = logoImg.width / shieldH;
      const sealShieldH = sealR * 0.95;
      const sealShieldW = sealShieldH * sRatio;
      doc.addImage(
        shieldCrop, "PNG",
        sealCx - sealShieldW / 2, sealCy - sealShieldH / 2 + 4,
        sealShieldW, sealShieldH,
      );
    } catch { /* ignore */ }
  }

  // Pie: código + verificación
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  doc.text(`Código de verificación: ${cert.codigo}`, W / 2, H - 48, { align: "center" });
  doc.setTextColor(...MUTED);
  doc.setFontSize(9);
  doc.text(
    "Verifica la autenticidad de este certificado en la plataforma MOR ACADEMY",
    W / 2,
    H - 34,
    { align: "center" },
  );

  doc.save(`certificado-${cert.codigo}.pdf`);
}
