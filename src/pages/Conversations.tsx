import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import { Search, Send, Paperclip, MoreVertical, Phone, Video, Plus, MessageSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function Conversations() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConversation, setActiveConversation] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const socketRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // New Conversation State
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);

  useEffect(() => {
    const companyId = localStorage.getItem('companyId');
    if (companyId) {
      fetchConversations(companyId);
      fetchContacts(companyId);
    }

    socketRef.current = io();
    
    socketRef.current.on('new_message', (msg: any) => {
      setMessages(prev => [...prev, msg]);
      scrollToBottom();
      if (companyId) fetchConversations(companyId); // Refresh list for latest message
    });

    return () => {
      socketRef.current.disconnect();
    };
  }, []);

  const fetchConversations = (companyId: string) => {
    fetch(`/api/conversations?companyId=${companyId}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setConversations(data);
          if (data.length > 0 && !activeConversation) setActiveConversation(data[0]);
        }
      })
      .catch(err => console.error(err));
  };

  const fetchContacts = (companyId: string) => {
    fetch(`/api/contacts?companyId=${companyId}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setContacts(data);
      })
      .catch(err => console.error(err));
  };

  useEffect(() => {
    if (activeConversation) {
      fetch(`/api/conversations/${activeConversation.id}/messages`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setMessages(data);
            scrollToBottom();
          }
        })
        .catch(err => console.error(err));
      
      socketRef.current.emit('join_conversation', activeConversation.id);
    }
    return () => {
      if (activeConversation) {
        socketRef.current.emit('leave_conversation', activeConversation.id);
      }
    };
  }, [activeConversation]);

  const scrollToBottom = () => {
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, 100);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeConversation) return;

    const userId = localStorage.getItem('userId');
    const msgData = {
      conversationId: activeConversation.id,
      content: newMessage,
      senderType: 'user',
      senderId: userId
    };

    setNewMessage("");
    await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(msgData)
    });
  };

  const startNewConversation = async (contactId: string) => {
    const companyId = localStorage.getItem('companyId');
    const userId = localStorage.getItem('userId');

    const res = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, contactId, userId })
    });
    const newConv = await res.json();
    
    setIsNewChatOpen(false);
    fetchConversations(companyId!);
    setActiveConversation(newConv);
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-white rounded-xl border shadow-sm overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 border-r flex flex-col bg-slate-50/50">
        <div className="p-4 border-b bg-white space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Mensagens</h3>
            <Dialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen}>
              <DialogTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" />}>
                <Plus className="h-5 w-5 text-blue-600" />
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nova Conversa</DialogTitle>
                </DialogHeader>
                <div className="pt-4 space-y-2">
                  <Input placeholder="Buscar contato..." className="mb-4" />
                  <ScrollArea className="h-64">
                    {contacts.map(contact => (
                      <div 
                        key={contact.id} 
                        className="flex items-center gap-3 p-3 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                        onClick={() => startNewConversation(contact.id)}
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-blue-100 text-blue-700">
                            {contact?.name?.substring(0, 2).toUpperCase() || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm text-slate-900">{contact.name}</p>
                          <p className="text-xs text-slate-500">{contact.phone}</p>
                        </div>
                      </div>
                    ))}
                    {contacts.length === 0 && (
                      <div className="text-center text-slate-500 py-8 text-sm">
                        Nenhum contato encontrado. Adicione leads no Funil de Vendas.
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input placeholder="Buscar conversas..." className="pl-9 bg-slate-100 border-none h-9" />
          </div>
        </div>
        <ScrollArea className="flex-1">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => setActiveConversation(conv)}
              className={`p-4 border-b cursor-pointer hover:bg-slate-100 transition-colors ${
                activeConversation?.id === conv.id ? 'bg-blue-50/50 border-l-4 border-l-blue-600' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback className="bg-blue-100 text-blue-700">
                    {conv?.contact?.name?.substring(0, 2).toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 overflow-hidden">
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="font-semibold text-sm truncate">{conv?.contact?.name || 'Desconhecido'}</h4>
                    <span className="text-xs text-slate-500">
                      {conv.messages && conv.messages[0] ? format(new Date(conv.messages[0].createdAt), 'HH:mm') : ''}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 truncate">
                    {conv.messages && conv.messages[0]?.content ? conv.messages[0].content : 'Nenhuma mensagem'}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </ScrollArea>
      </div>

      {/* Chat Area */}
      {activeConversation ? (
        <div className="flex-1 flex flex-col bg-[#efeae2]">
          {/* Chat Header */}
          <div className="h-16 bg-white border-b flex items-center justify-between px-6 shadow-sm z-10">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback className="bg-blue-100 text-blue-700">
                  {activeConversation?.contact?.name?.substring(0, 2).toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold text-slate-900">{activeConversation?.contact?.name || 'Desconhecido'}</h3>
                <p className="text-xs text-slate-500">{activeConversation?.contact?.phone || ''}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-slate-500">
              <Button variant="ghost" size="icon"><Phone className="h-5 w-5" /></Button>
              <Button variant="ghost" size="icon"><Video className="h-5 w-5" /></Button>
              <Button variant="ghost" size="icon"><MoreVertical className="h-5 w-5" /></Button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4" ref={scrollRef}>
            {messages.map((msg) => {
              const isUser = msg.senderType === 'user';
              return (
                <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[70%] rounded-lg p-3 shadow-sm ${
                      isUser 
                        ? 'bg-[#d9fdd3] text-slate-900 rounded-tr-none' 
                        : 'bg-white text-slate-900 rounded-tl-none'
                    }`}
                  >
                    <p className="text-sm">{msg.content}</p>
                    <div className="text-[10px] text-slate-500 text-right mt-1">
                      {format(new Date(msg.createdAt), 'HH:mm')}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Input Area */}
          <div className="p-4 bg-slate-100 flex items-center gap-2 border-t">
            <Button variant="ghost" size="icon" className="text-slate-500 shrink-0">
              <Paperclip className="h-5 w-5" />
            </Button>
            <form onSubmit={sendMessage} className="flex-1 flex gap-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Digite uma mensagem..."
                className="flex-1 bg-white border-none shadow-sm focus-visible:ring-1 focus-visible:ring-blue-500"
              />
              <Button type="submit" size="icon" className="bg-blue-600 hover:bg-blue-700 shrink-0">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-slate-50">
          <div className="text-center text-slate-500">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>Selecione uma conversa para começar</p>
          </div>
        </div>
      )}
    </div>
  );
}
