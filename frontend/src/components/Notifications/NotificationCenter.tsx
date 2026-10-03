import React, { useState } from 'react';
import {
  Badge, IconButton, Menu, MenuItem, Typography, Box, Button,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../api/client';
import { useTranslation } from 'react-i18next';

export default function NotificationCenter() {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiClient.get('/notifications/?is_read=false').then(res => res.data),
    refetchInterval: 30000,
  });

  const markAllRead = useMutation({
    mutationFn: () => apiClient.post('/notifications/mark_all_read/'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const unreadCount = data?.results?.length ?? 0;

  return (
    <>
      <IconButton color="inherit" onClick={(e) => setAnchorEl(e.currentTarget)}>
        <Badge badgeContent={unreadCount} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        <Box sx={{ p: 2, width: 300, maxHeight: 400, overflow: 'auto' }}>
          <Typography variant="subtitle1">{t('notifications')}</Typography>
          {data?.results?.length === 0 ? (
            <Typography variant="body2" color="textSecondary">{t('noData')}</Typography>
          ) : (
            data?.results?.map((n: any) => (
              <MenuItem key={n.id} onClick={() => setAnchorEl(null)}>
                <Box>
                  <Typography variant="body2" fontWeight="bold">{n.title}</Typography>
                  <Typography variant="caption" color="textSecondary">{n.message}</Typography>
                </Box>
              </MenuItem>
            ))
          )}
          <Button size="small" onClick={() => markAllRead.mutate()}>{t('markAllRead')}</Button>
        </Box>
      </Menu>
    </>
  );
}
