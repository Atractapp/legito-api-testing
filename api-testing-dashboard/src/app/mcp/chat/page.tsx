'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Bot, User, Settings, Loader2, AlertCircle, Eye, EyeOff, Plus, Trash2, MessageSquare } from 'lucide-react';
import { useMcpStore } from '@/store/mcp-store';
import { useChatStore, useConversations, useActiveMessages } from '@/store/chat-store';
import { Alert, AlertDescription } from '@/components/ui/alert';

type AIProvider = 'openai' | 'anthropic' | 'google';

const providerLabels: Record<AIProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic (Claude)',
  google: 'Google (Gemini)',
};

export default function McpChatPage() {
  // Chat store
  const {
    activeConversationId,
    aiProvider,
    aiApiKey,
    createConversation,
    deleteConversation,
    setActiveConversation,
    addMessage,
    updateMessage,
    setAiProvider,
    setAiApiKey,
  } = useChatStore();

  const conversations = useConversations();
  const messages = useActiveMessages();

  // Local UI state
  const [showApiKey, setShowApiKey] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get the default workspace credentials
  const { getAllWorkspaces } = useMcpStore();
  const workspacesList = getAllWorkspaces();
  const defaultEntry = workspacesList.find(entry => entry.workspace.isDefault) || workspacesList[0];
  const defaultWorkspace = defaultEntry?.workspace;

  // Load API key from localStorage on mount (for security, not persisted in store)
  useEffect(() => {
    const savedKey = localStorage.getItem('ai-api-key');
    if (savedKey && !aiApiKey) {
      setAiApiKey(savedKey);
    }
  }, [aiApiKey, setAiApiKey]);

  // Save API key to localStorage when changed
  useEffect(() => {
    if (aiApiKey) {
      localStorage.setItem('ai-api-key', aiApiKey);
    }
  }, [aiApiKey]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const hasCredentials = aiApiKey.length > 0;
  const hasLegitoCredentials = !!defaultWorkspace;

  const handleNewChat = () => {
    createConversation();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !hasCredentials || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    setError(null);

    // Add user message to store
    addMessage({ role: 'user', content: userMessage });
    setIsLoading(true);

    try {
      // Build headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-AI-Provider': aiProvider,
        'X-AI-API-Key': aiApiKey,
      };

      if (defaultWorkspace) {
        headers['X-Legito-Key'] = defaultWorkspace.credentials.key;
        headers['X-Legito-Private-Key'] = defaultWorkspace.credentials.privateKey;
        headers['X-Legito-Region'] = defaultWorkspace.credentials.region;
      }

      // Get fresh messages from store after adding user message
      const currentMessages = useChatStore.getState().getActiveMessages();
      const apiMessages = currentMessages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!response.ok) {
        const text = await response.text();
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = JSON.parse(text);
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = text || errorMessage;
        }
        throw new Error(errorMessage);
      }

      // Read the stream
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let assistantContent = '';

      // Add empty assistant message
      addMessage({ role: 'assistant', content: '' });

      // Get the ID of the just-added message
      const latestMessages = useChatStore.getState().getActiveMessages();
      const assistantMsgId = latestMessages[latestMessages.length - 1]?.id;
      setStreamingMessageId(assistantMsgId || null);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        assistantContent += chunk;

        // Update the assistant message with accumulated content
        if (assistantMsgId) {
          updateMessage(assistantMsgId, assistantContent);
        }
      }

      setStreamingMessageId(null);

      if (!assistantContent.trim()) {
        setError('No response from AI. Check your API key and try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
      setStreamingMessageId(null);
    }
  };

  return (
    <div className="flex flex-col h-full p-6 gap-4 overflow-hidden">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold">AI Chat</h1>
          <p className="text-muted-foreground">
            Chat with AI to query your Legito workspace
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSettings(!showSettings)}
        >
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </Button>
      </div>

      <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
        {/* Conversation Sidebar */}
        <Card className="w-64 shrink-0 flex flex-col overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Chats</CardTitle>
              <Button size="sm" variant="outline" onClick={handleNewChat}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="px-4 pb-4 space-y-1">
                {conversations.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No chats yet. Start a new one!
                  </p>
                ) : (
                  conversations.map((conv) => (
                    <div
                      key={conv.id}
                      className={`group flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-muted ${
                        conv.id === activeConversationId ? 'bg-muted' : ''
                      }`}
                      onClick={() => setActiveConversation(conv.id)}
                    >
                      <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 text-sm truncate">{conv.title}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteConversation(conv.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Settings Panel */}
        {showSettings && (
          <Card className="w-80 shrink-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Configuration</CardTitle>
              <CardDescription>Configure AI and Legito credentials</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="ai" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="ai">AI Provider</TabsTrigger>
                  <TabsTrigger value="legito">Legito</TabsTrigger>
                </TabsList>

                <TabsContent value="ai" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Provider</Label>
                    <Select value={aiProvider} onValueChange={(v) => setAiProvider(v as AIProvider)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="google">{providerLabels.google}</SelectItem>
                        <SelectItem value="openai">{providerLabels.openai}</SelectItem>
                        <SelectItem value="anthropic">{providerLabels.anthropic}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>API Key</Label>
                    <div className="relative">
                      <Input
                        type={showApiKey ? 'text' : 'password'}
                        value={aiApiKey}
                        onChange={(e) => setAiApiKey(e.target.value)}
                        placeholder={`Enter your ${aiProvider === 'google' ? 'Gemini' : aiProvider === 'openai' ? 'OpenAI' : 'Anthropic'} API key`}
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowApiKey(!showApiKey)}
                      >
                        {showApiKey ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Your API key is stored locally in your browser.
                    </p>
                  </div>

                  {!hasCredentials && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Please enter an API key to start chatting.
                      </AlertDescription>
                    </Alert>
                  )}
                </TabsContent>

                <TabsContent value="legito" className="space-y-4 mt-4">
                  {hasLegitoCredentials ? (
                    <div className="space-y-2">
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="font-medium">{defaultWorkspace.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Region: {defaultWorkspace.credentials.region.toUpperCase()}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Using credentials from your default MCP workspace. You can change this in the Workspaces settings.
                      </p>
                    </div>
                  ) : (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        No Legito workspace configured. Go to MCP Workspaces to add credentials.
                      </AlertDescription>
                    </Alert>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        {/* Chat Panel */}
        <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <CardContent className="flex-1 flex flex-col p-4 min-h-0 overflow-hidden">
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-4">
                {messages.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">Welcome to Legito AI Chat</p>
                    <p className="text-sm mt-2">
                      Ask me about your documents, templates, users, or any Legito data.
                    </p>
                    {hasLegitoCredentials && (
                      <p className="text-sm mt-1">
                        Connected to: <span className="font-medium">{defaultWorkspace.name}</span>
                      </p>
                    )}
                  </div>
                )}

                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {message.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div
                      className={`max-w-[70%] rounded-lg px-4 py-2 overflow-hidden ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <div className="whitespace-pre-wrap text-sm break-words overflow-wrap-anywhere">
                        {message.content || (message.id === streamingMessageId ? '' : message.content)}
                      </div>
                    </div>
                    {message.role === 'user' && (
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                        <User className="h-4 w-4 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                ))}

                {isLoading && messages[messages.length - 1]?.role === 'user' && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <div className="bg-muted rounded-lg px-4 py-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  </div>
                )}

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input Area */}
            <form onSubmit={handleSubmit} className="flex gap-2 mt-4 pt-4 border-t">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={hasCredentials ? "Ask about your Legito data..." : "Enter your AI API key in settings to start"}
                disabled={!hasCredentials || isLoading}
                className="flex-1"
              />
              <Button type="submit" disabled={!hasCredentials || isLoading || !inputValue.trim()}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
