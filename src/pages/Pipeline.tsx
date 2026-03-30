import { useEffect, useState } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { MoreHorizontal, Plus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { io } from "socket.io-client";

export function Pipeline() {
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [activePipeline, setActivePipeline] = useState<any>(null);
  
  // State for adding new stage
  const [isStageDialogOpen, setIsStageDialogOpen] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const [newStageColor, setNewStageColor] = useState("#3b82f6");

  // State for adding new lead
  const [isLeadDialogOpen, setIsLeadDialogOpen] = useState(false);
  const [newLeadName, setNewLeadName] = useState("");
  const [newLeadPhone, setNewLeadPhone] = useState("");
  const [newLeadValue, setNewLeadValue] = useState("");
  const [selectedStageId, setSelectedStageId] = useState("");

  useEffect(() => {
    const companyId = localStorage.getItem('companyId');
    if (companyId) {
      fetchPipelines(companyId);
    }

    const socket = io();
    socket.on('pipeline_update', () => {
      if (companyId) fetchPipelines(companyId);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const fetchPipelines = (companyId: string) => {
    fetch(`/api/pipelines?companyId=${companyId}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setPipelines(data);
          if (data.length > 0 && !activePipeline) {
            setActivePipeline(data[0]);
          } else if (activePipeline) {
            const updated = data.find((p: any) => p.id === activePipeline.id);
            if (updated) setActivePipeline(updated);
          }
        } else {
          console.error("Failed to fetch pipelines:", data);
        }
      })
      .catch(err => console.error(err));
  };

  const onDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    // Optimistic update
    const newPipeline = { ...activePipeline };
    const sourceStage = newPipeline.stages.find((s: any) => s.id === source.droppableId);
    const destStage = newPipeline.stages.find((s: any) => s.id === destination.droppableId);
    
    const [movedItem] = sourceStage.movements.splice(source.index, 1);
    destStage.movements.splice(destination.index, 0, movedItem);
    setActivePipeline(newPipeline);

    // API call
    const userId = localStorage.getItem('userId');
    await fetch('/api/pipelines/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        movementId: movedItem.id,
        newStageId: destination.droppableId,
        userId
      })
    });
  };

  const handleCreateStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStageName || !activePipeline) return;

    await fetch('/api/pipelines/stages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pipelineId: activePipeline.id,
        name: newStageName,
        color: newStageColor
      })
    });

    setNewStageName("");
    setIsStageDialogOpen(false);
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeadName || !newLeadPhone || !selectedStageId) return;

    const companyId = localStorage.getItem('companyId');
    const userId = localStorage.getItem('userId');

    await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId,
        name: newLeadName,
        phone: newLeadPhone,
        stageId: selectedStageId,
        userId,
        value: Number(newLeadValue) || 0
      })
    });

    setNewLeadName("");
    setNewLeadPhone("");
    setNewLeadValue("");
    setIsLeadDialogOpen(false);
  };

  if (pipelines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <h2 className="text-2xl font-bold tracking-tight mb-2">Nenhum funil encontrado</h2>
        <p className="text-slate-500 mb-4">Você ainda não tem nenhum funil de vendas configurado.</p>
        <p className="text-sm text-slate-400">Acesse as Configurações para criar seu primeiro funil.</p>
      </div>
    );
  }

  if (!activePipeline) return <div className="p-6">Carregando funil...</div>;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold tracking-tight">Funil de Vendas</h2>
          {pipelines.length > 1 && (
            <Select 
              value={activePipeline.id} 
              onValueChange={(val) => setActivePipeline(pipelines.find(p => p.id === val))}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Selecione um funil" />
              </SelectTrigger>
              <SelectContent>
                {pipelines.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {pipelines.length === 1 && (
            <span className="text-lg text-slate-500">/ {activePipeline.name}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={isLeadDialogOpen} onOpenChange={setIsLeadDialogOpen}>
            <DialogTrigger render={
              <Button variant="outline" size="sm">
                <UserPlus className="mr-2 h-4 w-4" />
                Novo Lead
              </Button>
            } />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Novo Lead</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateLead} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Nome do Contato</Label>
                  <Input value={newLeadName} onChange={e => setNewLeadName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Telefone (WhatsApp)</Label>
                  <Input value={newLeadPhone} onChange={e => setNewLeadPhone(e.target.value)} required placeholder="Ex: 5511999999999" />
                </div>
                <div className="space-y-2">
                  <Label>Valor Estimado (R$)</Label>
                  <Input type="number" value={newLeadValue} onChange={e => setNewLeadValue(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Etapa Inicial</Label>
                  <select 
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={selectedStageId} 
                    onChange={e => setSelectedStageId(e.target.value)} 
                    required
                  >
                    <option value="" disabled>Selecione uma etapa</option>
                    {activePipeline.stages?.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <Button type="submit" className="w-full">Salvar Lead</Button>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isStageDialogOpen} onOpenChange={setIsStageDialogOpen}>
            <DialogTrigger render={
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Nova Etapa
              </Button>
            } />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Nova Etapa</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateStage} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Nome da Etapa</Label>
                  <Input value={newStageName} onChange={e => setNewStageName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Cor</Label>
                  <div className="flex gap-2">
                    <Input type="color" value={newStageColor} onChange={e => setNewStageColor(e.target.value)} className="w-16 p-1" />
                    <Input value={newStageColor} onChange={e => setNewStageColor(e.target.value)} className="flex-1" />
                  </div>
                </div>
                <Button type="submit" className="w-full">Criar Etapa</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto pb-4">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-4 h-full items-start">
            {activePipeline.stages?.map((stage: any) => (
              <div key={stage.id} className="w-80 shrink-0 flex flex-col h-full max-h-full">
                <div 
                  className="flex items-center justify-between p-3 rounded-t-lg border-b-2"
                  style={{ borderBottomColor: stage.color, backgroundColor: 'white' }}
                >
                  <div className="font-semibold text-sm flex items-center gap-2">
                    {stage.name}
                    <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs">
                      {stage.movements?.length || 0}
                    </span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>

                <Droppable droppableId={stage.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 overflow-y-auto p-2 rounded-b-lg transition-colors ${
                        snapshot.isDraggingOver ? 'bg-slate-100' : 'bg-slate-50/50'
                      }`}
                    >
                      {stage.movements?.map((movement: any, index: number) => (
                        <Draggable key={movement.id} draggableId={movement.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`mb-2 bg-white p-3 rounded-md shadow-sm border border-slate-200 ${
                                snapshot.isDragging ? 'shadow-md ring-2 ring-blue-500/20' : ''
                              }`}
                            >
                              <div className="font-medium text-sm text-slate-900">
                                {movement.contact?.name || 'Desconhecido'}
                              </div>
                              <div className="text-xs text-slate-500 mt-1">
                                {movement.contact?.phone || ''}
                              </div>
                              {movement.value > 0 && (
                                <div className="mt-3 text-sm font-semibold text-emerald-600">
                                  R$ {movement.value.toLocaleString('pt-BR')}
                                </div>
                              )}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </DragDropContext>
      </div>
    </div>
  );
}
