export type LeavePlanningStaff = Record<string, any>;

export type LeavePlanningDepartment = {
  department: string;
  activeEmployees: number;
  employeesWithLeaveRemaining: number;
  employeesUsedUp: number;
  totalEntitlement: number;
  totalTaken: number;
  remainingDays: number;
  monthsRemaining: number;
  minimumEmployeesPerMonth: number;
  averageEmployeesPerMonth: number;
  averageDaysPerMonth: number;
  referenceCapacityDays: number;
  pressureRatio: number;
  warningLevel: 'CAO' | 'CẦN LẬP KẾ HOẠCH' | 'TRONG GIỚI HẠN';
  warningMessage: string;
  staff: Array<{
    id: string;
    name: string;
    leaveRemaining: number;
  }>;
};

export type LeavePlanningResult = {
  year: number;
  currentMonth: number;
  currentMonthLabel: string;
  monthsRemaining: number;
  referenceDaysPerEmployeePerMonth: number;
  departments: LeavePlanningDepartment[];
  summary: {
    activeEmployees: number;
    employeesWithLeaveRemaining: number;
    employeesUsedUp: number;
    annualLeave: number;
    taken: number;
    remaining: number;
    averageDaysPerMonth: number;
    departmentsNeedingPlan: number;
    highPriorityDepartments: number;
  };
};

const INACTIVE_STATUS_WORDS = [
  'tam nghi',
  'da nghi viec',
  'nghi viec',
  'ngung lam',
  'khong lam viec',
  'inactive',
  'off'
];

function text(value: unknown) {
  return value == null ? '' : String(value).trim();
}

function norm(value: unknown) {
  return text(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/\s+/g, ' ');
}

function num(value: unknown) {
  const result = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(result) ? result : 0;
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

export function isActiveLeaveStaff(row: LeavePlanningStaff) {
  const status = norm(row.status);
  return !status || !INACTIVE_STATUS_WORDS.some(word => status.includes(word));
}

export function buildLeavePlanning(
  staff: LeavePlanningStaff[],
  departmentOptions: string[] = [],
  now = new Date()
): LeavePlanningResult {
  const year = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const monthsRemaining = 12 - currentMonth + 1;
  const currentMonthLabel = `${year}-${String(currentMonth).padStart(2, '0')}`;
  const referenceDaysPerEmployeePerMonth = 1;
  const activeStaff = staff.filter(isActiveLeaveStaff);
  const groups = new Map<string, { department: string; staff: LeavePlanningStaff[] }>();

  for (const department of departmentOptions.filter(Boolean)) {
    groups.set(norm(department), {department, staff: []});
  }
  for (const row of activeStaff) {
    const department = text(row.department) || 'CHƯA XÁC ĐỊNH';
    const key = norm(department);
    const group = groups.get(key) || {department, staff: []};
    group.staff.push(row);
    groups.set(key, group);
  }

  const departments = [...groups.values()].map(group => {
    const employees = group.staff;
    const activeEmployees = employees.length;
    const staffRows = employees.map(row => ({
      id: text(row.id),
      name: text(row.name) || 'Chưa có tên',
      leaveRemaining: Math.max(0, num(row.leaveRemaining))
    })).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    const totalEntitlement = employees.reduce((sum, row) => sum + Math.max(0, num(row.annualLeaveEntitlement)), 0);
    const totalTaken = employees.reduce((sum, row) => sum + Math.max(0, num(row.leaveTaken)), 0);
    const remainingDays = staffRows.reduce((sum, row) => sum + row.leaveRemaining, 0);
    const employeesWithLeaveRemaining = staffRows.filter(row => row.leaveRemaining > 0).length;
    const employeesUsedUp = employees.filter(row => num(row.annualLeaveEntitlement) > 0 && num(row.leaveRemaining) <= 0).length;
    const minimumEmployeesPerMonth = Math.ceil(employeesWithLeaveRemaining / monthsRemaining);
    const averageEmployeesPerMonth = round1(employeesWithLeaveRemaining / monthsRemaining);
    const averageDaysPerMonth = round1(remainingDays / monthsRemaining);
    const referenceCapacityDays = activeEmployees * monthsRemaining * referenceDaysPerEmployeePerMonth;
    const pressureRatio = referenceCapacityDays > 0 ? round1(remainingDays / referenceCapacityDays) : remainingDays > 0 ? 99 : 0;
    const warningLevel: LeavePlanningDepartment['warningLevel'] = remainingDays > referenceCapacityDays * 2
      ? 'CAO'
      : remainingDays > referenceCapacityDays
        ? 'CẦN LẬP KẾ HOẠCH'
        : 'TRONG GIỚI HẠN';
    const warningMessage = remainingDays <= 0
      ? 'Không còn ngày phép cần bố trí.'
      : warningLevel === 'CAO'
        ? `Còn ${remainingDays} ngày phép; cần ưu tiên bố trí khoảng ${averageDaysPerMonth} ngày/tháng.`
        : warningLevel === 'CẦN LẬP KẾ HOẠCH'
          ? `Còn ${remainingDays} ngày phép; nên lập lịch sớm, bình quân ${averageDaysPerMonth} ngày/tháng.`
          : `Còn ${remainingDays} ngày phép; bình quân ${averageDaysPerMonth} ngày/tháng trong giới hạn tham chiếu.`;

    return {
      department: group.department,
      activeEmployees,
      employeesWithLeaveRemaining,
      employeesUsedUp,
      totalEntitlement: round1(totalEntitlement),
      totalTaken: round1(totalTaken),
      remainingDays: round1(remainingDays),
      monthsRemaining,
      minimumEmployeesPerMonth,
      averageEmployeesPerMonth,
      averageDaysPerMonth,
      referenceCapacityDays,
      pressureRatio,
      warningLevel,
      warningMessage,
      staff: staffRows
    };
  }).sort((a, b) => b.remainingDays - a.remainingDays || a.department.localeCompare(b.department, 'vi'));

  const remaining = departments.reduce((sum, row) => sum + row.remainingDays, 0);
  const annualLeave = departments.reduce((sum, row) => sum + row.totalEntitlement, 0);
  const taken = departments.reduce((sum, row) => sum + row.totalTaken, 0);
  const employeesWithLeaveRemaining = departments.reduce((sum, row) => sum + row.employeesWithLeaveRemaining, 0);
  const employeesUsedUp = departments.reduce((sum, row) => sum + row.employeesUsedUp, 0);
  const activeEmployees = departments.reduce((sum, row) => sum + row.activeEmployees, 0);

  return {
    year,
    currentMonth,
    currentMonthLabel,
    monthsRemaining,
    referenceDaysPerEmployeePerMonth,
    departments,
    summary: {
      activeEmployees,
      employeesWithLeaveRemaining,
      employeesUsedUp,
      annualLeave: round1(annualLeave),
      taken: round1(taken),
      remaining: round1(remaining),
      averageDaysPerMonth: round1(remaining / monthsRemaining),
      departmentsNeedingPlan: departments.filter(row => row.remainingDays > 0).length,
      highPriorityDepartments: departments.filter(row => row.warningLevel === 'CAO').length
    }
  };
}
