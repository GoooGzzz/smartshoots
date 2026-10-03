import React, { useState } from 'react';
import {
  Box, Typography, Button, Table, TableHead, TableRow, TableCell, TableBody,
  IconButton,
} from '@mui/material';
import { Delete, Visibility, AttachFile } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import apiClient from '../api/client';
import BulkUpload from '../components/Common/BulkUpload';
import FilePreview from '../components/Common/FilePreview';
import PageHeader from '../components/Common/PageHeader';

export default function AttachmentsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewName, setPreviewName] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['attachments'],
    queryFn: () => apiClient.get('/finance/attachments/').then(res => res.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/finance/attachments/${id}/`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attachments'] }),
  });

  const handlePreview = (url: string, filename: string) => {
    setPreviewUrl(url);
    setPreviewName(filename);
    setPreviewOpen(true);
  };

  if (isLoading) return <Typography>{t('loading')}</Typography>;
  const attachments = data?.results ?? [];

  return (
    <Box>
      <PageHeader title={t('attachments')} icon={<AttachFile />} color="#795548" />
      <BulkUpload onUploadComplete={() => queryClient.invalidateQueries({ queryKey: ['attachments'] })} />
      <Table>
        <TableHead><TableRow><TableCell>{t('filename')}</TableCell><TableCell>{t('type')}</TableCell><TableCell>{t('size')}</TableCell><TableCell>{t('actions')}</TableCell></TableRow></TableHead>
        <TableBody>
          {attachments.map((att: any) => (
            <TableRow key={att.id} hover>
              <TableCell>{att.filename}</TableCell>
              <TableCell>{att.file_type}</TableCell>
              <TableCell>{att.file_size}</TableCell>
              <TableCell>
                <IconButton onClick={() => handlePreview(att.file, att.filename)}><Visibility /></IconButton>
                <IconButton onClick={() => deleteMutation.mutate(att.id)}><Delete /></IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <FilePreview
        url={previewUrl}
        filename={previewName}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />
    </Box>
  );
}
