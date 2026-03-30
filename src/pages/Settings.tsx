import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Building2, Users, KanbanSquare, Smartphone, Trash2, Plus } from "lucide-react";
import { io } from "socket.io-client";

export function Settings() {
  const [users, setUsers] = useState<any[]>([]);
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [newUser, setNewUser] = useState({ name: "", email: "", role: "agent" });
  const [whatsappStatus, setWhatsappStatus] = useState<{ connected: boolean; qr: string | null }>({ connected: false, qr: null });
  const [selectedPipeline, setSelectedPipeline] = useState<any>(null);
  const [isPipelineDialogOpen, setIsPipelineDialogOpen] = useState(false);
  const [newStage, setNewStage] = useState({ name: "", color: "#3b82f6" });
  const [isNewPipelineDialogOpen, setIsNewPipelineDialogOpen] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState("");

  useEffect(() => {
    const companyId = localStorage.getItem('companyId');
    if (companyId) {
      fetchUsers(companyId);
      fetchPipelines(companyId);
    }

    fetchWhatsappStatus();

    const socket = io();
    socket.on('whatsapp_qr', (data) => setWhatsappStatus({ connected: false, qr: data.qr }));
    socket.on('whatsapp_ready', () => setWhatsappStatus({ connected: true, qr: null }));
    socket.on('whatsapp_disconnected', () => setWhatsappStatus({ connected: false, qr: null }));

    return () => {
      socket.disconnect();
    };
  }, []);

  const fetchWhatsappStatus = () => {
    fetch('/api/whatsapp/status')
      .then(res => res.json())
      .then(data => setWhatsappStatus(data))
      .catch(err => console.error(err));
  };

  const handleDisconnectWhatsapp = async () => {
    await fetch('/api/whatsapp/disconnect', { method: 'POST' });
    fetchWhatsappStatus();
  };

  const fetchUsers = (companyId: string) => {
    fetch(`/api/users?companyId=${companyId}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setUsers(data);
      })
      .catch(err => console.error(err));
  };

  const fetchPipelines = (companyId: string) => {
    fetch(`/api/pipelines?companyId=${companyId}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setPipelines(data);
      })
      .catch(err => console.error(err));
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const companyId = localStorage.getItem('companyId');
    
    await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newUser, companyId })
    });
    
    setNewUser({ name: "", email: "", role: "agent" });
    fetchUsers(companyId!);
  };

  const handleDeleteUser = async (userId: string) => {
    if (users.length <= 1) {
      alert("Você não pode remover o último usuário da empresa.");
      return;
    }
    if (confirm("Tem certeza que deseja remover este usuário?")) {
      await fetch(`/api/users/${userId}`, { method: 'DELETE' });
      fetchUsers(localStorage.getItem('companyId')!);
    }
  };

  const handleCreateStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPipeline || !newStage.name) return;

    await fetch('/api/pipelines/stages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pipelineId: selectedPipeline.id,
        name: newStage.name,
        color: newStage.color
      })
    });

    setNewStage({ name: "", color: "#3b82f6" });
    fetchPipelines(localStorage.getItem('companyId')!);
    
    // Update selected pipeline locally to reflect changes immediately
    const updatedPipelines = await fetch(`/api/pipelines?companyId=${localStorage.getItem('companyId')}`).then(res => res.json());
    if (Array.isArray(updatedPipelines)) {
      setPipelines(updatedPipelines);
      const updatedSelected = updatedPipelines.find((p: any) => p.id === selectedPipeline.id);
      if (updatedSelected) setSelectedPipeline(updatedSelected);
    }
  };

  const handleDeleteStage = async (stageId: string) => {
    await fetch(`/api/pipelines/stages/${stageId}`, { method: 'DELETE' });
    fetchPipelines(localStorage.getItem('companyId')!);
    
    // Update selected pipeline locally
    const updatedPipelines = await fetch(`/api/pipelines?companyId=${localStorage.getItem('companyId')}`).then(res => res.json());
    if (Array.isArray(updatedPipelines)) {
      setPipelines(updatedPipelines);
      const updatedSelected = updatedPipelines.find((p: any) => p.id === selectedPipeline.id);
      if (updatedSelected) setSelectedPipeline(updatedSelected);
    }
  };

  const handleCreatePipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPipelineName) return;

    const companyId = localStorage.getItem('companyId');
    await fetch('/api/pipelines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newPipelineName, companyId })
    });

    setNewPipelineName("");
    setIsNewPipelineDialogOpen(false);
    fetchPipelines(companyId!);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-8">
          <TabsTrigger value="profile" className="flex gap-2"><Building2 size={16}/> Perfil da Empresa</TabsTrigger>
          <TabsTrigger value="users" className="flex gap-2"><Users size={16}/> Usuários e Equipe</TabsTrigger>
          <TabsTrigger value="pipelines" className="flex gap-2"><KanbanSquare size={16}/> Funis de Vendas</TabsTrigger>
          <TabsTrigger value="whatsapp" className="flex gap-2"><Smartphone size={16}/> WhatsApp</TabsTrigger>
        </TabsList>
        
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Dados da Empresa</CardTitle>
              <CardDescription>Gerencie as informações básicas da sua conta.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Nome da Empresa</Label>
                <Input id="companyName" defaultValue="Empresa Demo" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatsappNumber">Número Oficial do WhatsApp</Label>
                <Input id="whatsappNumber" defaultValue="+55 11 99999-9999" disabled />
                <p className="text-xs text-muted-foreground">Para alterar o número, entre em contato com o suporte.</p>
              </div>
              <Button className="mt-4">Salvar Alterações</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="md:col-span-1 h-fit">
              <CardHeader>
                <CardTitle>Adicionar Usuário</CardTitle>
                <CardDescription>Convide um novo membro para a equipe.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} required />
                  </div>
                  <div className="space-y-2">
                    <Label>E-mail</Label>
                    <Input type="email" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Perfil de Acesso</Label>
                    <Select value={newUser.role} onValueChange={v => setNewUser({...newUser, role: v})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="agent">Atendente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full">Adicionar</Button>
                </form>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Equipe Atual</CardTitle>
                <CardDescription>Gerencie os acessos dos seus colaboradores.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Perfil</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map(user => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                            {user.role === 'admin' ? 'Administrador' : 'Atendente'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDeleteUser(user.id)}
                          >
                            Remover
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="pipelines">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Gerenciamento de Funis</CardTitle>
                <CardDescription>Visualize os funis de vendas configurados para sua empresa.</CardDescription>
              </div>
              <Dialog open={isNewPipelineDialogOpen} onOpenChange={setIsNewPipelineDialogOpen}>
                <DialogTrigger render={
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Novo Funil
                  </Button>
                } />
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar Novo Funil</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreatePipeline} className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>Nome do Funil</Label>
                      <Input value={newPipelineName} onChange={e => setNewPipelineName(e.target.value)} required placeholder="Ex: Vendas B2B" />
                    </div>
                    <Button type="submit" className="w-full">Criar Funil</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome do Funil</TableHead>
                    <TableHead>Total de Etapas</TableHead>
                    <TableHead>Leads Ativos</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pipelines.map(pipeline => {
                    const totalLeads = pipeline.stages?.reduce((acc: number, stage: any) => acc + (stage.movements?.length || 0), 0) || 0;
                    return (
                      <TableRow key={pipeline.id}>
                        <TableCell className="font-medium">{pipeline.name}</TableCell>
                        <TableCell>{pipeline.stages?.length || 0} etapas</TableCell>
                        <TableCell>{totalLeads} leads</TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedPipeline(pipeline);
                              setIsPipelineDialogOpen(true);
                            }}
                          >
                            Editar Etapas
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="whatsapp">
          <Card>
            <CardHeader>
              <CardTitle>Conexão WhatsApp</CardTitle>
              <CardDescription>Escaneie o QR Code para conectar seu número.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-8">
              {whatsappStatus.connected ? (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                    <Smartphone size={32} />
                  </div>
                  <h3 className="text-xl font-semibold text-green-600">WhatsApp Conectado!</h3>
                  <p className="text-slate-500">Seu número está pronto para enviar e receber mensagens.</p>
                  <Button variant="destructive" onClick={handleDisconnectWhatsapp}>Desconectar</Button>
                </div>
              ) : whatsappStatus.qr ? (
                <div className="text-center space-y-4">
                  <div className="bg-white p-4 rounded-xl shadow-sm border inline-block">
                    <img src={whatsappStatus.qr} alt="WhatsApp QR Code" className="w-64 h-64" />
                  </div>
                  <p className="text-slate-500">Abra o WhatsApp no seu celular e escaneie o código acima.</p>
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
                  <p className="text-slate-500">Gerando QR Code...</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <Dialog open={isPipelineDialogOpen} onOpenChange={setIsPipelineDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Etapas: {selectedPipeline?.name}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 pt-4">
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Etapas Atuais</h4>
              <div className="space-y-2">
                {selectedPipeline?.stages?.map((stage: any) => (
                  <div key={stage.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: stage.color }}></div>
                      <span className="font-medium text-sm">{stage.name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-slate-500">{stage.movements?.length || 0} leads</span>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => handleDeleteStage(stage.id)}
                        disabled={stage.movements?.length > 0}
                        title={stage.movements?.length > 0 ? "Não é possível excluir etapa com leads" : "Excluir etapa"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {(!selectedPipeline?.stages || selectedPipeline.stages.length === 0) && (
                  <p className="text-sm text-slate-500 text-center py-4">Nenhuma etapa configurada.</p>
                )}
              </div>
            </div>

            <div className="pt-4 border-t">
              <h4 className="text-sm font-medium mb-4">Adicionar Nova Etapa</h4>
              <form onSubmit={handleCreateStage} className="flex items-end gap-4">
                <div className="flex-1 space-y-2">
                  <Label>Nome da Etapa</Label>
                  <Input value={newStage.name} onChange={e => setNewStage({ ...newStage, name: e.target.value })} required placeholder="Ex: Negociação" />
                </div>
                <div className="w-24 space-y-2">
                  <Label>Cor</Label>
                  <Input type="color" value={newStage.color} onChange={e => setNewStage({ ...newStage, color: e.target.value })} className="h-10 p-1" />
                </div>
                <Button type="submit" className="w-32">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar
                </Button>
              </form>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
