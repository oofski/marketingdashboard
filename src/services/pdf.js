import { jsPDF } from 'jspdf';
import { CONSENT_TEMPLATES } from './translations.js';

// All measurements use points (1/72 inch). Letter size is 612 x 792.
const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 54; // 0.75 inch
const CONTENT_W = PAGE_W - MARGIN * 2;

function drawHeader(doc, clinic) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(20, 60, 100);
  doc.text(clinic.clinic_name || 'Dental Clinic', MARGIN, MARGIN);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(70);
  let y = MARGIN + 14;
  if (clinic.clinic_address) {
    doc.text(clinic.clinic_address, MARGIN, y);
    y += 11;
  }
  const line = [clinic.clinic_phone, clinic.clinic_email].filter(Boolean).join('  ·  ');
  if (line) {
    doc.text(line, MARGIN, y);
    y += 11;
  }
  if (clinic.clinic_license) {
    doc.text(`License: ${clinic.clinic_license}`, MARGIN, y);
    y += 11;
  }
  doc.setDrawColor(20, 60, 100);
  doc.setLineWidth(1);
  doc.line(MARGIN, y + 4, PAGE_W - MARGIN, y + 4);
  return y + 18;
}

function drawFooter(doc, text) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120);
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.text(text, MARGIN, PAGE_H - 30);
    doc.text(`Page ${i} of ${pages}`, PAGE_W - MARGIN, PAGE_H - 30, { align: 'right' });
  }
}

function wrap(doc, text, width) {
  return doc.splitTextToSize(text || '', width);
}

function checkPage(doc, y, needed = 40) {
  if (y + needed > PAGE_H - 60) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

export function generateConsentPdf({ clinic, patient, language = 'en', signatureDataUrl, signedAt }) {
  const tpl = CONSENT_TEMPLATES[language] || CONSENT_TEMPLATES.en;
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });

  let y = drawHeader(doc, clinic);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(20);
  doc.text(tpl.title, PAGE_W / 2, y, { align: 'center' });
  y += 24;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(40);

  // Patient block
  const patientLines = [
    `Patient: ${patient.first_name} ${patient.last_name}`,
    `Date of Birth: ${patient.date_of_birth || 'N/A'}`,
    `Patient ID: ${patient.id}`,
    `Date: ${new Date().toLocaleDateString()}`,
  ];
  for (const line of patientLines) {
    doc.text(line, MARGIN, y);
    y += 13;
  }
  y += 6;

  // Intro
  const introLines = wrap(doc, tpl.intro, CONTENT_W);
  doc.text(introLines, MARGIN, y);
  y += introLines.length * 13 + 8;

  // Sections
  for (const section of tpl.sections) {
    y = checkPage(doc, y, 60);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(section.heading, MARGIN, y);
    y += 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const lines = wrap(doc, section.body, CONTENT_W);
    for (const ln of lines) {
      y = checkPage(doc, y, 20);
      doc.text(ln, MARGIN, y);
      y += 12;
    }
    y += 6;
  }

  // Signature block
  y = checkPage(doc, y, 160);
  y += 16;
  doc.setDrawColor(60);
  doc.setLineWidth(0.5);

  // Signature image
  const sigBoxY = y;
  const sigBoxH = 70;
  doc.rect(MARGIN, sigBoxY, 280, sigBoxH);
  if (signatureDataUrl) {
    try {
      doc.addImage(signatureDataUrl, 'PNG', MARGIN + 4, sigBoxY + 4, 272, sigBoxH - 8);
    } catch (e) {
      // ignore add-image failure
    }
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(tpl.signatureLine, MARGIN, sigBoxY + sigBoxH + 12);

  // Date
  const dateX = MARGIN + 300;
  doc.rect(dateX, sigBoxY, PAGE_W - MARGIN - dateX, sigBoxH);
  doc.setFontSize(11);
  doc.text(signedAt ? new Date(signedAt).toLocaleString() : new Date().toLocaleString(),
    dateX + 8, sigBoxY + sigBoxH / 2);
  doc.setFontSize(9);
  doc.text(tpl.dateLine, dateX, sigBoxY + sigBoxH + 12);

  y = sigBoxY + sigBoxH + 30;
  doc.setFontSize(10);
  doc.text(`${tpl.nameLine}: ${patient.first_name} ${patient.last_name}`, MARGIN, y);

  drawFooter(doc, clinic.clinic_name || '');
  return doc;
}

