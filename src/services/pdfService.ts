// src/services/pdfService.ts
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fmt } from '@/accounting/utils';

interface ReportHeader {
  title: string;
  subtitle?: string;
  date?: string;
  period?: string;
}

function addReportHeader(doc: jsPDF, header: ReportHeader): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(header.title, pageWidth / 2, y, { align: 'center' });
  y += 8;

  // Subtitle
  if (header.subtitle) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(header.subtitle, pageWidth / 2, y, { align: 'center' });
    y += 6;
  }

  // Date/Period
  if (header.date || header.period) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.text(header.date || header.period || '', pageWidth / 2, y, { align: 'center' });
    y += 4;
  }

  // Line separator
  y += 4;
  doc.setLineWidth(0.5);
  doc.line(20, y, pageWidth - 20, y);
  
  return y + 10;
}

function addFooter(doc: jsPDF): void {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Página ${i} de ${pageCount} - Generado: ${new Date().toLocaleString('es')}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }
}

export interface TrialBalanceRow {
  id: string;
  name: string;
  debit: number;
  credit: number;
  balance: number;
}

export function exportTrialBalanceToPDF(
  rows: TrialBalanceRow[],
  totals: { debit: number; credit: number },
  period: string
): void {
  const doc = new jsPDF();
  
  const startY = addReportHeader(doc, {
    title: 'Balance de Comprobación',
    period: `Período: ${period}`,
  });

  autoTable(doc, {
    startY,
    head: [['Código', 'Cuenta', 'Debe', 'Haber', 'Saldo']],
    body: rows.map(r => [
      r.id,
      r.name,
      r.debit ? fmt(r.debit) : '',
      r.credit ? fmt(r.credit) : '',
      fmt(r.balance),
    ]),
    foot: [[
      '', 'TOTALES',
      fmt(totals.debit),
      fmt(totals.credit),
      fmt(totals.debit - totals.credit),
    ]],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [66, 66, 66] },
    footStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 25 },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
    },
  });

  addFooter(doc);
  doc.save(`balance-comprobacion-${period.replace(/\s/g, '-')}.pdf`);
}

export interface IncomeStatementData {
  ingresosDetalle: Array<{ id: string; name: string; amount: number }>;
  gastosDetalle: Array<{ id: string; name: string; amount: number }>;
  ingresos: number;
  gastos: number;
  utilidad: number;
}

export function exportIncomeStatementToPDF(
  data: IncomeStatementData,
  period: string
): void {
  const doc = new jsPDF();
  
  let startY = addReportHeader(doc, {
    title: 'Estado de Resultados',
    period: `Período: ${period}`,
  });

  // Ingresos
  autoTable(doc, {
    startY,
    head: [['INGRESOS', '', '']],
    body: data.ingresosDetalle.map(ing => [ing.id, ing.name, fmt(ing.amount)]),
    foot: [['', 'Total Ingresos', fmt(data.ingresos)]],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [76, 175, 80] },
    footStyles: { fillColor: [200, 230, 200], textColor: [0, 0, 0], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 25 },
      2: { halign: 'right' },
    },
  });

  // @ts-ignore - autoTable adds finalY to doc
  startY = doc.lastAutoTable.finalY + 10;

  // Gastos
  autoTable(doc, {
    startY,
    head: [['GASTOS', '', '']],
    body: data.gastosDetalle.map(gst => [gst.id, gst.name, fmt(gst.amount)]),
    foot: [['', 'Total Gastos', fmt(data.gastos)]],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [244, 67, 54] },
    footStyles: { fillColor: [255, 200, 200], textColor: [0, 0, 0], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 25 },
      2: { halign: 'right' },
    },
  });

  // @ts-ignore
  startY = doc.lastAutoTable.finalY + 10;

  // Utilidad
  autoTable(doc, {
    startY,
    body: [['UTILIDAD/PÉRDIDA NETA', fmt(data.utilidad)]],
    styles: { fontSize: 12, fontStyle: 'bold' },
    bodyStyles: { 
      fillColor: data.utilidad >= 0 ? [200, 230, 200] : [255, 200, 200],
      textColor: [0, 0, 0],
    },
    columnStyles: {
      1: { halign: 'right' },
    },
  });

  addFooter(doc);
  doc.save(`estado-resultados-${period.replace(/\s/g, '-')}.pdf`);
}

export interface BalanceSheetData {
  activosDetalle: Array<{ id: string; name: string; balance: number }>;
  pasivosDetalle: Array<{ id: string; name: string; balance: number }>;
  patrimonioDetalle: Array<{ id: string; name: string; balance: number }>;
  utilidadAcumulada: number;
  totalActivo: number;
  totalPasivo: number;
  totalPatrimonio: number;
}

