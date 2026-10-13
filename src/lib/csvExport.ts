/**
 * src/lib/csvExport.ts
 *
 * Secure CSV generation and client-side file download utility.
 * Protects against CSV / Spreadsheet formula injection (CWE-1236).
 */

/**
 * Sanitizes a cell value against CSV formula injection.
 * If the value starts with dangerous formula prefixes (=, +, -, @, \t, \r),
 * it prepends a single quote (') so spreadsheets treat it strictly as text.
 * Escapes quotes and wraps cells containing commas, quotes, or line breaks in quotes.
 */
export function sanitizeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return '';
  let str = String(val);

  // Check for formula injection prefix (including after leading whitespace)
  const trimmed = str.trimStart();
  const firstChar = trimmed.charAt(0);
  if (['=', '+', '-', '@', '\t', '\r'].includes(firstChar)) {
    str = `'${str}`;
  }

  // If string contains quotes, commas, or newlines, escape inner quotes and wrap in quotes
  if (
    str.includes('"') ||
    str.includes(',') ||
    str.includes('\n') ||
    str.includes('\r')
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Converts array of headers and rows into RFC 4180 compliant CSV string.
 */
export function generateCsvString(
  headers: string[],
  rows: (string | number | null | undefined)[][]
): string {
  const headerLine = headers.map(sanitizeCsvCell).join(',');
  const rowLines = rows.map((row) => row.map(sanitizeCsvCell).join(','));
  return [headerLine, ...rowLines].join('\r\n');
}

/**
 * Initiates a browser download of the generated CSV file.
 * Prepends UTF-8 BOM so Excel and spreadsheet tools correctly decode characters.
 */
export function downloadCsvFile(filename: string, csvContent: string): void {
  const blob = new Blob(['\uFEFF' + csvContent], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
