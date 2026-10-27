import ExcelJS from 'exceljs';
import { parseDateOnlyUtc } from './workLog.js';

export const EXPORT_MAX_ROWS = 50000;

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/**
 * Neutralizes Excel / CSV formula injection on text cells.
 * Any cell value that:
 * 1. Starts with tab (\t), carriage return (\r), newline (\n), OR
 * 2. Directly starts with =, +, -, or @, OR
 * 3. Starts with whitespace followed by =, +, -, or @
 * will have a single quote (') prepended.
 *
 * Leaves null, undefined, numbers, and dates untouched.
 */
export function sanitizeExcelCellText(val: unknown): unknown {
  if (val === null || val === undefined) return val;
  if (typeof val !== 'string') return val;

  const str = String(val);
  if (/^[\t\r\n]/.test(str) || /^\s*[=+\-@]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

/**
 * Formats a Date object into 'YYYY-MM-DD HH:mm' in Asia/Kathmandu timezone.
 */
export function formatKathmanduDateTime(d: Date | null | undefined): string {
  if (!d) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kathmandu',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(new Date(d))
    .replace(',', '');
}

/**
 * HOOK: Project manager access to project members.
 * Projects do not exist yet. Empty stub returning false.
 */
export function checkProjectManagerMembership(
  _pmProfileId: string,
  _targetProfileId: string,
): boolean {
  return false;
}

export interface ExportEntryData {
  id: string;
  hours: number;
  description: string | null;
  projectId: string | null;
  taskId: string | null;
  workRole: {
    id: string;
    name: string;
  };
  workLogDay: {
    id: string;
    date: Date;
    status: string;
    submittedAt: Date | null;
    employeeProfile: {
      id: string;
      employeeCode: string;
      department: string | null;
      user: {
        id: string;
        displayName: string;
        username: string;
      };
    };
  };
}

export interface BuildWorkbookOptions {
  scope: 'own' | 'organisation';
  actorName: string;
  filters: {
    startDate: string;
    endDate: string;
    status?: string;
    employee?: string;
    team?: string;
    workRoleId?: string;
    projectId?: string;
  };
  entries: ExportEntryData[];
}

/**
 * Builds the complete ExcelJS Workbook with two sheets:
 * Sheet 1: "Summary"
 * Sheet 2: "Entries"
 */
export async function buildWorkLogExcelWorkbook(
  options: BuildWorkbookOptions,
): Promise<ExcelJS.Workbook> {
  const { scope, actorName, filters, entries } = options;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'IMAC Operations System';
  wb.created = new Date();

  // ---------------------------------------------------------------------------
  // SHEET 1: Summary
  // ---------------------------------------------------------------------------
  const wsSummary = wb.addWorksheet('Summary');

  wsSummary.columns = [
    { width: 32 },
    { width: 22 },
    { width: 24 },
    { width: 18 },
  ];

  // Title Block
  const titleRow = wsSummary.addRow(['IMAC Nepal - Daily Work Log Export Summary']);
  titleRow.font = { bold: true, size: 14, color: { argb: 'FF1E293B' } };

  wsSummary.addRow(['Time Zone: Asia/Kathmandu (UTC+05:45)']);
  wsSummary.addRow([`Generated At: ${formatKathmanduDateTime(new Date())} (Asia/Kathmandu)`]);
  wsSummary.addRow([`Requested By: ${sanitizeExcelCellText(actorName)}`]);
  wsSummary.addRow([`Scope: ${scope === 'organisation' ? 'Organisation-wide' : 'Own Records'}`]);

  const activeFilters = [
    `Date Range: ${filters.startDate} to ${filters.endDate}`,
    filters.status ? `Status: ${filters.status}` : null,
    filters.team ? `Team/Dept: ${filters.team}` : null,
    filters.workRoleId ? `Work Role ID: ${filters.workRoleId}` : null,
    filters.projectId ? `Project ID: ${filters.projectId}` : null,
    filters.employee ? `Employee Profile ID: ${filters.employee}` : null,
  ]
    .filter(Boolean)
    .join(' | ');

  wsSummary.addRow([`Applied Filters: ${activeFilters}`]);
  wsSummary.addRow([]); // Blank spacer row (Row 7)

  // 1. Totals by Employee Table
  const empHeaderRow = wsSummary.addRow([
    'Employee Name',
    'Employee Code',
    'Department',
    'Total Hours',
  ]);
  empHeaderRow.font = { bold: true };
  empHeaderRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' },
    };
  });

  // Aggregate by employee
  const empMap = new Map<
    string,
    { name: string; code: string; dept: string; hours: number }
  >();
  for (const e of entries) {
    const p = e.workLogDay.employeeProfile;
    const key = p.id;
    const existing = empMap.get(key) || {
      name: p.user.displayName,
      code: p.employeeCode,
      dept: p.department || 'Unassigned',
      hours: 0,
    };
    existing.hours = Math.round((existing.hours + e.hours) * 100) / 100;
    empMap.set(key, existing);
  }

  let totalAllHours = 0;
  for (const item of empMap.values()) {
    const row = wsSummary.addRow([
      sanitizeExcelCellText(item.name),
      sanitizeExcelCellText(item.code),
      sanitizeExcelCellText(item.dept),
      item.hours,
    ]);
    const hoursCell = row.getCell(4);
    hoursCell.numFmt = '#,##0.00';
    totalAllHours += item.hours;
  }

  const empTotalRow = wsSummary.addRow([
    'Total',
    '',
    '',
    Math.round(totalAllHours * 100) / 100,
  ]);
  empTotalRow.font = { bold: true };
  empTotalRow.getCell(4).numFmt = '#,##0.00';

  wsSummary.addRow([]); // Spacer

  // 2. Totals by Work Role Table
  const roleHeaderRow = wsSummary.addRow(['Work Role', 'Total Hours', '', '']);
  roleHeaderRow.font = { bold: true };
  roleHeaderRow.getCell(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE2E8F0' },
  };
  roleHeaderRow.getCell(2).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE2E8F0' },
  };

  const roleMap = new Map<string, number>();
  for (const e of entries) {
    const rName = e.workRole.name;
    roleMap.set(rName, Math.round(((roleMap.get(rName) || 0) + e.hours) * 100) / 100);
  }

  let roleHoursSum = 0;
  for (const [rName, hours] of roleMap.entries()) {
    const row = wsSummary.addRow([sanitizeExcelCellText(rName), hours]);
    row.getCell(2).numFmt = '#,##0.00';
    roleHoursSum += hours;
  }

  const roleTotalRow = wsSummary.addRow(['Total', Math.round(roleHoursSum * 100) / 100]);
  roleTotalRow.font = { bold: true };
  roleTotalRow.getCell(2).numFmt = '#,##0.00';

  wsSummary.addRow([]); // Spacer

  // 3. Totals by Status Table
  const statusHeaderRow = wsSummary.addRow(['Status', 'Total Hours', '', '']);
  statusHeaderRow.font = { bold: true };
  statusHeaderRow.getCell(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE2E8F0' },
  };
  statusHeaderRow.getCell(2).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE2E8F0' },
  };

  const statusOrder = ['draft', 'submitted', 'approved', 'rejected'];
  const statusMap = new Map<string, number>([
    ['draft', 0],
    ['submitted', 0],
    ['approved', 0],
    ['rejected', 0],
  ]);

  for (const e of entries) {
    const st = e.workLogDay.status;
    statusMap.set(st, Math.round(((statusMap.get(st) || 0) + e.hours) * 100) / 100);
  }

  let statusHoursSum = 0;
  for (const st of statusOrder) {
    const hours = statusMap.get(st) || 0;
    const row = wsSummary.addRow([sanitizeExcelCellText(st), hours]);
    row.getCell(2).numFmt = '#,##0.00';
    statusHoursSum += hours;
  }

  const statusTotalRow = wsSummary.addRow(['Total', Math.round(statusHoursSum * 100) / 100]);
  statusTotalRow.font = { bold: true };
  statusTotalRow.getCell(2).numFmt = '#,##0.00';

  // ---------------------------------------------------------------------------
  // SHEET 2: Entries
  // ---------------------------------------------------------------------------
  const wsEntries = wb.addWorksheet('Entries', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  wsEntries.columns = [
    { header: 'Employee Name', width: 24 },
    { header: 'Employee Code', width: 16 },
    { header: 'Department', width: 20 },
    { header: 'Date', width: 14 },
    { header: 'Weekday', width: 14 },
    { header: 'Status', width: 14 },
    { header: 'Work Role', width: 22 },
    { header: 'Hours', width: 12 },
    { header: 'Description', width: 36 },
    { header: 'Project ID', width: 18 },
    { header: 'Task ID', width: 18 },
    { header: 'Submitted At', width: 20 },
  ];

  // Style header row
  const headerRow = wsEntries.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FF0F172A' } };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' },
    };
  });

  // Populate data rows
  for (const entry of entries) {
    const day = entry.workLogDay;
    const profile = day.employeeProfile;
    const user = profile.user;

    // Real UTC date for day.date
    const rawDate = new Date(day.date);
    const dateObj = new Date(
      Date.UTC(
        rawDate.getUTCFullYear(),
        rawDate.getUTCMonth(),
        rawDate.getUTCDate(),
      ),
    );
    const weekday = WEEKDAYS[dateObj.getUTCDay()];
    const submittedAtDate = day.submittedAt ? new Date(day.submittedAt) : '';

    const row = wsEntries.addRow([
      sanitizeExcelCellText(user.displayName),
      sanitizeExcelCellText(profile.employeeCode),
      sanitizeExcelCellText(profile.department || 'Unassigned'),
      dateObj,
      weekday,
      sanitizeExcelCellText(day.status),
      sanitizeExcelCellText(entry.workRole.name),
      entry.hours,
      sanitizeExcelCellText(entry.description || ''),
      sanitizeExcelCellText(entry.projectId || ''),
      sanitizeExcelCellText(entry.taskId || ''),
      submittedAtDate,
    ]);

    // Set real Excel date format on Date column (Col 4)
    row.getCell(4).numFmt = 'yyyy-mm-dd';

    // Set real Excel number format on Hours column (Col 8)
    row.getCell(8).numFmt = '#,##0.00';

    // Set real Excel datetime format on Submitted At column (Col 12)
    if (submittedAtDate instanceof Date) {
      row.getCell(12).numFmt = 'yyyy-mm-dd hh:mm';
    }
  }

  return wb;
}