export function exportBalanceSheetToPDF(
  data: BalanceSheetData,
  date: string
): void {
  const doc = new jsPDF();
  
  let startY = addReportHeader(doc, {
    title: 'Balance General',
    date: `Al: ${date}`,
  });

  // Activos
  autoTable(doc, {
    startY,
    head: [['ACTIVOS', '', '']],
    body: data.activosDetalle.map(a => [a.id, a.name, fmt(a.balance)]),
    foot: [['', 'Total Activos', fmt(data.totalActivo)]],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [33, 150, 243] },
    footStyles: { fillColor: [200, 220, 255], textColor: [0, 0, 0], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 25 },
      2: { halign: 'right' },
    },
  });

  // @ts-ignore
  startY = doc.lastAutoTable.finalY + 10;

  // Pasivos
  autoTable(doc, {
    startY,
    head: [['PASIVOS', '', '']],
    body: data.pasivosDetalle.map(p => [p.id, p.name, fmt(p.balance)]),
    foot: [['', 'Total Pasivos', fmt(data.totalPasivo)]],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [255, 152, 0] },
    footStyles: { fillColor: [255, 230, 200], textColor: [0, 0, 0], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 25 },
      2: { halign: 'right' },
    },
  });

  // @ts-ignore
  startY = doc.lastAutoTable.finalY + 10;

  // Patrimonio
  const patrimonioBody = [
    ...data.patrimonioDetalle.map(p => [p.id, p.name, fmt(p.balance)]),
    ['—', 'Utilidad/Pérdida Acumulada', fmt(data.utilidadAcumulada)],
  ];

  autoTable(doc, {
    startY,
    head: [['PATRIMONIO', '', '']],
    body: patrimonioBody,
    foot: [['', 'Total Patrimonio', fmt(data.totalPatrimonio)]],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [156, 39, 176] },
    footStyles: { fillColor: [230, 200, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 25 },
      2: { halign: 'right' },
    },
  });

  // @ts-ignore
  startY = doc.lastAutoTable.finalY + 10;

  // Check
  const check = +(data.totalActivo - (data.totalPasivo + data.totalPatrimonio)).toFixed(2);
  autoTable(doc, {
    startY,
    body: [
      ['Total Pasivo + Patrimonio', fmt(data.totalPasivo + data.totalPatrimonio)],
      ['Verificación (Activo - Pasivo - Patrimonio)', fmt(check)],
    ],
    styles: { fontSize: 10, fontStyle: 'bold' },
    bodyStyles: { 
      fillColor: check === 0 ? [200, 230, 200] : [255, 200, 200],
      textColor: [0, 0, 0],
    },
    columnStyles: {
      1: { halign: 'right' },
    },
  });

  addFooter(doc);
  doc.save(`balance-general-${date}.pdf`);
}

export interface JournalEntryPDF {
  id: string;
  date: string;
  memo?: string;
  void_of?: string;
  lines: Array<{
    account_id: string;
    account_name: string;
    debit: number;
    credit: number;
    line_memo?: string;
  }>;
}

export function exportJournalToPDF(
  entries: JournalEntryPDF[],
  period: string
): void {
  const doc = new jsPDF();
  
  const startY = addReportHeader(doc, {
    title: 'Libro Diario',
    period: `Período: ${period}`,
  });

  const body: any[] = [];
  let totalDebit = 0;
  let totalCredit = 0;

  for (const entry of entries) {
    // Entry header row
    body.push([
      { content: entry.id, styles: { fontStyle: 'bold' } },
      { content: entry.date, styles: { fontStyle: 'bold' } },
      { content: entry.memo || '', colSpan: 3 },
    ]);

    // Entry lines
    for (const line of entry.lines) {
      body.push([
        '',
        line.account_id,
        line.account_name,
        line.debit ? fmt(line.debit) : '',
        line.credit ? fmt(line.credit) : '',
      ]);
      totalDebit += line.debit;
      totalCredit += line.credit;
    }

    // Separator row
    body.push([{ content: '', colSpan: 5, styles: { minCellHeight: 2 } }]);
  }

  autoTable(doc, {
    startY,
    head: [['ID', 'Fecha', 'Cuenta', 'Debe', 'Haber']],
    body,
    foot: [['', '', 'TOTALES', fmt(totalDebit), fmt(totalCredit)]],
    styles: { fontSize: 8 },
    headStyles: { fillColor: [66, 66, 66] },
    footStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 25 },
      3: { halign: 'right' },
      4: { halign: 'right' },
    },
  });

  addFooter(doc);
  doc.save(`libro-diario-${period.replace(/\s/g, '-')}.pdf`);
}

