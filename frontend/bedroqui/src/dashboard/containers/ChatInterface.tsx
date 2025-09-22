import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Paper,
  Typography,
  Avatar,
  Chip,
  CircularProgress,
  Divider,
  Stack,
} from '@mui/material';
import {
  Send as SendIcon,
  AttachFile as AttachFileIcon,
  Person as PersonIcon,
  SmartToy as BotIcon,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  attachments?: File[];
}

const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const theme = useTheme();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Real Anthropic API call
  const callAnthropicAPI = async (message: string, files: File[]): Promise<string> => {
    try {
      // For now, this is a placeholder that simulates the API call
      // You'll replace this with actual Anthropic API integration
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      let response = `I understand you're asking: "${message}"`;
      
      if (files.length > 0) {
        response += `\n\nI see you've attached ${files.length} file(s): ${files.map(f => f.name).join(', ')}`;
        response += `\n\nOnce you integrate the Anthropic API, I'll be able to analyze these documents and provide detailed insights about your project.`;
      }
      
      response += `\n\nTo complete the integration, please:\n1. Add your Anthropic API key to your environment variables\n2. Implement the PDF text extraction\n3. Replace this placeholder with the real API call`;
      
      return response;
    } catch (error) {
      console.error('API error:', error);
      throw new Error('Failed to get response from AI assistant. Please check your setup and try again.');
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() && attachedFiles.length === 0) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
      attachments: attachedFiles.length > 0 ? [...attachedFiles] : undefined,
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setAttachedFiles([]);
    setIsLoading(true);

    try {
      const response = await callAnthropicAPI(inputValue, attachedFiles);
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error calling API:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileAttach = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setAttachedFiles(prev => [...prev, ...files]);
  };

  const removeAttachment = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Messages Area */}
      <Box
        sx={{
          flexGrow: 1,
          overflowY: 'auto',
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {messages.length === 0 && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              textAlign: 'center',
              color: 'text.secondary',
            }}
          >
            <BotIcon sx={{ fontSize: 48, mb: 2 }} />
            <Typography variant="h6">Bedroq Review Assistant</Typography>
            <Typography variant="body2">
              Upload PDF documents and ask questions about your project
            </Typography>
          </Box>
        )}

        {messages.map((message) => (
          <Box
            key={message.id}
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1,
              flexDirection: message.role === 'user' ? 'row-reverse' : 'row',
            }}
          >
            <Avatar
              sx={{
                bgcolor: message.role === 'user' ? 'primary.main' : 'secondary.main',
                width: 32,
                height: 32,
              }}
            >
              {message.role === 'user' ? (
                <PersonIcon fontSize="small" />
              ) : (
                <BotIcon fontSize="small" />
              )}
            </Avatar>

            <Paper
              elevation={1}
              sx={{
                p: 2,
                maxWidth: '80%',
                bgcolor: message.role === 'user' ? 'primary.light' : 'background.paper',
                color: message.role === 'user' ? 'primary.contrastText' : 'text.primary',
              }}
            >
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {message.content}
              </Typography>

              {message.attachments && (
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  {message.attachments.map((file, index) => (
                    <Chip
                      key={index}
                      label={file.name}
                      size="small"
                      variant="outlined"
                    />
                  ))}
                </Stack>
              )}

              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  mt: 1,
                  opacity: 0.7,
                  textAlign: message.role === 'user' ? 'right' : 'left',
                }}
              >
                {formatTime(message.timestamp)}
              </Typography>
            </Paper>
          </Box>
        ))}

        {isLoading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Avatar sx={{ bgcolor: 'secondary.main', width: 32, height: 32 }}>
              <BotIcon fontSize="small" />
            </Avatar>
            <Paper elevation={1} sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={16} />
                <Typography variant="body2" color="text.secondary">
                  Thinking...
                </Typography>
              </Box>
            </Paper>
          </Box>
        )}

        <div ref={messagesEndRef} />
      </Box>

      <Divider />

      {/* File Attachments Preview */}
      {attachedFiles.length > 0 && (
        <Box sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            Attached Files:
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {attachedFiles.map((file, index) => (
              <Chip
                key={index}
                label={file.name}
                onDelete={() => removeAttachment(index)}
                size="small"
                color="primary"
              />
            ))}
          </Stack>
        </Box>
      )}

      {/* Input Area */}
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
          <IconButton
            onClick={handleFileAttach}
            size="small"
            sx={{ mb: 0.5 }}
          >
            <AttachFileIcon />
          </IconButton>

          <TextField
            fullWidth
            multiline
            maxRows={4}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about your project documents..."
            variant="outlined"
            size="small"
            disabled={isLoading}
          />

          <IconButton
            onClick={handleSendMessage}
            disabled={(!inputValue.trim() && attachedFiles.length === 0) || isLoading}
            color="primary"
            sx={{ mb: 0.5 }}
          >
            <SendIcon />
          </IconButton>
        </Box>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.txt"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </Box>
    </Box>
  );
};

export default ChatInterface;