const TEETH_PER_ROW = 16;
const TOOTH_W = 18;
const TOOTH_H = 22;
const TOOTH_GAP = 2;

function drawToothChart(doc, x0, y0, findingsByTooth) {
  const labelH = 12;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setDrawColor(60);
  doc.setLineWidth(0.4);

  // Upper arch (teeth 1-16)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Upper Arch', x0, y0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);

  for (let i = 0; i < TEETH_PER_ROW; i++) {
    const toothNumber = i + 1;
    const x = x0 + i * (TOOTH_W + TOOTH_GAP);
    const y = y0 + 8;
    drawTooth(doc, x, y, toothNumber, findingsByTooth[toothNumber]);
    doc.text(String(toothNumber), x + TOOTH_W / 2, y + TOOTH_H + 8, { align: 'center' });
  }

  // Lower arch (teeth 32 down to 17)
  const lowerY = y0 + TOOTH_H + 36;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Lower Arch', x0, lowerY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  for (let i = 0; i < TEETH_PER_ROW; i++) {
    const toothNumber = 32 - i;
    const x = x0 + i * (TOOTH_W + TOOTH_GAP);
    const y = lowerY + 8;
    drawTooth(doc, x, y, toothNumber, findingsByTooth[toothNumber]);
    doc.text(String(toothNumber), x + TOOTH_W / 2, y + TOOTH_H + 8, { align: 'center' });
  }

  return lowerY + TOOTH_H + labelH + 4;
}

