export interface CsvColumn<Row> {
  header: string;
  value: (row: Row) => unknown;
}

const NEEDS_QUOTES = /[",\r\n]/;

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "string" ? value : String(value);
  return NEEDS_QUOTES.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv<Row>(columns: readonly CsvColumn<Row>[], rows: readonly Row[]): string {
  const header = columns.map((column) => csvCell(column.header)).join(",");
  const body = rows.map((row) => columns.map((column) => csvCell(column.value(row))).join(","));
  return [header, ...body].join("\n") + "\n";
}

export function fieldColumns<Row extends object>(fields: readonly (keyof Row & string)[]): CsvColumn<Row>[] {
  return fields.map((field) => ({ header: field, value: (row: Row) => row[field] }));
}
