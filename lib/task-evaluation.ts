export const TASK_EVALUATION_WARNING='Nhân viên chưa xác nhận ĐÃ HOÀN THÀNH. Vui lòng yêu cầu nhân viên chọn ĐÃ HOÀN THÀNH và lưu công việc trước khi quản lý đánh giá.';
export function employeeCompleted(status:unknown){const value=String(status||'').trim().toUpperCase();return ['ĐÃ HOÀN THÀNH','HOÀN THÀNH','ĐÃ XONG','HOÀN TẤT'].includes(value);}
export function requireEmployeeCompleted(status:unknown){if(!employeeCompleted(status))throw new Error(TASK_EVALUATION_WARNING);}
