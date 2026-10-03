import React, { useEffect, useState } from 'react';
import { Modal, Box, IconButton, Tabs, Tab, Table, TableBody, TableCell, TableRow, Typography, CircularProgress } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import * as XLSX from 'xlsx';

interface FilePreviewProps {
  url: string;
  filename: string;
  open: boolean;
  onClose: () => void;
}

// NEW: uploaded Excel (.xlsx/.xls) and .csv attachments used to fall
// straight into the "Preview not available for this file type" branch -
// the file uploaded fine, there was just no code path that rendered it.
// This fetches the file, parses it with SheetJS (already a project
// dependency, used elsewhere for xlsx export), and renders each sheet as
// a real table with tabs to switch between sheets.
function SpreadsheetPreview({ url, filename }: { url: string; filename: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheets, setSheets] = useState<{ name: string; rows: any[][] }[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .then((buf) => {
        if (cancelled) return;
        const workbook = XLSX.read(buf, { type: 'array' });
        const parsed = workbook.SheetNames.map((name) => ({
          name,
          rows: XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, blankrows: false }) as any[][],
        }));
        setSheets(parsed);
        setActiveSheet(0);
      })
      .catch((err) => { if (!cancelled) setError(err?.message || 'Failed to load file'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [url]);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress size={28} /></Box>;
  if (error) return <Typography color="error">Couldn't preview {filename}: {error}</Typography>;
  if (sheets.length === 0) return <Typography color="text.secondary">This file appears to be empty.</Typography>;

  const rows = sheets[activeSheet]?.rows ?? [];
  const maxCols = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const displayRows = rows.slice(0, 500); // keep the modal responsive for large sheets

  return (
    <Box sx={{ minWidth: 320, maxWidth: '80vw' }}>
      {sheets.length > 1 && (
        <Tabs value={activeSheet} onChange={(_e, v) => setActiveSheet(v)} variant="scrollable" scrollButtons="auto" sx={{ mb: 1, borderBottom: 1, borderColor: 'divider' }}>
          {sheets.map((s, i) => <Tab key={s.name} label={s.name} value={i} />)}
        </Tabs>
      )}
      <Box sx={{ overflow: 'auto', maxHeight: '65vh' }}>
        <Table size="small" stickyHeader>
          <TableBody>
            {displayRows.map((row, rIdx) => (
              <TableRow key={rIdx} sx={rIdx === 0 ? { bgcolor: 'action.hover' } : undefined}>
                {Array.from({ length: maxCols }).map((_, cIdx) => (
                  <TableCell key={cIdx} sx={rIdx === 0 ? { fontWeight: 700 } : undefined}>
                    {row[cIdx] ?? ''}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      {rows.length > displayRows.length && (
        <Typography variant="caption" color="text.secondary">
          Showing first {displayRows.length.toLocaleString()} of {rows.length.toLocaleString()} rows.
        </Typography>
      )}
    </Box>
  );
}

export default function FilePreview({ url, filename, open, onClose }: FilePreviewProps) {
  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(filename);
  const isPDF = /\.pdf$/i.test(filename);
  const isSpreadsheet = /\.(xlsx|xls|xlsm|csv)$/i.test(filename);

  return (
    <Modal open={open} onClose={onClose}>
      <Box sx={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        bgcolor: 'background.paper', boxShadow: 24, p: 2, maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto',
      }}>
        <IconButton onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8 }}><CloseIcon /></IconButton>
        {isImage && <img src={url} alt={filename} style={{ maxWidth: '100%', maxHeight: '80vh' }} />}
        {isPDF && <iframe src={url} width="100%" height="500px" title={filename} />}
        {isSpreadsheet && <SpreadsheetPreview url={url} filename={filename} />}
        {!isImage && !isPDF && !isSpreadsheet && <p>Preview not available for this file type.</p>}
      </Box>
    </Modal>
  );
}
