// Legacy source manifest. Full source is preserved in the production migration package.
// Original Apps Script configuration: spreadsheet, Drive, departments, auth and shared helpers.
// Target Vercel runtime uses Next.js + Supabase; this directory is retained for parity/audit.
const MIGRATION_TARGET = Object.freeze({
  runtime: 'Next.js/Vercel',
  database: 'Supabase',
  defaultPassword: '@123456@',
  departments: ['VỆ SINH MÔI TRƯỜNG','ĐỒ VẢI','GIÁM SÁT','DỤNG CỤ','VI PHẠM CHUNG']
});