function hexToRgb(hex) {
  if (!hex) return null;
  const h = hex.replace('#', '');
  if (h.length !== 6) return null;
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function drawTooth(doc, x, y, _toothNumber, finding) {
  if (finding) {
    const rgb = hexToRgb(finding.color) || [220, 220, 220];
    doc.setFillColor(rgb[0], rgb[1], rgb[2]);
    doc.rect(x, y, TOOTH_W, TOOTH_H, 'F');
  } else {
    doc.setFillColor(255, 255, 255);
    doc.rect(x, y, TOOTH_W, TOOTH_H, 'F');
  }
  doc.setDrawColor(80);
  doc.rect(x, y, TOOTH_W, TOOTH_H);
}

export function generateTreatmentReportPdf({
  clinic, patient, visit, doctor, findings, notes,
}) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  let y = drawHeader(doc, clinic);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(20);
  doc.text('Dental Treatment Report', PAGE_W / 2, y, { align: 'center' });
  y += 24;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(40);

  // Patient and visit info in two columns
  const colW = CONTENT_W / 2;
  const leftLines = [
    `Patient: ${patient.first_name} ${patient.last_name}`,
    `Patient ID: ${patient.id}`,
    `DOB: ${patient.date_of_birth || 'N/A'}`,
    `Phone: ${patient.phone || 'N/A'}`,
  ];
  const rightLines = [
    `Visit Date: ${new Date(visit.visit_date).toLocaleString()}`,
    `Visit ID: ${visit.id}`,
    `Doctor: ${doctor?.full_name || 'N/A'}`,
    `Status: ${visit.status || 'open'}`,
  ];
  for (let i = 0; i < Math.max(leftLines.length, rightLines.length); i++) {
    if (leftLines[i]) doc.text(leftLines[i], MARGIN, y);
    if (rightLines[i]) doc.text(rightLines[i], MARGIN + colW, y);
    y += 13;
  }
  y += 6;

  // Alerts
  if (patient.allergies || patient.medical_history) {
    doc.setFillColor(255, 240, 230);
    doc.setDrawColor(200, 120, 60);
    const alertH = 36;
    doc.rect(MARGIN, y, CONTENT_W, alertH, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(150, 60, 0);
    doc.text('Patient Alerts', MARGIN + 6, y + 12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60);
    if (patient.allergies) {
      doc.text(`Allergies: ${patient.allergies}`, MARGIN + 6, y + 22, { maxWidth: CONTENT_W - 12 });
    }
    if (patient.medical_history) {
      doc.text(`Medical: ${patient.medical_history}`, MARGIN + 6, y + 32, { maxWidth: CONTENT_W - 12 });
    }
    y += alertH + 12;
  }

  // Tooth chart
  y = checkPage(doc, y, 120);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(20);
  doc.text('Dental Chart Findings', MARGIN, y);
  y += 10;

  const findingsByTooth = {};
  for (const f of findings) findingsByTooth[f.tooth_number] = f;
  y = drawToothChart(doc, MARGIN, y, findingsByTooth);
  y += 10;

  // Findings list
  if (findings.length) {
    y = checkPage(doc, y, 40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Findings Summary', MARGIN, y);
    y += 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    for (const f of findings) {
      y = checkPage(doc, y, 16);
      const parts = [`Tooth #${f.tooth_number}`, f.condition, f.surfaces].filter(Boolean);
      doc.setFont('helvetica', 'bold');
      doc.text(parts[0] + ':', MARGIN, y);
      doc.setFont('helvetica', 'normal');
      const rest = parts.slice(1).join(' · ');
      doc.text(rest, MARGIN + 50, y, { maxWidth: CONTENT_W - 50 });
      y += 11;
      if (f.note) {
        const noteLines = wrap(doc, `Note: ${f.note}`, CONTENT_W - 50);
        for (const ln of noteLines) {
          y = checkPage(doc, y, 16);
          doc.text(ln, MARGIN + 50, y);
          y += 11;
        }
      }
    }
    y += 6;
  }

  // Clinical notes by category
  const grouped = notes.reduce((acc, n) => {
    const cat = n.category || 'general';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(n);
    return acc;
  }, {});

  const CATEGORY_TITLES = {
    general: 'General Notes',
    exam: 'Examination Findings',
    treatment_plan: 'Treatment Plan',
    follow_up: 'Follow-Up Recommendations',
    diagnosis: 'Diagnosis',
  };

  for (const [cat, items] of Object.entries(grouped)) {
    y = checkPage(doc, y, 40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(CATEGORY_TITLES[cat] || cat, MARGIN, y);
    y += 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    for (const n of items) {
      y = checkPage(doc, y, 20);
      const prefix = n.tooth_number ? `(Tooth #${n.tooth_number}) ` : '';
      const text = prefix + n.content;
      const lines = wrap(doc, '• ' + text, CONTENT_W);
      for (const ln of lines) {
        y = checkPage(doc, y, 16);
        doc.text(ln, MARGIN, y);
        y += 12;
      }
      y += 2;
    }
    y += 6;
  }

  // Next appointment
  if (visit.next_appointment) {
    y = checkPage(doc, y, 30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Next Appointment', MARGIN, y);
    y += 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(new Date(visit.next_appointment).toLocaleString(), MARGIN, y);
    y += 16;
  }

  // Doctor signature line
  y = checkPage(doc, y, 80);
  y += 20;
  doc.setDrawColor(60);
  doc.line(MARGIN, y, MARGIN + 220, y);
  y += 12;
  doc.setFontSize(9);
  doc.text(`${doctor?.full_name || 'Treating Doctor'}, ${doctor?.role || 'DDS'}`, MARGIN, y);

  drawFooter(doc, clinic.clinic_name || '');
  return doc;
}

export async function savePdfAsBytes(doc) {
  const blob = doc.output('blob');
  const buf = await blob.arrayBuffer();
  return new Uint8Array(buf);
}

export function pdfDataUrl(doc) {
  return doc.output('dataurlstring');
}
