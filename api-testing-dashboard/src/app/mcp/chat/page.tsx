'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Bot, User, Settings, Loader2, AlertCircle } from 'lucide-react';
import { useMcpStore } from '@/store/mcp-store';
import { Alert, AlertDescription } from '@/components/ui/alert';

type AIProvider = 'openai' | 'anthropic' | 'google';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const providerLabels: Record<AIProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic (Claude)',
  google: 'Google (Gemini)',
};

export default function McpChatPage() {
  const [aiProvider, setAiProvider] = useState<AIProvider>('google');
  const [aiApiKey, setAiApiKey] = useState('');
  const [showSettings, setShowSettings] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get the default workspace credentials
  const { getAllWorkspaces } = useMcpStore();
  const workspacesList = getAllWorkspaces();
  const defaultEntry = workspacesList.find(entry => entry.workspace.isDefault) || workspacesList[0];
  const defaultWorkspace = defaultEntry?.workspace;

  // Load saved API key from localStorage on mount
  useEffect(() => {
    const savedKey = localStorage.getItem('ai-api-key');
    const savedProvider = localStorage.getItem('ai-provider') as AIProvider | null;
    if (savedKey) setAiApiKey(savedKey);
    if (savedProvider) setAiProvider(savedProvider);
  }, []);

  // Save API key to localStorage when changed
  useEffect(() => {
    if (aiApiKey) {
      localStorage.setItem('ai-api-key', aiApiKey);
    }
    localStorage.setItem('ai-provider', aiProvider);
  }, [aiApiKey, aiProvider]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const hasCredentials = aiApiKey.length > 0;
  const hasLegitoCredentials = !!defaultWorkspace;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !hasCredentials || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    setError(null);

    // Add user message
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userMessage,
    };
    setMessages(prev => [...prev, userMsg]);
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

      // Build messages for API
      const apiMessages = [...messages, userMsg].map(m => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      // Read the stream
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let assistantContent = '';

      // Add empty assistant message that we'll update
      const assistantMsgId = crypto.randomUUID();
      setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        assistantContent += chunk;

        // Update the assistant message with accumulated content
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMsgId
              ? { ...m, content: assistantContent }
              : m
          )
        );
      }

      if (!assistantContent.trim()) {
        // Remove empty assistant message if no content
        setMessages(prev => prev.filter(m => m.id !== assistantMsgId));
        setError('No response from AI. Check your API key and try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full p-6 gap-4">
      <div className="flex items-center justify-between">
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

      <div className="flex gap-4 flex-1 min-h-0">
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
                    <Input
                      type="password"
                      value={aiApiKey}
                      onChange={(e) => setAiApiKey(e.target.value)}
                      placeholder={`Enter your ${aiProvider === 'google' ? 'Gemini' : aiProvider === 'openai' ? 'OpenAI' : 'Anthropic'} API key`}
                    />
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
        <Card className="flex-1 flex flex-col min-h-0">
          <CardContent className="flex-1 flex flex-col p-4 min-h-0">
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
                      className={`max-w-[70%] rounded-lg px-4 py-2 ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <div className="whitespace-pre-wrap text-sm">
                        {message.content || (message.role === 'assistant' && isLoading ? '' : message.content)}
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
