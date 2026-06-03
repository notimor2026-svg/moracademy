const { jsPDF } = require('jspdf');
const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
const W = doc.internal.pageSize.getWidth();
const H = doc.internal.pageSize.getHeight();

doc.setFillColor(255, 255, 255);
doc.rect(0, 0, W, H, 'F');

doc.setDrawColor(0, 0, 0);
doc.setLineWidth(1);
doc.rect(30, 30, W - 60, H - 60);

let y = 60;
doc.setFont('helvetica', 'bold');
doc.setFontSize(20);
doc.text('MOR ACADEMY', W / 2, y + 20, { align: 'center' });
y += 50;

doc.setFontSize(28);
doc.text('CERTIFICADO DE APROBACIÓN', W / 2, y, { align: 'center' });
y += 30;

doc.setFont('helvetica', 'normal');
doc.setFontSize(12);
doc.text('Se otorga el presente certificado a', W / 2, y, { align: 'center' });
y += 30;

doc.setFont('helvetica', 'bold');
doc.setFontSize(26);
doc.text('Juan Carlos Ramírez Pérez', W / 2, y, { align: 'center' });
y += 28;

doc.setFont('helvetica', 'normal');
doc.setFontSize(12);
doc.text('por haber completado satisfactoriamente la capacitación', W / 2, y, { align: 'center' });
y += 26;

const courseName = 'Gestión de Proyectos con Metodologías Ágiles Avanzadas';
doc.setFont('helvetica', 'bolditalic');
let fSize = 20;
let lines = [courseName];
while (fSize >= 12) {
  doc.setFontSize(fSize);
  lines = doc.splitTextToSize(courseName, W * 0.78);
  if (lines.length <= 2) break;
  fSize -= 2;
}
const lineH = fSize * 1.3;
lines.slice(0, 2).forEach((l, i) => doc.text(l, W / 2, y + i * lineH, { align: 'center' }));
y += Math.min(lines.length, 2) * lineH + 40;

const colXs = [W * 0.25, W * 0.5, W * 0.75];
const labels = ['NOTA OBTENIDA', 'FECHA DE EMISIÓN', 'HORAS DE FORMACIÓN'];
const values = ['95%', '3 de junio de 2026', '8 horas'];

doc.setDrawColor(180, 180, 180);
doc.setLineWidth(0.4);
doc.line(colXs[0], y - 10, colXs[2], y - 10);

doc.setFont('helvetica', 'bold');
doc.setFontSize(9);
doc.setTextColor(100, 100, 100);
labels.forEach((l, i) => doc.text(l, colXs[i], y, { align: 'center' }));

doc.setFontSize(16);
doc.setTextColor(0, 0, 0);
values.forEach((v, i) => doc.text(v, colXs[i], y + 22, { align: 'center' }));

doc.setDrawColor(180, 180, 180);
doc.setLineWidth(0.4);
doc.line(colXs[0], y + 36, colXs[2], y + 36);

const footerY = H - 60;
doc.setFont('helvetica', 'normal');
doc.setFontSize(9);
doc.setTextColor(100, 100, 100);
doc.text('Código de verificación: MA-TEST123-XYZ', W / 2, footerY, { align: 'center' });
doc.text('Verifica la autenticidad de este certificado en la plataforma MOR ACADEMY', W / 2, footerY + 12, { align: 'center' });

doc.save('/mnt/documents/test-cert.pdf');
