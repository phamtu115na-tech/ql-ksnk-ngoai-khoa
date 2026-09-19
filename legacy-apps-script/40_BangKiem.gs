// Checklist legacy source is maintained from the authoritative Apps Script upload.
// The audited repair for SỬA PHIẾU GIÁM SÁT is tracked in:
//   patches/40_BangKiem_sua_phieu_fix.patch
//
// Important production fixes in that patch:
// - use ScriptLock instead of DocumentLock for standalone Web App writes;
// - preserve existing criterion IDs when editing;
// - mark removed criteria as "Tạm ngưng" instead of deleting them;
// - keep PHIEU_GIAMSAT / CT_PHIEU_GIAMSAT history intact;
// - initialize checklist percent configuration before V19 editor loads.
//
// Full corrected source is available in the generated deployment package and
// should replace 40_BangKiem.gs in the Apps Script project before redeploying /exec.
