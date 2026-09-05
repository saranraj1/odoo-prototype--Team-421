import { jsPDF } from 'jspdf';
import { formatMoney } from '@/lib/format';

export interface ReportColumnConfig {
  key: string;
  header: string;
  align?: 'left' | 'center' | 'right';
  width?: number;
}

export interface ExportReportOptions {
  title: string;
  subtitle: string;
  tabKey: string;
  columns: ReportColumnConfig[];
  data: Record<string, any>[];
  filters: {
    period: string;
    team: string;
    approvalStatus: string;
    productFilter: string;
  };
  kpis?: { title: string; value: string; caption?: string }[];
}

/**
 * Generate and trigger download of a publication-ready PDF report
 */
export function exportReportToPdf(options: ExportReportOptions): Blob {
  const { title, subtitle, tabKey, columns, data, filters, kpis } = options;

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 297;
  const pageHeight = 210;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // 1. Top Header Banner (Slate 900)
  doc.setFillColor(15, 23, 42); // #0F172A
  doc.rect(0, 0, pageWidth, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('DealFlow360  |  COMMERCIAL GOVERNANCE & BI ANALYTICS', margin, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  const nowStr = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  doc.text(`Generated: ${nowStr}  |  Report Classification: AUDIT READY`, margin, 18);

  // 2. Report Title & Subtitle
  let cursorY = 32;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(title, margin, cursorY);

  cursorY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(subtitle, margin, cursorY);

  // 3. Filter Parameters Strip
  cursorY += 6;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(margin, cursorY, contentWidth, 8, 'FD');

  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  const filterText = `FILTERS APPLIED:  Period: [${filters.period.toUpperCase()}]  |  Sales Team: [${
    filters.team === 'all' ? 'ALL TEAMS' : filters.team === '1' ? 'NORTH TEAM' : 'SOUTH TEAM'
  }]  |  Approval Status: [${filters.approvalStatus.toUpperCase()}]  |  Product/Search: [${
    filters.productFilter ? filters.productFilter : 'NONE'
  }]  |  Records: ${data.length}`;
  doc.text(filterText, margin + 4, cursorY + 5.5);

  cursorY += 12;

  // 4. KPI Summary Cards (if provided)
  if (kpis && kpis.length > 0) {
    const kpiCount = kpis.length;
    const cardWidth = (contentWidth - (kpiCount - 1) * 6) / kpiCount;
    const cardHeight = 16;

    kpis.forEach((kpi, idx) => {
      const cardX = margin + idx * (cardWidth + 6);
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(203, 213, 225);
      doc.rect(cardX, cursorY, cardWidth, cardHeight, 'FD');

      // Decorative top accent line
      doc.setFillColor(2, 132, 199); // Sky 600
      doc.rect(cardX, cursorY, cardWidth, 1.5, 'F');

      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text(kpi.title.toUpperCase(), cardX + 3, cursorY + 6);

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(kpi.value, cardX + 3, cursorY + 12);
    });

    cursorY += cardHeight + 6;
  }

  // 5. Data Table
  const colCount = columns.length;
  const baseColWidth = contentWidth / colCount;
  const colWidths = columns.map((c) => c.width || baseColWidth);
  const totalCustomWidth = colWidths.reduce((a, b) => a + b, 0);
  const scale = contentWidth / totalCustomWidth;
  const scaledWidths = colWidths.map((w) => w * scale);

  // Table Header
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, cursorY, contentWidth, 7, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, cursorY + 7, margin + contentWidth, cursorY + 7);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);

  let curX = margin;
  columns.forEach((col, idx) => {
    const w = scaledWidths[idx];
    const align = col.align || 'left';
    const textX = align === 'right' ? curX + w - 3 : align === 'center' ? curX + w / 2 : curX + 3;
    doc.text(col.header, textX, cursorY + 5, { align });
    curX += w;
  });

  cursorY += 8;

  // Table Rows
  doc.setFontSize(7.5);
  const rowHeight = 6.2;
  const maxRowsPerPage = Math.floor((pageHeight - cursorY - 14) / rowHeight);

  data.slice(0, maxRowsPerPage).forEach((row, rowIdx) => {
    // Alternating shading
    if (rowIdx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, cursorY, contentWidth, rowHeight, 'F');
    }

    // Row bottom divider
    doc.setDrawColor(241, 245, 249);
    doc.line(margin, cursorY + rowHeight, margin + contentWidth, cursorY + rowHeight);

    let cellX = margin;
    columns.forEach((col, colIdx) => {
      const w = scaledWidths[colIdx];
      const align = col.align || 'left';
      const rawVal = row[col.key];

      let displayVal = '—';
      if (rawVal !== undefined && rawVal !== null) {
        if (typeof rawVal === 'number') {
          displayVal = col.key.includes('amount') || col.key.includes('price') || col.key.includes('total') || col.key.includes('list') || col.key.includes('cost')
            ? formatMoney(rawVal)
            : String(rawVal);
        } else {
          displayVal = String(rawVal);
        }
      }

      // Truncate if too long for column
      const maxChars = Math.floor(w / 2);
      if (displayVal.length > maxChars && maxChars > 3) {
        displayVal = displayVal.substring(0, maxChars - 2) + '…';
      }

      // Format colors for specific columns (risk, variance, status)
      if (col.key === 'risk' || col.key === 'risk_score') {
        const num = parseFloat(String(rawVal));
        if (num >= 50) doc.setTextColor(220, 38, 38);
        else if (num >= 25) doc.setTextColor(217, 119, 6);
        else doc.setTextColor(22, 163, 74);
        doc.setFont('helvetica', 'bold');
      } else if (col.key === 'status' || col.key === 'compliance') {
        const s = String(rawVal).toLowerCase();
        if (s.includes('violat') || s.includes('reject') || s.includes('overdue')) {
          doc.setTextColor(220, 38, 38);
          doc.setFont('helvetica', 'bold');
        } else if (s.includes('approv') || s.includes('within') || s.includes('paid')) {
          doc.setTextColor(22, 163, 74);
          doc.setFont('helvetica', 'bold');
        } else {
          doc.setTextColor(71, 85, 105);
          doc.setFont('helvetica', 'normal');
        }
      } else if (col.key === 'variance') {
        const s = String(rawVal);
        if (s.startsWith('+')) {
          doc.setTextColor(220, 38, 38);
          doc.setFont('helvetica', 'bold');
        } else {
          doc.setTextColor(22, 163, 74);
          doc.setFont('helvetica', 'normal');
        }
      } else {
        doc.setTextColor(30, 41, 59);
        doc.setFont('helvetica', colIdx === 0 ? 'bold' : 'normal');
      }

      const textX = align === 'right' ? cellX + w - 3 : align === 'center' ? cellX + w / 2 : cellX + 3;
      doc.text(displayVal, textX, cursorY + 4.2, { align });
      cellX += w;
    });

    cursorY += rowHeight;
  });

  if (data.length === 0) {
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'italic');
    doc.text('No matching records found for active filters.', pageWidth / 2, cursorY + 8, { align: 'center' });
  }

  // 6. Footer
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text(
    'DealFlow360 Executive Intelligence System  •  Deterministic Commercial Governance  •  Confidential',
    margin,
    pageHeight - 6
  );
  doc.text(
    `Page 1 of 1  |  Downloaded: ${new Date().toISOString().split('T')[0]}`,
    pageWidth - margin,
    pageHeight - 6,
    { align: 'right' }
  );

  const filename = `dealflow_${tabKey}_report_${Date.now()}.pdf`;
  doc.save(filename);
  return doc.output('blob');
}

