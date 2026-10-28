const express = require('express');
const { db, STEP_NAMES } = require('../db');
const { auth } = require('../middleware/auth');
const router = express.Router();

const STEP_LABELS = {
  licenca_aprovacao: 'Licença/Aprovação', du: 'DU', talex: 'Talex', transporte: 'Transporte',
  nota: 'NOTA', legalizacao: 'Legalização', delivery: 'Delivery', inspecao: 'Inspeção',
  detencao: 'Detenção', sobrestadia: 'Sobrestadia', porto: 'Porto', terminal: 'Terminal', entregue: 'Entregue'
};

const STATUS_LABELS = { selecionar: 'Selecionar', em_curso: 'Em curso', concluido: 'Concluído' };

router.get('/excel', auth, async (req, res) => {
  try {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Processos');
    const headers = ['Nº', 'Empresa', 'Nº BL', 'Nº Contentor', 'Prevista', ...STEP_NAMES.map(n => STEP_LABELS[n]), 'Situação de Pagamento', 'Observações'];
    ws.addRow(headers);
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    const processes = await db.all(`SELECT * FROM processes ORDER BY seq_no`);
    for (const p of processes) {
      const steps = await db.all(`SELECT step_name, status, operated_at, operated_by FROM process_steps WHERE process_id = ?`, [p.id]);
      const stepMap = {};
      for (const s of steps) stepMap[s.step_name] = s;
      const row = [p.seq_no, p.empresa, p.bl_number, p.container_number, p.prevista_date];
      for (const name of STEP_NAMES) {
        const s = stepMap[name];
        row.push(s ? STATUS_LABELS[s.status] || s.status : '');
      }
      row.push(p.fee_status, p.notes);
      ws.addRow(row);
    }
    ws.columns.forEach(col => { col.width = 18; });
    ws.getColumn(1).width = 6;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=processos.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/pdf', auth, async (req, res) => {
  try {
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=processos.pdf');
    doc.pipe(res);
    doc.fontSize(16).text('Processos de Despacho Aduaneiro', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(8);
    const colWidths = [25, 60, 60, 60, 55, 45, 45, 45, 45, 45, 45, 45, 45, 45, 45, 45, 45, 45, 55, 60];
    const headers = ['Nº', 'Empresa', 'Nº BL', 'Contentor', 'Prevista', ...STEP_NAMES.map(n => STEP_LABELS[n].substring(0, 8)), 'Pagamento', 'Obs.'];
    let y = doc.y + 5;
    doc.font('Helvetica-Bold');
    let x = 30;
    for (let i = 0; i < headers.length; i++) {
      doc.text(headers[i], x, y, { width: colWidths[i] });
      x += colWidths[i];
    }
    doc.font('Helvetica');
    y += 12;
    const processes = await db.all(`SELECT * FROM processes ORDER BY seq_no`);
    for (const p of processes) {
      if (y > 540) { doc.addPage(); y = 30; }
      const steps = await db.all(`SELECT step_name, status FROM process_steps WHERE process_id = ?`, [p.id]);
      const stepMap = {};
      for (const s of steps) stepMap[s.step_name] = s.status;
      const vals = [p.seq_no, p.empresa, p.bl_number, p.container_number, p.prevista_date];
      for (const name of STEP_NAMES) vals.push(STATUS_LABELS[stepMap[name]] || '');
      vals.push(p.fee_status, p.notes);
      x = 30;
      for (let i = 0; i < vals.length; i++) {
        doc.text(String(vals[i] || ''), x, y, { width: colWidths[i] });
        x += colWidths[i];
      }
      y += 10;
    }
    doc.end();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