export interface CashFlowData {
  initialCashBalance: number;
  operacionDetalle: Array<{ id: string; name: string; amount: number }>;
  inversionDetalle: Array<{ id: string; name: string; amount: number }>;
  financiacionDetalle: Array<{ id: string; name: string; amount: number }>;
  flujoOperacion: number;
  flujoInversion: number;
  flujoFinanciacion: number;
  flujoNeto: number;
  finalCashBalance: number;
}

export function exportCashFlowToPDF(data: CashFlowData, period: string): void {
  const doc = new jsPDF();
  
  let startY = addReportHeader(doc, {
    title: 'Estado de Flujo de Caja',
    period: `Período: ${period}`,
  });

  // Initial Balance
  autoTable(doc, {
    startY,
    body: [['SALDO INICIAL DE EFECTIVO', fmt(data.initialCashBalance)]],
    styles: { fontSize: 11, fontStyle: 'bold' },
    bodyStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0] },
    columnStyles: { 1: { halign: 'right' } },
  });

  // @ts-ignore
  startY = doc.lastAutoTable.finalY + 8;

  // Operating Activities
  if (data.operacionDetalle.length > 0) {
    autoTable(doc, {
      startY,
      head: [['ACTIVIDADES DE OPERACIÓN', '', '']],
      body: data.operacionDetalle.map(i => [i.id, i.name, (i.amount >= 0 ? '+' : '') + fmt(i.amount)]),
      foot: [['', 'Flujo Neto de Operación', (data.flujoOperacion >= 0 ? '+' : '') + fmt(data.flujoOperacion)]],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [33, 150, 243] },
      footStyles: { fillColor: [200, 220, 255], textColor: [0, 0, 0], fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 25 }, 2: { halign: 'right' } },
    });
    // @ts-ignore
    startY = doc.lastAutoTable.finalY + 6;
  }

  // Investment Activities
  if (data.inversionDetalle.length > 0) {
    autoTable(doc, {
      startY,
      head: [['ACTIVIDADES DE INVERSIÓN', '', '']],
      body: data.inversionDetalle.map(i => [i.id, i.name, (i.amount >= 0 ? '+' : '') + fmt(i.amount)]),
      foot: [['', 'Flujo Neto de Inversión', (data.flujoInversion >= 0 ? '+' : '') + fmt(data.flujoInversion)]],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [156, 39, 176] },
      footStyles: { fillColor: [230, 200, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 25 }, 2: { halign: 'right' } },
    });
    // @ts-ignore
    startY = doc.lastAutoTable.finalY + 6;
  }

  // Financing Activities
  if (data.financiacionDetalle.length > 0) {
    autoTable(doc, {
      startY,
      head: [['ACTIVIDADES DE FINANCIACIÓN', '', '']],
      body: data.financiacionDetalle.map(i => [i.id, i.name, (i.amount >= 0 ? '+' : '') + fmt(i.amount)]),
      foot: [['', 'Flujo Neto de Financiación', (data.flujoFinanciacion >= 0 ? '+' : '') + fmt(data.flujoFinanciacion)]],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [255, 152, 0] },
      footStyles: { fillColor: [255, 230, 200], textColor: [0, 0, 0], fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 25 }, 2: { halign: 'right' } },
    });
    // @ts-ignore
    startY = doc.lastAutoTable.finalY + 6;
  }

  // Net Cash Flow
  autoTable(doc, {
    startY,
    body: [['FLUJO NETO TOTAL', (data.flujoNeto >= 0 ? '+' : '') + fmt(data.flujoNeto)]],
    styles: { fontSize: 11, fontStyle: 'bold' },
    bodyStyles: { 
      fillColor: data.flujoNeto >= 0 ? [200, 230, 200] : [255, 200, 200],
      textColor: [0, 0, 0],
    },
    columnStyles: { 1: { halign: 'right' } },
  });

  // @ts-ignore
  startY = doc.lastAutoTable.finalY + 8;

  // Final Balance
  autoTable(doc, {
    startY,
    body: [
      ['SALDO FINAL DE EFECTIVO', fmt(data.finalCashBalance)],
      ['Verificación: Inicial + Flujo = Final', `${fmt(data.initialCashBalance)} + ${fmt(data.flujoNeto)} = ${fmt(data.finalCashBalance)}`],
    ],
    styles: { fontSize: 10 },
    bodyStyles: { fillColor: [200, 220, 255], textColor: [0, 0, 0] },
    columnStyles: { 1: { halign: 'right' } },
  });

  addFooter(doc);
  doc.save(`flujo-caja-${period.replace(/\s/g, '-')}.pdf`);
}
