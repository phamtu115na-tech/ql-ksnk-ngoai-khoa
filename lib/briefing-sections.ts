export const sectionTitles={overview:'Tổng quan',tasks:'Công việc và tiến độ',content:'Ma trận theo tiêu chí',staff:'Ma trận theo nhân viên',errors:'Lỗi thường quy và vi phạm',issues:'Tồn tại cần xử lý',next:'Kế hoạch kỳ tới',opinions:'Ý kiến và kiến nghị'}
export type SectionKey=keyof typeof sectionTitles
export type Section={title:string;columns:string[];rows:(number|string|null)[][]}
