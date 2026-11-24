// Regression checks for the automatic responsive reminder list.
// Run without browser access so the PR always checks the basic layout contract.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const css = fs.readFileSync('app/task.css','utf8');
const source = fs.readFileSync('app/LegacyDashboard.tsx','utf8');
assert.match(source,/className="reminder-table-scroll"/,'Reminder list should use its scroll container');
assert.match(source,/className="reminder-table"/,'Reminder list table must retain its accessible data layout');
assert.match(source,/data-label="Nhắc việc \/ Nội dung"/,'Compact layout must retain item label');
const start = css.indexOf('/* Adaptive reminder list: automatic viewport layout');
assert.ok(start > -1,'Adaptive responsive styles are missing');
const adaptive = css.slice(start);
assert.match(adaptive,/@media\(max-width:1100px\)/,'Tablet landscape breakpoint');
assert.match(adaptive,/@media\(max-width:820px\)/,'Tablet portrait breakpoint');
assert.match(adaptive,/@media\(max-width:480px\)/,'Phone breakpoint');
assert.match(adaptive,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/,'Two-column tablet layout');
assert.match(adaptive,/grid-template-columns:minmax\(0,1fr\)/,'Single-column narrow layout');
assert.match(adaptive,/\.reminder-table thead\{display:none\}/,'Card layout must hide redundant table header');
assert.match(adaptive,/\.reminder-table td::before\{content:attr\(data-label\)/,'Card labels must remain visible');
assert.match(adaptive,/\.reminder-workspace-fullscreen \.reminder-table\{min-width:0!important\}/,'Fullscreen must avoid fixed-width overflow');
assert.doesNotMatch(source,/Chọn giao diện thiết bị|deviceMode|setDeviceMode/,'Layout should not require a device selector');
assert.match(adaptive,/\.reminder-workspace\{container-type:inline-size\}/,'Use actual workspace width, not just viewport');
assert.match(adaptive,/@container \(max-width:980px\)/,'Narrow desktop pane should adapt automatically');
assert.match(adaptive,/@container \(max-width:700px\)/,'Narrow tablet workspace should show one column');
console.log('Responsive reminder layout contracts passed');
