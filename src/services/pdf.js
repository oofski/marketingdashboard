import { jsPDF } from 'jspdf';
import { formatDate } from './format.js';

// Letter size in points (1/72 inch).
const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;

function drawHeader(doc, company, employee, progress) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(20, 40, 70);
  doc.text(company.company_name || 'Onboarding', MARGIN, MARGIN);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90);
  let y = MARGIN + 14;
  const contact = [company.company_address, company.company_phone, company.company_email]
    .filter(Boolean)
    .join('  ·  ');
  if (contact) {
    doc.text(contact, MARGIN, y);
    y += 11;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(20);
  doc.text('Onboarding Checklist', MARGIN, y + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(40);
  y += 30;

  const left = [
    `Employee: ${employee.first_name} ${employee.last_name}`,
    `Position: ${employee.position || '—'}`,
  ];
  const right = [
    `Start date: ${formatDate(employee.start_date)}`,
    `Progress: ${progress.done}/${progress.applicable} complete (${progress.percent}%)`,
  ];
  for (let i = 0; i < left.length; i++) {
    doc.text(left[i], MARGIN, y);
    doc.text(right[i], MARGIN + CONTENT_W / 2, y);
    y += 13;
  }

  doc.setDrawColor(20, 40, 70);
  doc.setLineWidth(1);
  doc.line(MARGIN, y + 2, PAGE_W - MARGIN, y + 2);
  return y + 16;
}

function drawFooter(doc, company) {
  const pages = doc.internal.getNumberOfPages();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(130);
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.text(`${company.company_name || ''} — Onboarding`, MARGIN, PAGE_H - 28);
    doc.text(`Generated ${new Date().toLocaleDateString()}`, PAGE_W / 2, PAGE_H - 28, { align: 'center' });
    doc.text(`Page ${i} of ${pages}`, PAGE_W - MARGIN, PAGE_H - 28, { align: 'right' });
  }
}

function checkPage(doc, y, needed, company, repeatHeaderY) {
  if (y + needed > PAGE_H - 50) {
    doc.addPage();
    return repeatHeaderY;
  }
  return y;
}

const STATUS_MARK = { done: 'X', na: '—', pending: ' ' };

export function generateChecklistPdf({ company, employee, tasks, progress }) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const topY = drawHeader(doc, company, employee, progress);
  let y = topY;

  // Column geometry for each task row.
  const x = {
    status: MARGIN,
    task: MARGIN + 70,
    assignee: MARGIN + 320,
  };
  const assigneeW = PAGE_W - MARGIN - x.assignee;

  // Group tasks by section preserving order.
  const sections = [];
  const byName = {};
  for (const t of tasks) {
    if (!byName[t.section_name]) {
      byName[t.section_name] = { name: t.section_name, done_by_employee: t.done_by_employee, tasks: [] };
      sections.push(byName[t.section_name]);
    }
    byName[t.section_name].tasks.push(t);
  }

  for (const section of sections) {
    y = checkPage(doc, y, 50, company, topY);

    // Section header bar.
    doc.setFillColor(235, 240, 248);
    doc.rect(MARGIN, y, CONTENT_W, 20, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(25, 50, 90);
    const suffix = section.done_by_employee ? '   (Completed by employee)' : '';
    doc.text(section.name + suffix, MARGIN + 6, y + 14);
    y += 28;

    doc.setFontSize(9);
    for (const task of section.tasks) {
      const titleLines = doc.splitTextToSize(task.title, x.assignee - x.task - 8);
      const rowH = Math.max(16, titleLines.length * 11 + 4);
      y = checkPage(doc, y, rowH + 4, company, topY);

      // Checkbox.
      doc.setDrawColor(120);
      doc.setLineWidth(0.6);
      doc.rect(x.status, y - 8, 10, 10);
      const mark = STATUS_MARK[task.status] ?? ' ';
      if (mark !== ' ') {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(task.status === 'done' ? 30 : 140);
        doc.text(mark, x.status + 2, y);
      }
      // Status word.
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(130);
      doc.text(task.status === 'na' ? 'N/A' : task.status === 'done' ? 'Done' : 'Open',
        x.status + 14, y);

      // Task title.
      doc.setFontSize(9);
      doc.setTextColor(30);
      doc.text(titleLines, x.task, y);

      // Assignee + notes.
      doc.setTextColor(90);
      const assigneeText = task.assignee_name || (section.done_by_employee ? 'Employee' : '—');
      const aLines = doc.splitTextToSize(assigneeText, assigneeW);
      doc.text(aLines, x.assignee, y);
      let noteY = y + Math.max(titleLines.length, aLines.length) * 11;
      if (task.notes) {
        doc.setFontSize(8);
        doc.setTextColor(120);
        const nLines = doc.splitTextToSize('Note: ' + task.notes, x.assignee - x.task - 8);
        doc.text(nLines, x.task, noteY);
        noteY += nLines.length * 10;
        doc.setFontSize(9);
      }

      y = Math.max(y + rowH, noteY) + 4;
      doc.setDrawColor(232);
      doc.setLineWidth(0.4);
      doc.line(MARGIN, y - 4, PAGE_W - MARGIN, y - 4);
    }
    y += 8;
  }

  drawFooter(doc, company);
  return doc;
}

// Save a jsPDF doc — uses the native Save dialog in the desktop app, or a
// normal browser download otherwise.
export async function savePdf(doc, filename) {
  if (typeof window !== 'undefined' && window.electronAPI?.isElectron && window.electronAPI.exportDoc) {
    const blob = doc.output('blob');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    await window.electronAPI.exportDoc(filename, bytes);
  } else {
    doc.save(filename);
  }
}
