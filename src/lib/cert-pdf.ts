import { jsPDF } from "jspdf";

export function downloadCertificate(cert: {
  codigo: string;
  nota: number;
  fecha_emision: string;
  employees: { nombre: string; dui: string } | null;
  courses: { nombre: string } | null;
}) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  // Marco
  doc.setDrawColor(31, 42, 68);
  doc.setLineWidth(6);
  doc.rect(24, 24, W - 48, H - 48);
  doc.setLineWidth(1);
  doc.rect(40, 40, W - 80, H - 80);

  // Encabezado
  doc.setFont("helvetica", "bold");
  doc.setTextColor(31, 42, 68);
  doc.setFontSize(14);
  doc.text("MOR ACADEMY", W / 2, 90, { align: "center" });

  doc.setFontSize(34);
  doc.text("Certificado de Aprobación", W / 2, 150, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.setTextColor(80, 80, 90);
  doc.text("Se otorga el presente certificado a", W / 2, 200, { align: "center" });

  // Nombre
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 20, 30);
  doc.setFontSize(28);
  doc.text(cert.employees?.nombre ?? "—", W / 2, 245, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(120, 120, 130);
  doc.text(`DUI: ${cert.employees?.dui ?? "—"}`, W / 2, 265, { align: "center" });

  // Curso
  doc.setFontSize(13);
  doc.setTextColor(80, 80, 90);
  doc.text("por completar satisfactoriamente la capacitación", W / 2, 305, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setTextColor(31, 42, 68);
  doc.setFontSize(20);
  doc.text(cert.courses?.nombre ?? "—", W / 2, 340, { align: "center" });

  // Nota y fecha
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(80, 80, 90);
  const fecha = new Date(cert.fecha_emision).toLocaleDateString("es-SV", {
    day: "numeric", month: "long", year: "numeric",
  });
  doc.text(`Nota obtenida: ${cert.nota}%   ·   Emitido: ${fecha}`, W / 2, 380, { align: "center" });

  // Pie
  doc.setFontSize(9);
  doc.setTextColor(140, 140, 150);
  doc.text(
    `Código de verificación: ${cert.codigo}`,
    W / 2,
    H - 70,
    { align: "center" },
  );
  doc.text("MOR ACADEMY · Plataforma de Capacitación Corporativa", W / 2, H - 55, { align: "center" });

  doc.save(`certificado-${cert.codigo}.pdf`);
}
