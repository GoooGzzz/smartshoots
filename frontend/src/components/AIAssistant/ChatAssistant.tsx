import React, { useState, useRef, useEffect } from 'react';
import {
  Fab, Drawer, Box, Typography, TextField, IconButton, Paper, List, ListItem, Avatar,
} from '@mui/material';
import ChatIcon from '@mui/icons-material/Chat';
import SendIcon from '@mui/icons-material/Send';
import CloseIcon from '@mui/icons-material/Close';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import apiClient from '../../api/client';
import { useTranslation } from 'react-i18next';

interface Message {
  text: string;
  isUser: boolean;
}

export default function ChatAssistant() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { text: t('assistantWelcome'), isUser: false },
  ]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages, open]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setMessages((prev) => [...prev, { text: userMsg, isUser: true }]);
    setInput('');
    setLoading(true);
    try {
      const res = await apiClient.post('/assistant/query/', { query: userMsg });
      setMessages((prev) => [...prev, { text: res.data.answer, isUser: false }]);
    } catch (err) {
      setMessages((prev) => [...prev, { text: t('assistantError'), isUser: false }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Fab
        color="primary"
        aria-label="chat"
        onClick={() => setOpen(true)}
        sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000 }}
      >
        <ChatIcon />
      </Fab>
      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{ sx: { width: { xs: '100%', sm: 400 }, p: 2 } }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <SmartToyIcon color="primary" sx={{ mr: 1 }} />
          <Typography variant="h6" sx={{ flex: 1 }}>{t('assistantTitle')}</Typography>
          <IconButton onClick={() => setOpen(false)}><CloseIcon /></IconButton>
        </Box>
        <Paper sx={{ flex: 1, overflow: 'auto', mb: 2, p: 2, maxHeight: '60vh', bgcolor: 'background.default' }}>
          <List>
            {messages.map((msg, idx) => (
              <ListItem key={idx} sx={{ justifyContent: msg.isUser ? 'flex-end' : 'flex-start', mb: 1 }}>
                {!msg.isUser && <Avatar sx={{ bgcolor: 'primary.main', mr: 1 }}><SmartToyIcon /></Avatar>}
                <Paper sx={{ p: 1.5, borderRadius: 2, maxWidth: '80%', bgcolor: msg.isUser ? 'primary.main' : 'background.paper', color: msg.isUser ? 'white' : 'text.primary' }}>
                  <Typography variant="body2">{msg.text}</Typography>
                </Paper>
              </ListItem>
            ))}
            <div ref={messagesEndRef} />
          </List>
        </Paper>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            size="small"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder={t('assistantPlaceholder')}
            disabled={loading}
          />
          <IconButton color="primary" onClick={sendMessage} disabled={loading}>
            <SendIcon />
          </IconButton>
        </Box>
      </Drawer>
    </>
  );
}