import React, { useState } from 'react';
import { Button, Input, Box, LinearProgress } from '@mui/material';
import apiClient from '../../api/client';

interface BulkUploadProps {
  onUploadComplete: () => void;
}

export default function BulkUpload({ onUploadComplete }: BulkUploadProps) {
  const [files, setFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFiles(e.target.files);
  };

  const handleUpload = async () => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }
    try {
      await apiClient.post('/finance/attachments/bulk/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onUploadComplete();
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
      setFiles(null);
    }
  };

  return (
    <Box sx={{ mb: 2 }}>
      <Input type="file" inputProps={{ multiple: true }} onChange={handleFileChange} />
      <Button variant="contained" onClick={handleUpload} disabled={!files || uploading} sx={{ ml: 2 }}>
        {uploading ? 'Uploading...' : 'Upload Files'}
      </Button>
      {uploading && <LinearProgress sx={{ mt: 1 }} />}
    </Box>
  );
}
