/* FinanceTrack PDF exporter (v3.3.2)
 * Pure JavaScript PDF generator — no print dialog, no external library.
 *
 * Changelog vs previous version:
 *  - FIX: currency strings from Intl.NumberFormat contain a non-breaking
 *    space (U+00A0) between "Rp" and the digits. The old pdfSafe() stripped
 *    any non-ASCII character to "?", which turned every amount into
 *    "Rp?10.000.000". This version formats Rupiah locally (formatIDR) so the
 *    PDF never depends on locale whitespace at all, and pdfSafe() now also
 *    normalizes stray whitespace defensively.
 *  - REDESIGN: cover header band, stat cards in a grid, budget bars that
 *    mirror the web app's own progress-bar language, a ranked category
 *    breakdown with mini bars, a highlighted conclusion card, running
 *    header/footer on every page, and rounded cards via bezier corners.
 *  - Every text draw still explicitly sets its own fill color right before
 *    the BT/Tj block, so a previous colored rectangle can never make text
 *    invisible.
 */
window.FinancePDF = (() => {
  const PAGE_W = 595;
  const PAGE_H = 842;
  const MARGIN = 40;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  const RADIUS = 10;
  const K = 0.5522847498; // bezier constant for circular/rounded corners

  const COLORS = {
    navy: [0.11, 0.17, 0.30], // brighter header for better metadata readability
    navy2: [0.11, 0.16, 0.29],
    ink: [0.09, 0.11, 0.16],
    muted: [0.40, 0.45, 0.53],
    mutedLight: [0.62, 0.66, 0.73],
    line: [0.85, 0.88, 0.92],
    lineSoft: [0.93, 0.94, 0.97],
    surface: [0.98, 0.98, 0.99],
    white: [1, 1, 1],
    primary: [0.15, 0.39, 0.92],
    primaryDark: [0.09, 0.22, 0.55],
    primaryLight: [0.91, 0.95, 1.00],
    teal: [0.02, 0.52, 0.53],
    gold: [0.72, 0.53, 0.07],
    purple: [0.48, 0.29, 0.82],
    green: [0.06, 0.55, 0.32],
    greenLight: [0.90, 0.97, 0.93],
    red: [0.80, 0.15, 0.20],
    redLight: [1.00, 0.93, 0.94]
  };

  const GROUP_PALETTE = [COLORS.primary, COLORS.teal, COLORS.gold, COLORS.purple, COLORS.green, COLORS.red];
  const MONTHS_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

  // ---- text / number helpers -------------------------------------------------

  const esc = (value) => String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\r?\n/g, " ");

  // Helvetica is a standard PDF font; keep dynamic text ASCII-safe so every
  // common PDF reader renders it consistently without an embedded font.
  const pdfSafe = (value) => String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u00A0\u2000-\u200B\u202F]/g, " ") // any unicode space -> normal space
    .replace(/[–—−]/g, "-")
    .replace(/[·•]/g, "-")
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/ {2,}/g, " ");

  const formatIDR = (v) => {
    const n = Math.round(Number(v) || 0);
    const neg = n < 0;
    const digits = Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `${neg ? "-" : ""}Rp ${digits}`;
  };

  const formatDateID = (d) => `${d.getDate()} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const formatDateOnlyID = (value) => { const d = new Date(`${value}T00:00:00`); return `${String(d.getDate()).padStart(2,"0")} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`; };

  const textWidth = (text, size, bold = false) => pdfSafe(text).length * size * (bold ? 0.62 : 0.52);

  const wrapText = (value, maxChars) => {
    const words = pdfSafe(value).trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [""];
    const lines = [];
    let line = "";
    words.forEach(word => {
      const candidate = line ? `${line} ${word}` : word;
      if (candidate.length > maxChars && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    });
    if (line) lines.push(line);
    return lines;
  };

  const fmtColor = (c, mode = "rg") => `${c[0]} ${c[1]} ${c[2]} ${mode}`;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  // Truncates text with an ellipsis so it never exceeds maxWidth (in points)
  // at the given size/weight. Used anywhere user-entered text (app name,
  // user name, category/group titles) sits next to a fixed-position element.
  const truncateToWidth = (text, size, bold, maxWidth) => {
    let t = pdfSafe(text);
    if (textWidth(t, size, bold) <= maxWidth) return t;
    while (t.length > 1 && textWidth(t + "...", size, bold) > maxWidth) t = t.slice(0, -1);
    return t.length ? t + "..." : "...";
  };

  function buildReport(report) {
    const pages = [];
    let commands = [];
    let y = PAGE_H - MARGIN;
    let pageIsFirst = true;

    const resetInk = () => commands.push(fmtColor(COLORS.ink, "rg"));

    const startPage = () => {
      commands = [];
      pages.push(commands);
      y = PAGE_H - MARGIN;
      commands.push("1 1 1 rg 0 0 0 RG");
      if (!pageIsFirst) {
        // slim continuation header on every page after the cover
        commands.push(fmtColor(COLORS.mutedLight, "rg"));
        commands.push(`BT /F2 8.5 Tf ${MARGIN} ${y} Td (${esc((report.appName || "FinanceTrack").toUpperCase())}) Tj ET`);
        const right = `Laporan ${report.monthLabel}`;
        commands.push(fmtColor(COLORS.mutedLight, "rg"));
        commands.push(`BT /F1 8.5 Tf ${(PAGE_W - MARGIN - textWidth(right, 8.5)).toFixed(2)} ${y} Td (${esc(right)}) Tj ET`);
        y -= 10;
        commands.push(`${fmtColor(COLORS.line, "RG")} 0.6 w ${MARGIN} ${y.toFixed(2)} m ${(PAGE_W - MARGIN).toFixed(2)} ${y.toFixed(2)} l S`);
        y -= 22;
      }
      resetInk();
      pageIsFirst = false;
    };

    const ensureSpace = (height) => {
      if (y - height < MARGIN + 4) startPage();
    };

    const rect = (x, topY, w, h, fill, stroke = null, lineWidth = 0.8) => {
      if (fill) commands.push(fmtColor(fill, "rg"));
      if (stroke) commands.push(`${fmtColor(stroke, "RG")} ${lineWidth} w`);
      const op = fill && stroke ? "B" : fill ? "f" : "S";
      commands.push(`${x.toFixed(2)} ${(topY - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re ${op}`);
      resetInk();
    };

    // Rounded rectangle via cubic bezier corners. r is clamped to half the
    // smaller side so small/thin shapes never produce an invalid path.
    const roundedRect = (x, topY, w, h, r, fill, stroke = null, lineWidth = 0.8) => {
      r = Math.max(0, Math.min(r, w / 2, h / 2));
      const left = x, right = x + w, top = topY, bottom = topY - h, k = r * K;
      if (fill) commands.push(fmtColor(fill, "rg"));
      if (stroke) commands.push(`${fmtColor(stroke, "RG")} ${lineWidth} w`);
      const p = [];
      p.push(`${(left + r).toFixed(2)} ${top.toFixed(2)} m`);
      p.push(`${(right - r).toFixed(2)} ${top.toFixed(2)} l`);
      p.push(`${(right - r + k).toFixed(2)} ${top.toFixed(2)} ${right.toFixed(2)} ${(top - r + k).toFixed(2)} ${right.toFixed(2)} ${(top - r).toFixed(2)} c`);
      p.push(`${right.toFixed(2)} ${(bottom + r).toFixed(2)} l`);
      p.push(`${right.toFixed(2)} ${(bottom + r - k).toFixed(2)} ${(right - r + k).toFixed(2)} ${bottom.toFixed(2)} ${(right - r).toFixed(2)} ${bottom.toFixed(2)} c`);
      p.push(`${(left + r).toFixed(2)} ${bottom.toFixed(2)} l`);
      p.push(`${(left + r - k).toFixed(2)} ${bottom.toFixed(2)} ${left.toFixed(2)} ${(bottom + r - k).toFixed(2)} ${left.toFixed(2)} ${(bottom + r).toFixed(2)} c`);
      p.push(`${left.toFixed(2)} ${(top - r).toFixed(2)} l`);
      p.push(`${left.toFixed(2)} ${(top - r + k).toFixed(2)} ${(left + r - k).toFixed(2)} ${top.toFixed(2)} ${(left + r).toFixed(2)} ${top.toFixed(2)} c`);
      p.push("h");
      const op = fill && stroke ? "B" : fill ? "f" : "S";
      commands.push(p.join(" ") + " " + op);
      resetInk();
    };

    const hline = (x1, yy, x2, color = COLORS.line, width = 0.7) => {
      commands.push(`${fmtColor(color, "RG")} ${width} w ${x1.toFixed(2)} ${yy.toFixed(2)} m ${x2.toFixed(2)} ${yy.toFixed(2)} l S`);
      resetInk();
    };

    const addText = (value, opts = {}) => {
      const size = opts.size ?? 10;
      const bold = !!opts.bold;
      const color = opts.color ?? COLORS.ink;
      const x = opts.x ?? MARGIN;
      const align = opts.align ?? "left";
      const maxChars = opts.maxChars ?? Math.max(30, Math.floor((CONTENT_W - (x - MARGIN)) / (size * 0.50)));
      const lineHeight = opts.lineHeight ?? size + 4;
      const lines = wrapText(value, maxChars);

      if (!opts.noSpace) ensureSpace(lines.length * lineHeight);
      lines.forEach(lineText => {
        let tx = x;
        if (align === "right" && opts.rightEdge != null) tx = opts.rightEdge - textWidth(lineText, size);
        commands.push(fmtColor(color, "rg"));
        commands.push(`BT /${bold ? "F2" : "F1"} ${size} Tf ${tx.toFixed(2)} ${y.toFixed(2)} Td (${esc(lineText)}) Tj ET`);
        y -= lineHeight;
      });
      resetInk();
      return lines.length * lineHeight;
    };

    // single-line text at an explicit (x, yy) position, does not touch the cursor
    const textAt = (value, x, yy, opts = {}) => {
      const size = opts.size ?? 10, bold = !!opts.bold, color = opts.color ?? COLORS.ink;
      let tx = x;
      if (opts.align === "right") tx = x - textWidth(value, size, bold);
      else if (opts.align === "center") tx = x - textWidth(value, size, bold) / 2;
      commands.push(fmtColor(color, "rg"));
      commands.push(`BT /${bold ? "F2" : "F1"} ${size} Tf ${tx.toFixed(2)} ${yy.toFixed(2)} Td (${esc(value)}) Tj ET`);
      resetInk();
    };

    const sectionTitle = (title, subtitle) => {
      ensureSpace(30);
      rect(MARGIN, y, 3.4, 13, COLORS.primary);
      textAt(title, MARGIN + 11, y - 10.5, { size: 13.5, bold: true, color: COLORS.ink });
      y -= 20;
      if (subtitle) {
        addText(subtitle, { size: 8.5, color: COLORS.muted, maxChars: 100, lineHeight: 12 });
      }
      y -= 4;
    };

    const pill = (text, rightEdge, topY, bg, fg) => {
      const size = 9;
      const w = textWidth(text, size, true) + 24;
      const h = 20;
      roundedRect(rightEdge - w, topY, w, h, h / 2, bg);
      textAt(text, rightEdge - w / 2, topY - h / 2 - size * 0.32, { size, bold: true, color: fg, align: "center" });
      return w;
    };

    startPage();

    // ---------------- Cover / header band ----------------
    const headerH = 118;
    ensureSpace(headerH + 14);
    rect(MARGIN, y, CONTENT_W, headerH, COLORS.navy);
    rect(MARGIN, y, CONTENT_W, 4, COLORS.primary); // top accent line
    // FinanceTrack logo mark: vector recreation of assets/logo.svg.
    // It uses the brand chart/plus symbol instead of a single initial.
    const markSize = 40, markX = MARGIN + 16, markTop = y - 14;
    roundedRect(markX, markTop, markSize, markSize, 11, COLORS.primary);

    // White rising-chart motif.
    commands.push(fmtColor(COLORS.white, "RG"));
    commands.push("4.2 w 0 J 1 J");
    const lx = markX + 10, by = markTop - 29;
    commands.push(
      `${lx.toFixed(2)} ${by.toFixed(2)} m ` +
      `${(lx + 6).toFixed(2)} ${(by + 6).toFixed(2)} l ` +
      `${(lx + 12).toFixed(2)} ${(by + 1).toFixed(2)} l ` +
      `${(lx + 21).toFixed(2)} ${(by + 12).toFixed(2)} l S`
    );

    // Green plus badge, matching the brand asset.
    commands.push(fmtColor(COLORS.green, "rg"));
    commands.push(`${(markX + 29).toFixed(2)} ${(markTop - 11).toFixed(2)} 7 7 re f`);
    commands.push(fmtColor(COLORS.white, "RG"));
    commands.push("2 w");
    commands.push(`${(markX + 32.5).toFixed(2)} ${(markTop - 7.5).toFixed(2)} m ${(markX + 35.5).toFixed(2)} ${(markTop - 7.5).toFixed(2)} l S`);
    commands.push(`${(markX + 34).toFixed(2)} ${(markTop - 9).toFixed(2)} m ${(markX + 34).toFixed(2)} ${(markTop - 6).toFixed(2)} l S`);
    resetInk();

    const textX = markX + markSize + 14;
    const pillW = pill(report.status, PAGE_W - MARGIN - 14, y - 24, COLORS.primary, COLORS.white);
    const titleMaxW = PAGE_W - MARGIN - 14 - textX - pillW - 12;
    const subMaxW = PAGE_W - MARGIN - 14 - textX;
    const rawAppName = pdfSafe(report.appName || "FinanceTrack");
    const titleSize = rawAppName.length > 34 ? 13 : rawAppName.length > 24 ? 15.5 : 19;
    textAt(truncateToWidth(rawAppName, titleSize, true, titleMaxW), textX, y - 24, { size: titleSize, bold: true, color: COLORS.white });
    textAt(`Laporan Keuangan Bulanan - ${report.monthLabel}`, textX, y - 41, { size: 10.5, color: [0.90, 0.94, 1.00] });
    textAt(`Pengguna: ${truncateToWidth(report.userName, 8.5, false, subMaxW)}`, textX, y - 56, { size: 8.5, color: [0.86, 0.91, 0.99] });
    textAt(`Tanggal laporan: ${formatDateID(report.downloadedAt ? new Date(report.downloadedAt) : new Date())}`, textX, y - 70, { size: 7.6, color: [0.78, 0.85, 0.96] });

    y -= headerH + 18;

    // ---------------- Summary grid (2 x 2) ----------------
    sectionTitle("Ringkasan Keuangan");
    const summary = [
      { label: "Pemasukan / Gaji", value: report.income, accent: COLORS.primary },
      { label: "Pengeluaran Aktual", value: report.expense, accent: COLORS.gold },
      { label: "Saldo", value: report.balance, accent: report.balance < 0 ? COLORS.red : COLORS.green },
      { label: "Target Tabungan", value: report.savingTarget, accent: COLORS.teal }
    ];
    const gap = 12, cardW = (CONTENT_W - gap) / 2, cardH = 58;
    ensureSpace(cardH * 2 + gap + 6);
    const gridTop = y;
    summary.forEach((s, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const cx = MARGIN + col * (cardW + gap);
      const cy = gridTop - row * (cardH + gap);
      roundedRect(cx, cy, cardW, cardH, 9, COLORS.surface, COLORS.line, 0.7);
      rect(cx, cy, 3.2, cardH, s.accent);
      textAt(s.label.toUpperCase(), cx + 16, cy - 17, { size: 7.5, bold: true, color: COLORS.muted });
      textAt(formatIDR(s.value), cx + 16, cy - 38, { size: 14.5, bold: true, color: COLORS.ink });
    });
    y = gridTop - (cardH * 2 + gap) - 8;

    ensureSpace(16);
    hline(MARGIN, y, PAGE_W - MARGIN, COLORS.lineSoft, 0.6);
    textAt(`Saldo awal: ${formatIDR(report.openingBalance || 0)}   |   Perubahan bersih: ${formatIDR(report.monthlyNet || 0)}   |   Saldo akhir: ${formatIDR(report.balance)}`, MARGIN, y - 12, { size: 8.2, color: COLORS.muted });
    textAt(`Tabungan bersih bulan ini: ${formatIDR(report.actualSaving)}`, MARGIN, y - 24, { size: 7.8, color: COLORS.muted });
    y -= 34;

    // ---------------- Budget vs actual per group ----------------
    sectionTitle("Rencana vs Aktual per Kelompok", "Bar menunjukkan porsi aktual terhadap rencana anggaran tiap kelompok.");

    if (report.groups.length) {
      report.groups.forEach((g, i) => {
        const color = g.color || GROUP_PALETTE[i % GROUP_PALETTE.length];
        const cardHeight = 62;
        ensureSpace(cardHeight + 8);
        const top = y;
        roundedRect(MARGIN, top, CONTENT_W, cardHeight, 8, COLORS.surface, COLORS.line, 0.7);

        const pctLabel = g.pct === null ? "Belum ada rencana" : `${g.pct.toFixed(1)}% terealisasi`;
        const pctW = textWidth(pctLabel, 8.5, true);
        rect(MARGIN + 12, top - 10, 7, 7, color);
        const groupNameMaxW = CONTENT_W - 25 - pctW - 20;
        textAt(truncateToWidth(g.group, 10.5, true, groupNameMaxW), MARGIN + 25, top - 16, { size: 10.5, bold: true, color: COLORS.ink });
        textAt(pctLabel, PAGE_W - MARGIN - 12, top - 16, { size: 8.5, bold: true, color: g.pct !== null && g.pct > 100 ? COLORS.red : COLORS.muted, align: "right" });

        // progress track
        const trackX = MARGIN + 12, trackY = top - 30, trackW = CONTENT_W - 24, trackH = 8;
        roundedRect(trackX, trackY, trackW, trackH, trackH / 2, COLORS.lineSoft);
        const ratio = g.planned > 0 ? g.actual / g.planned : (g.actual > 0 ? 1 : 0);
        const fillW = Math.max(g.actual > 0 ? 8 : 0, Math.min(trackW, trackW * clamp(ratio, 0, 1)));
        if (fillW > 0) roundedRect(trackX, trackY, fillW, trackH, trackH / 2, ratio > 1 ? COLORS.red : color);

        const diffNeg = g.difference < 0;
        const detail = `Rencana ${formatIDR(g.planned)}   |   Aktual ${formatIDR(g.actual)}`;
        textAt(detail, MARGIN + 12, top - 48, { size: 8, color: COLORS.muted });
        const diffText = `${diffNeg ? "- " : "+ "}${formatIDR(Math.abs(g.difference))}`;
        textAt(diffText, PAGE_W - MARGIN - 12, top - 48, { size: 8.5, bold: true, color: diffNeg ? COLORS.red : COLORS.green, align: "right" });

        y = top - cardHeight - 8;
      });
    } else {
      addText("Belum ada kelompok pengeluaran.", { size: 9, color: COLORS.muted });
    }
    y -= 6;

    // ---------------- Planned detail ----------------
    sectionTitle("Rencana Pengeluaran Terperinci", "Rencana dihitung dari anggaran yang ditetapkan pada setiap sub-kategori.");
    const plannedDetails = Array.isArray(report.plannedDetails) ? report.plannedDetails : [];
    if (plannedDetails.length) {
      const rowH = 22;
      const cols = [MARGIN + 8, MARGIN + 278, MARGIN + 368, PAGE_W - MARGIN - 8];
      textAt("Kelompok / Sub-kategori", cols[0], y - 12, { size: 7.2, bold: true, color: COLORS.muted });
      textAt("Rencana", cols[1], y - 12, { size: 7.2, bold: true, color: COLORS.muted, align: "right" });
      textAt("Aktual", cols[2], y - 12, { size: 7.2, bold: true, color: COLORS.muted, align: "right" });
      textAt("Selisih", cols[3], y - 12, { size: 7.2, bold: true, color: COLORS.muted, align: "right" });
      y -= 20;
      plannedDetails.forEach((item, idx) => {
        ensureSpace(rowH);
        const top = y;
        if (idx % 2 === 0) rect(MARGIN, top, CONTENT_W, rowH, COLORS.surface);
        const label = truncateToWidth(`${item.group} - ${item.category}`, 7.7, false, 220);
        textAt(label, MARGIN + 8, top - 14, { size: 7.7, color: COLORS.ink });
        textAt(formatIDR(item.planned), cols[1], top - 14, { size: 7.7, color: COLORS.ink, align: "right" });
        textAt(formatIDR(item.actual), cols[2], top - 14, { size: 7.7, color: COLORS.ink, align: "right" });
        const d = Number(item.difference) || 0;
        textAt(`${d < 0 ? "- " : "+ "}${formatIDR(Math.abs(d))}`, cols[3], top - 14, { size: 7.7, bold: true, color: d < 0 ? COLORS.red : COLORS.green, align: "right" });
        y = top - rowH;
      });
    } else {
      addText("Belum ada detail rencana pengeluaran.", { size: 9, color: COLORS.muted });
    }
    y -= 6;

    // ---------------- Daily actual detail ----------------
    sectionTitle("Pengeluaran Aktual Berdasarkan Tanggal", "Rincian mengikuti transaksi yang terakhir dicatat atau diperbarui pengguna.");
    const dailyActual = Array.isArray(report.dailyActual) ? report.dailyActual : [];
    if (dailyActual.length) {
      dailyActual.forEach(day => {
        const dayItems = Array.isArray(day.items) ? day.items : [];
        const blockH = 25 + Math.min(dayItems.length, 8) * 18;
        ensureSpace(Math.min(blockH, 180) + 8);
        const top = y;
        roundedRect(MARGIN, top, CONTENT_W, Math.min(blockH, 180), 7, COLORS.surface, COLORS.line, 0.6);
        textAt(formatDateOnlyID(day.date), MARGIN + 10, top - 14, { size: 8.5, bold: true, color: COLORS.ink });
        textAt(formatIDR(day.total), PAGE_W - MARGIN - 10, top - 14, { size: 8.5, bold: true, color: COLORS.primaryDark, align: "right" });
        let dy = top - 32;
        dayItems.forEach((item, idx) => {
          if (idx >= 8) return;
          const label = truncateToWidth(`${item.category} (${item.group})`, 7.3, false, 350);
          textAt(label, MARGIN + 12, dy, { size: 7.3, color: COLORS.ink });
          textAt(formatIDR(item.amount), PAGE_W - MARGIN - 12, dy, { size: 7.3, color: COLORS.ink, align: "right" });
          if (item.note) textAt(truncateToWidth(`Catatan: ${item.note}`, 6.5, false, 340), MARGIN + 24, dy - 9, { size: 6.5, color: COLORS.muted });
          dy -= item.note ? 18 : 15;
        });
        if (dayItems.length > 8) textAt(`+ ${dayItems.length - 8} transaksi lainnya pada tanggal ini.`, MARGIN + 12, top - 166, { size: 6.8, color: COLORS.muted });
        y = top - Math.min(blockH, 180) - 8;
      });
    } else {
      addText("Belum ada pengeluaran aktual yang dicatat pada bulan ini.", { size: 9, color: COLORS.muted });
    }
    y -= 6;

    // ---------------- Recap ----------------
    sectionTitle("Rekapitulasi Rencana vs Aktual", "Ringkasan akhir untuk membantu mengevaluasi kepatuhan terhadap rencana pengeluaran.");
    const recap = [
      ["Pemasukan / Gaji", report.income],
      ["Total Rencana Pengeluaran", report.plannedTotal],
      ["Total Pengeluaran Aktual", report.expense],
      [report.difference >= 0 ? "Sisa Rencana" : "Kelebihan dari Rencana", Math.abs(report.difference)]
    ];
    const recapGap = 9, recapW = (CONTENT_W - recapGap * 3) / 4, recapH = 48;
    ensureSpace(recapH + 8);
    recap.forEach((item, i) => {
      const x = MARGIN + i * (recapW + recapGap);
      roundedRect(x, y, recapW, recapH, 7, COLORS.surface, COLORS.line, 0.6);
      textAt(item[0], x + 8, y - 14, { size: 6.8, color: COLORS.muted });
      textAt(formatIDR(item[1]), x + 8, y - 34, { size: 9.2, bold: true, color: COLORS.ink });
    });
    y -= recapH + 10;

    // ---------------- Category breakdown ----------------
    sectionTitle("Pengeluaran Terbesar per Kategori", report.categories.length ? "Diurutkan dari nominal tertinggi." : null);

    if (report.categories.length) {
      const top10 = report.categories.slice(0, 10);
      const maxAmt = Math.max(...top10.map(c => c.amount), 1);
      const rowH = 30;
      const barX = MARGIN + 230, barMaxW = 118, barH = 5;
      const nameMaxW = barX - (MARGIN + 30) - 10;
      top10.forEach((c, idx) => {
        ensureSpace(rowH);
        const rowTop = y;
        if (idx % 2 === 0) rect(MARGIN, rowTop, CONTENT_W, rowH, COLORS.surface);
        textAt(String(idx + 1).padStart(2, "0"), MARGIN + 8, rowTop - 14, { size: 8, bold: true, color: COLORS.mutedLight });
        const catLabel = truncateToWidth(c.category, 8.8, true, nameMaxW);
        textAt(catLabel, MARGIN + 30, rowTop - 14, { size: 8.8, color: COLORS.ink, bold: true });
        const groupLabel = truncateToWidth(`(${c.group})`, 7, false, CONTENT_W - 40);
        textAt(groupLabel, MARGIN + 30, rowTop - 25, { size: 7, color: COLORS.mutedLight });
        // mini bar
        const barTopY = rowTop - 12;
        roundedRect(barX, barTopY, barMaxW, barH, barH / 2, COLORS.lineSoft);
        const w = Math.max(4, barMaxW * (c.amount / maxAmt));
        roundedRect(barX, barTopY, w, barH, barH / 2, GROUP_PALETTE[idx % GROUP_PALETTE.length]);
        textAt(formatIDR(c.amount), PAGE_W - MARGIN - 6, rowTop - 14, { size: 8.8, bold: true, color: COLORS.ink, align: "right" });
        y = rowTop - rowH;
      });
      if (report.categories.length > 10) {
        addText(`+ ${report.categories.length - 10} kategori lainnya tidak ditampilkan di ringkasan ini.`, { size: 7.5, color: COLORS.mutedLight, lineHeight: 11 });
      }
    } else {
      addText("Belum ada pengeluaran pada bulan ini.", { size: 9, color: COLORS.muted });
    }
    y -= 6;

    // ---------------- Conclusion ----------------
    sectionTitle("Kesimpulan & Insight");
    const concLines = wrapText(report.conclusion, 96);
    const noteLines = wrapText("Makna selisih: nilai positif berarti aktual masih di bawah rencana; nilai negatif berarti aktual telah melampaui rencana.", 100);
    const boxH = 30 + concLines.length * 13 + noteLines.length * 11 + 10;
    ensureSpace(boxH + 8);
    const boxTop = y;
    roundedRect(MARGIN, boxTop, CONTENT_W, boxH, 9, COLORS.primaryLight, null);
    rect(MARGIN, boxTop, 3.2, boxH, COLORS.primary);
    textAt("CATATAN", MARGIN + 16, boxTop - 15, { size: 7.5, bold: true, color: COLORS.primaryDark });
    y = boxTop - 28;
    concLines.forEach(l => { textAt(l, MARGIN + 16, y, { size: 9, color: COLORS.ink }); y -= 13; });
    y -= 3;
    noteLines.forEach(l => { textAt(l, MARGIN + 16, y, { size: 7.5, color: COLORS.muted }); y -= 11; });
    y = boxTop - boxH - 10;

    // ---------------- Closing brand strip ----------------
    ensureSpace(26);
    roundedRect(MARGIN, y, CONTENT_W, 26, 7, COLORS.surface, COLORS.line, 0.6);
    const brandLine = truncateToWidth(`${report.appName || "FinanceTrack"} - Website ini dikembangkan oleh: ASKarya`, 8, true, CONTENT_W * 0.62);
    textAt(brandLine, MARGIN + 12, y - 17, { size: 8, bold: true, color: COLORS.primaryDark });
    textAt(`Tanggal unduh: ${formatDateID(report.downloadedAt ? new Date(report.downloadedAt) : new Date())}`, PAGE_W - MARGIN - 12, y - 17, { size: 7.5, color: COLORS.muted, align: "right" });

    // ---------------- Footer on every page ----------------
    pages.forEach((page, index) => {
      const footerY = 26;
      const prev = commands;
      commands = page;
      hline(MARGIN, footerY + 9, PAGE_W - MARGIN, COLORS.lineSoft, 0.6);
      textAt("FinanceTrack - ASKarya", MARGIN, footerY - 2, { size: 7, color: COLORS.mutedLight });
      textAt(`Halaman ${index + 1} / ${pages.length}`, PAGE_W - MARGIN, footerY - 2, { size: 7, color: COLORS.mutedLight, align: "right" });
      commands = prev;
    });

    // ---------------- Build PDF objects / xref ----------------
    const objects = [];
    const addObject = (body) => { objects.push(body); return objects.length; };

    const catalogRef = addObject("");
    const pagesRef = addObject("");
    const fontRegularRef = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    const fontBoldRef = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    const pageRefs = [];

    pages.forEach(pageCommands => {
      const stream = pageCommands.join("\n") + "\n";
      const streamLength = new TextEncoder().encode(stream).length;
      const contentRef = addObject(`<< /Length ${streamLength} >>\nstream\n${stream}endstream`);
      const pageRef = addObject(
        `<< /Type /Page /Parent ${pagesRef} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
        `/Resources << /Font << /F1 ${fontRegularRef} 0 R /F2 ${fontBoldRef} 0 R >> >> ` +
        `/Contents ${contentRef} 0 R >>`
      );
      pageRefs.push(pageRef);
    });

    objects[pagesRef - 1] = `<< /Type /Pages /Kids [${pageRefs.map(ref => `${ref} 0 R`).join(" ")}] /Count ${pageRefs.length} >>`;
    objects[catalogRef - 1] = `<< /Type /Catalog /Pages ${pagesRef} 0 R >>`;

    let pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
    const offsets = [0];
    objects.forEach((body, index) => {
      offsets[index + 1] = new TextEncoder().encode(pdf).length;
      pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
    });

    const xrefOffset = new TextEncoder().encode(pdf).length;
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += "0000000000 65535 f \n";
    for (let i = 1; i <= objects.length; i++) {
      pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogRef} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    return new Blob([new TextEncoder().encode(pdf)], { type: "application/pdf" });
  }

  function downloadReport(report) {
    try {
      const blob = buildReport(report);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `FinanceTrack-${report.monthKey}.pdf`;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        link.remove();
      }, 1500);
      return true;
    } catch (error) {
      console.error("FinanceTrack PDF error:", error);
      if (window.FinanceApp?.toast) FinanceApp.toast("PDF gagal dibuat. Silakan cek Console browser.");
      return false;
    }
  }

  return { downloadReport, buildReport, formatIDR };
})();