/**
 * Generate and trigger download of an Excel-compatible spreadsheet (.xls)
 */
export function exportReportToXls(options: ExportReportOptions): void {
  const { title, subtitle, tabKey, columns, data, filters } = options;

  let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8" />
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>${tabKey.toUpperCase()} Report</x:Name>
              <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <style>
        body { font-family: Calibri, Arial, sans-serif; }
        .title { font-size: 16pt; font-weight: bold; color: #0F172A; }
        .subtitle { font-size: 10pt; color: #64748B; margin-bottom: 8px; }
        .filter-box { background-color: #F8FAFC; border: 1px solid #E2E8F0; font-size: 9pt; color: #475569; padding: 4px; }
        th { background-color: #0F172A; color: #FFFFFF; font-size: 10pt; font-weight: bold; text-align: left; padding: 6px; border: 1px solid #334155; }
        td { font-size: 9.5pt; color: #1E293B; padding: 5px; border: 1px solid #E2E8F0; }
        .num { text-align: right; }
        .center { text-align: center; }
        .alert { color: #DC2626; font-weight: bold; }
        .success { color: #16A34A; font-weight: bold; }
      </style>
    </head>
    <body>
      <table>
        <tr>
          <td colspan="${columns.length}" class="title">${title}</td>
        </tr>
        <tr>
          <td colspan="${columns.length}" class="subtitle">${subtitle}</td>
        </tr>
        <tr>
          <td colspan="${columns.length}" class="filter-box">
            Period: ${filters.period.toUpperCase()} | Team: ${filters.team} | Status: ${filters.approvalStatus} | Filter: ${filters.productFilter || 'All'} | Exported: ${new Date().toLocaleString()}
          </td>
        </tr>
        <tr></tr>
        <thead>
          <tr>
            ${columns.map((col) => `<th>${col.header}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${data
            .map((row) => {
              return `<tr>
                ${columns
                  .map((col) => {
                    const val = row[col.key] ?? '';
                    const align = col.align || 'left';
                    const isNum = typeof val === 'number';
                    const isRisk = col.key === 'risk' || col.key === 'risk_score';
                    const isAlert = String(val).toLowerCase().includes('violat') || (isRisk && Number(val) > 40);
                    const isSuccess = String(val).toLowerCase().includes('within') || String(val).toLowerCase().includes('approved');
                    
                    const cls = [
                      align === 'right' ? 'num' : align === 'center' ? 'center' : '',
                      isAlert ? 'alert' : isSuccess ? 'success' : '',
                    ].filter(Boolean).join(' ');

                    const displayVal = typeof val === 'number' && (col.key.includes('amount') || col.key.includes('price') || col.key.includes('total') || col.key.includes('list') || col.key.includes('cost'))
                      ? formatMoney(val)
                      : String(val);

                    return `<td class="${cls}">${displayVal}</td>`;
                  })
                  .join('')}
              </tr>`;
            })
            .join('')}
        </tbody>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dealflow_${tabKey}_report_${Date.now()}.xls`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
