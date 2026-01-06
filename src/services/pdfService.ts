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

export interface NIIFIncomeStatementData {
  ventas: Array<{ id: string; name: string; amount: number }>;
  totalVentas: number;
  costoVentas: Array<{ id: string; name: string; amount: number }>;
  totalCostoVentas: number;
  utilidadBruta: number;
  margenBruto: number;
  gastosOperativos: Array<{ id: string; name: string; amount: number }>;
  totalGastosOperativos: number;
  utilidadOperativa: number;
  margenOperativo: number;
  otrosGastos: Array<{ id: string; name: string; amount: number }>;
  totalOtrosGastos: number;
  utilidadAntesImpuestos: number;
  impuesto: number;
  tasaImpuesto: number;
  taxEnabled: boolean;
  utilidadNeta: number;
  margenNeto: number;
}

export function exportIncomeStatementNIIFToPDF(data: NIIFIncomeStatementData, period: string): void {
  const doc = new jsPDF();
  let startY = addReportHeader(doc, { title: 'Estado de Resultados (NIIF)', period: `Período: ${period}` });

  const body: any[] = [
    [{ content: 'INGRESOS POR VENTAS', colSpan: 3, styles: { fillColor: [200, 230, 200], fontStyle: 'bold' } }],
    ...data.ventas.map(v => [v.id, v.name, fmt(v.amount)]),
    [{ content: '', styles: { fontStyle: 'bold' } }, 'Total Ingresos', { content: fmt(data.totalVentas), styles: { fontStyle: 'bold' } }],
    [{ content: '(-) COSTO DE VENTAS', colSpan: 3, styles: { fillColor: [255, 230, 200], fontStyle: 'bold' } }],
    ...data.costoVentas.map(c => [c.id, c.name, `(${fmt(c.amount)})`]),
    [{ content: 'UTILIDAD BRUTA', colSpan: 2, styles: { fillColor: [200, 220, 255], fontStyle: 'bold' } }, 
     { content: `${fmt(data.utilidadBruta)} (${data.margenBruto.toFixed(1)}%)`, styles: { fillColor: [200, 220, 255], fontStyle: 'bold' } }],
    [{ content: '(-) GASTOS OPERATIVOS', colSpan: 3, styles: { fillColor: [230, 200, 240], fontStyle: 'bold' } }],
    ...data.gastosOperativos.map(g => [g.id, g.name, `(${fmt(g.amount)})`]),
    [{ content: 'UTILIDAD OPERATIVA', colSpan: 2, styles: { fillColor: [200, 220, 255], fontStyle: 'bold' } },
     { content: `${fmt(data.utilidadOperativa)} (${data.margenOperativo.toFixed(1)}%)`, styles: { fillColor: [200, 220, 255], fontStyle: 'bold' } }],
  ];

  if (data.otrosGastos.length > 0) {
    body.push([{ content: '(-) OTROS GASTOS', colSpan: 3, styles: { fillColor: [230, 230, 230], fontStyle: 'bold' } }]);
    data.otrosGastos.forEach(o => body.push([o.id, o.name, `(${fmt(o.amount)})`]));
  }

  body.push([{ content: 'UTILIDAD ANTES DE IMPUESTOS', colSpan: 2, styles: { fillColor: [255, 243, 205], fontStyle: 'bold' } },
    { content: fmt(data.utilidadAntesImpuestos), styles: { fillColor: [255, 243, 205], fontStyle: 'bold' } }]);

  if (data.taxEnabled) {
    body.push(['—', `(-) Impuesto (${data.tasaImpuesto}%)`, `(${fmt(data.impuesto)})`]);
  }

  body.push([{ content: 'UTILIDAD NETA', colSpan: 2, styles: { fillColor: data.utilidadNeta >= 0 ? [200, 230, 200] : [255, 200, 200], fontStyle: 'bold' } },
    { content: `${fmt(data.utilidadNeta)} (${data.margenNeto.toFixed(1)}%)`, styles: { fillColor: data.utilidadNeta >= 0 ? [200, 230, 200] : [255, 200, 200], fontStyle: 'bold' } }]);

  autoTable(doc, { startY, head: [['Código', 'Concepto', 'Monto']], body, styles: { fontSize: 9 }, headStyles: { fillColor: [66, 66, 66] }, columnStyles: { 0: { cellWidth: 25 }, 2: { halign: 'right' } } });
  addFooter(doc);
  doc.save(`estado-resultados-niif-${period.replace(/\s/g, '-')}.pdf`);
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

export interface BalanceSheetNIIFData {
  activosCorrientes: Array<{ id: string; name: string; balance: number }>;
  totalActivosCorrientes: number;
  activosNoCorrientes: Array<{ id: string; name: string; balance: number }>;
  totalActivosNoCorrientes: number;
  totalActivo: number;
  pasivosCorrientes: Array<{ id: string; name: string; balance: number }>;
  totalPasivosCorrientes: number;
  pasivosNoCorrientes: Array<{ id: string; name: string; balance: number }>;
  totalPasivosNoCorrientes: number;
  totalPasivo: number;
  patrimonioDetalle: Array<{ id: string; name: string; balance: number }>;
  utilidadAcumulada: number;
  totalPatrimonio: number;
  razonCorriente: number | null;
  razonEndeudamiento: number;
  capitalTrabajo: number;
}

export function exportBalanceSheetNIIFToPDF(data: BalanceSheetNIIFData, date: string): void {
  const doc = new jsPDF();
  let startY = addReportHeader(doc, { title: 'Balance General (NIIF)', date: `Al: ${date}` });

  const body: any[] = [
    [{ content: 'ACTIVOS CORRIENTES', colSpan: 3, styles: { fillColor: [200, 220, 255], fontStyle: 'bold' } }],
    ...data.activosCorrientes.map(a => [a.id, a.name, fmt(a.balance)]),
    ['', { content: 'Subtotal Corrientes', styles: { fontStyle: 'bold' } }, { content: fmt(data.totalActivosCorrientes), styles: { fontStyle: 'bold' } }],
    [{ content: 'ACTIVOS NO CORRIENTES', colSpan: 3, styles: { fillColor: [200, 200, 240], fontStyle: 'bold' } }],
    ...data.activosNoCorrientes.map(a => [a.id, a.name, fmt(a.balance)]),
    ['', { content: 'Subtotal No Corrientes', styles: { fontStyle: 'bold' } }, { content: fmt(data.totalActivosNoCorrientes), styles: { fontStyle: 'bold' } }],
    [{ content: 'TOTAL ACTIVOS', colSpan: 2, styles: { fillColor: [150, 200, 255], fontStyle: 'bold' } }, { content: fmt(data.totalActivo), styles: { fillColor: [150, 200, 255], fontStyle: 'bold' } }],
    [{ content: 'PASIVOS CORRIENTES', colSpan: 3, styles: { fillColor: [255, 230, 200], fontStyle: 'bold' } }],
    ...data.pasivosCorrientes.map(p => [p.id, p.name, fmt(p.balance)]),
    [{ content: 'PASIVOS NO CORRIENTES', colSpan: 3, styles: { fillColor: [255, 220, 180], fontStyle: 'bold' } }],
    ...data.pasivosNoCorrientes.map(p => [p.id, p.name, fmt(p.balance)]),
    ['', { content: 'Total Pasivos', styles: { fontStyle: 'bold' } }, { content: fmt(data.totalPasivo), styles: { fontStyle: 'bold' } }],
    [{ content: 'PATRIMONIO', colSpan: 3, styles: { fillColor: [230, 200, 240], fontStyle: 'bold' } }],
    ...data.patrimonioDetalle.map(p => [p.id, p.name, fmt(p.balance)]),
    ['—', 'Resultado del Ejercicio', fmt(data.utilidadAcumulada)],
    ['', { content: 'Total Patrimonio', styles: { fontStyle: 'bold' } }, { content: fmt(data.totalPatrimonio), styles: { fontStyle: 'bold' } }],
    [{ content: 'TOTAL PASIVO + PATRIMONIO', colSpan: 2, styles: { fillColor: [200, 200, 200], fontStyle: 'bold' } }, { content: fmt(data.totalPasivo + data.totalPatrimonio), styles: { fillColor: [200, 200, 200], fontStyle: 'bold' } }],
  ];

  autoTable(doc, { startY, head: [['Código', 'Cuenta', 'Saldo']], body, styles: { fontSize: 9 }, headStyles: { fillColor: [66, 66, 66] }, columnStyles: { 0: { cellWidth: 25 }, 2: { halign: 'right' } } });

  // @ts-ignore
  startY = doc.lastAutoTable.finalY + 10;
  autoTable(doc, { startY, body: [
    ['Razón Corriente', data.razonCorriente !== null ? `${data.razonCorriente.toFixed(2)}x` : 'N/A'],
    ['Razón Endeudamiento', `${data.razonEndeudamiento.toFixed(1)}%`],
    ['Capital de Trabajo', fmt(data.capitalTrabajo)],
  ], head: [['Indicador', 'Valor']], styles: { fontSize: 10 }, headStyles: { fillColor: [100, 100, 100] }, columnStyles: { 1: { halign: 'right' } } });

  addFooter(doc);
  doc.save(`balance-general-niif-${date}.pdf`);
}

export interface CashFlowNIIFData {
  initialCashBalance: number;
  operacionDetalle: Array<{ id: string; name: string; amount: number }>;
  flujoOperacion: number;
  inversionDetalle: Array<{ id: string; name: string; amount: number }>;
  flujoInversion: number;
  financiacionDetalle: Array<{ id: string; name: string; amount: number }>;
  flujoFinanciacion: number;
  flujoNeto: number;
  finalCashBalance: number;
  ratioCobertura: number | null;
}

export function exportCashFlowNIIFToPDF(data: CashFlowNIIFData, period: string): void {
  const doc = new jsPDF();
  let startY = addReportHeader(doc, { title: 'Estado de Flujo de Efectivo (NIC 7)', period: `Período: ${period}` });

  autoTable(doc, { startY, body: [['SALDO INICIAL DE EFECTIVO', fmt(data.initialCashBalance)]], styles: { fontSize: 11, fontStyle: 'bold' }, bodyStyles: { fillColor: [230, 230, 230] }, columnStyles: { 1: { halign: 'right' } } });
  // @ts-ignore
  startY = doc.lastAutoTable.finalY + 6;

  const sections = [
    { title: 'ACTIVIDADES DE OPERACIÓN', items: data.operacionDetalle, total: data.flujoOperacion, color: [33, 150, 243] },
    { title: 'ACTIVIDADES DE INVERSIÓN', items: data.inversionDetalle, total: data.flujoInversion, color: [156, 39, 176] },
    { title: 'ACTIVIDADES DE FINANCIACIÓN', items: data.financiacionDetalle, total: data.flujoFinanciacion, color: [255, 152, 0] },
  ];

  for (const sec of sections) {
    if (sec.items.length > 0) {
      autoTable(doc, { startY, head: [[sec.title, '', '']], body: sec.items.map(i => [i.id, i.name, (i.amount >= 0 ? '+' : '') + fmt(i.amount)]),
        foot: [['', 'Flujo Neto', (sec.total >= 0 ? '+' : '') + fmt(sec.total)]], styles: { fontSize: 9 }, headStyles: { fillColor: sec.color as [number, number, number] },
        footStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: 'bold' }, columnStyles: { 0: { cellWidth: 25 }, 2: { halign: 'right' } } });
      // @ts-ignore
      startY = doc.lastAutoTable.finalY + 6;
    }
  }

  autoTable(doc, { startY, body: [['VARIACIÓN NETA DE EFECTIVO', (data.flujoNeto >= 0 ? '+' : '') + fmt(data.flujoNeto)], ['SALDO FINAL DE EFECTIVO', fmt(data.finalCashBalance)]],
    styles: { fontSize: 11, fontStyle: 'bold' }, bodyStyles: { fillColor: [200, 220, 255] }, columnStyles: { 1: { halign: 'right' } } });

  if (data.ratioCobertura !== null) {
    // @ts-ignore
    startY = doc.lastAutoTable.finalY + 8;
    autoTable(doc, { startY, body: [['Ratio de Cobertura de Efectivo', `${data.ratioCobertura.toFixed(2)}x`]], head: [['Indicador', 'Valor']], styles: { fontSize: 10 }, headStyles: { fillColor: [100, 100, 100] }, columnStyles: { 1: { halign: 'right' } } });
  }

  addFooter(doc);
  doc.save(`flujo-efectivo-nic7-${period.replace(/\s/g, '-')}.pdf`);
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
