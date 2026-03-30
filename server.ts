import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode';

const prisma = new PrismaClient();

let whatsappClient: Client | null = null;
let qrCodeData: string | null = null;
let isWhatsAppConnected = false;

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  function initializeWhatsApp() {
    whatsappClient = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    });

    whatsappClient.on('qr', async (qr) => {
      try {
        qrCodeData = await qrcode.toDataURL(qr);
        io.emit('whatsapp_qr', { qr: qrCodeData });
      } catch (err) {
        console.error('Failed to generate QR code', err);
      }
    });

    whatsappClient.on('ready', () => {
      isWhatsAppConnected = true;
      qrCodeData = null;
      io.emit('whatsapp_ready');
      console.log('WhatsApp is ready!');
    });

    whatsappClient.on('disconnected', () => {
      isWhatsAppConnected = false;
      qrCodeData = null;
      io.emit('whatsapp_disconnected');
      console.log('WhatsApp disconnected!');
      initializeWhatsApp();
    });

    whatsappClient.on('message', async (message) => {
      if (message.from === 'status@broadcast') return;
      
      try {
        const company = await prisma.company.findFirst();
        if (!company) return;

        const phone = message.from.replace('@c.us', '');
        const contactName = (message as any)._data?.notifyName || phone;

        let contact = await prisma.contact.findFirst({
          where: { companyId: company.id, phone }
        });

        if (!contact) {
          contact = await prisma.contact.create({
            data: {
              companyId: company.id,
              name: contactName,
              phone
            }
          });
        }

        let conversation = await prisma.conversation.findFirst({
          where: { companyId: company.id, contactId: contact.id, status: 'open' }
        });

        if (!conversation) {
          conversation = await prisma.conversation.create({
            data: {
              companyId: company.id,
              contactId: contact.id,
              status: 'open'
            }
          });
        }

        const newMessage = await prisma.message.create({
          data: {
            conversationId: conversation.id,
            senderType: 'client',
            senderId: contact.id,
            content: message.body,
            type: 'text'
          }
        });

        io.emit('new_message', newMessage);
      } catch (err) {
        console.error('Error handling incoming message:', err);
      }
    });

    whatsappClient.initialize().catch(err => console.error('WhatsApp init error:', err));
  }

  initializeWhatsApp();

  app.use(cors());
  app.use(express.json());

  // WhatsApp API Routes
  app.get('/api/whatsapp/status', (req, res) => {
    res.json({
      connected: isWhatsAppConnected,
      qr: qrCodeData
    });
  });

  app.post('/api/whatsapp/disconnect', async (req, res) => {
    if (whatsappClient) {
      await whatsappClient.logout();
      isWhatsAppConnected = false;
      qrCodeData = null;
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Not initialized' });
    }
  });

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Seed initial data for preview
  app.post('/api/seed', async (req, res) => {
    try {
      const companyCount = await prisma.company.count();
      if (companyCount === 0) {
        const company = await prisma.company.create({
          data: { name: 'Empresa Demo' }
        });
        
        const user = await prisma.user.create({
          data: {
            companyId: company.id,
            name: 'Admin',
            email: 'admin@empresa.com',
            role: 'admin'
          }
        });

        const pipeline = await prisma.pipeline.create({
          data: {
            companyId: company.id,
            name: 'Funil de Vendas',
            stages: {
              create: [
                { name: 'Lead', order: 1, color: '#3b82f6', probability: 10 },
                { name: 'Contato Feito', order: 2, color: '#eab308', probability: 30 },
                { name: 'Proposta', order: 3, color: '#f97316', probability: 60 },
                { name: 'Ganho', order: 4, color: '#22c55e', probability: 100, isFinal: true },
                { name: 'Perdido', order: 5, color: '#ef4444', probability: 0, isFinal: true }
              ]
            }
          }
        });

        const contact = await prisma.contact.create({
          data: {
            companyId: company.id,
            name: 'João Silva',
            phone: '5511999999999',
            email: 'joao@exemplo.com'
          }
        });

        const stages = await prisma.pipelineStage.findMany({ where: { pipelineId: pipeline.id }, orderBy: { order: 'asc' } });
        
        await prisma.pipelineMovement.create({
          data: {
            contactId: contact.id,
            stageId: stages[0].id,
            userId: user.id,
            value: 5000
          }
        });

        res.json({ message: 'Seeded successfully', companyId: company.id, userId: user.id });
      } else {
        const company = await prisma.company.findFirst();
        const user = await prisma.user.findFirst();
        res.json({ message: 'Already seeded', companyId: company?.id, userId: user?.id });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to seed' });
    }
  });

  // Dashboard Metrics
  app.get('/api/metrics', async (req, res) => {
    try {
      const { companyId } = req.query;
      if (!companyId) return res.status(400).json({ error: 'companyId is required' });

      const totalContacts = await prisma.contact.count({ where: { companyId: String(companyId) } });
      const totalConversations = await prisma.conversation.count({ where: { companyId: String(companyId) } });
      const activeConversations = await prisma.conversation.count({ where: { companyId: String(companyId), status: 'open' } });
      
      const messages = await prisma.message.count({
        where: { conversation: { companyId: String(companyId) } }
      });

      res.json({
        totalContacts,
        totalConversations,
        activeConversations,
        totalMessages: messages
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch metrics' });
    }
  });

  // Contacts
  app.get('/api/contacts', async (req, res) => {
    try {
      const { companyId } = req.query;
      const contacts = await prisma.contact.findMany({ 
        where: { companyId: String(companyId) },
        orderBy: { createdAt: 'desc' }
      });
      res.json(contacts);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch contacts' });
    }
  });

  app.post('/api/contacts', async (req, res) => {
    try {
      const { companyId, name, phone, email, stageId, userId, value } = req.body;
      const contact = await prisma.contact.create({
        data: { companyId, name, phone, email }
      });

      if (stageId) {
        await prisma.pipelineMovement.create({
          data: {
            contactId: contact.id,
            stageId,
            userId,
            value: Number(value) || 0
          }
        });
        io.emit('pipeline_update', { type: 'new_lead' });
      }

      res.json(contact);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to create contact' });
    }
  });

  // Pipeline Data
  app.get('/api/pipelines', async (req, res) => {
    try {
      const { companyId } = req.query;
      if (!companyId) return res.status(400).json({ error: 'companyId is required' });

      const pipelines = await prisma.pipeline.findMany({
        where: { companyId: String(companyId) },
        include: {
          stages: {
            orderBy: { order: 'asc' },
            include: {
              movements: {
                where: { exitedAt: null },
                include: { contact: true }
              }
            }
          }
        }
      });
      res.json(pipelines);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch pipelines' });
    }
  });

  app.post('/api/pipelines', async (req, res) => {
    try {
      const { companyId, name } = req.body;
      const pipeline = await prisma.pipeline.create({
        data: { companyId, name }
      });
      io.emit('pipeline_update', { type: 'new_pipeline' });
      res.json(pipeline);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create pipeline' });
    }
  });

  app.post('/api/pipelines/stages', async (req, res) => {
    try {
      const { pipelineId, name, color } = req.body;
      const count = await prisma.pipelineStage.count({ where: { pipelineId } });
      const stage = await prisma.pipelineStage.create({
        data: { pipelineId, name, color, order: count + 1 }
      });
      io.emit('pipeline_update', { type: 'new_stage' });
      res.json(stage);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create stage' });
    }
  });

  app.delete('/api/pipelines/stages/:id', async (req, res) => {
    try {
      const { id } = req.params;
      
      // Check if there are active movements
      const activeMovements = await prisma.pipelineMovement.count({
        where: { stageId: id, exitedAt: null }
      });

      if (activeMovements > 0) {
        return res.status(400).json({ error: 'Cannot delete stage with active leads' });
      }

      await prisma.pipelineStage.delete({ where: { id } });
      io.emit('pipeline_update', { type: 'delete_stage' });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete stage' });
    }
  });

  // Move Contact in Pipeline
  app.post('/api/pipelines/move', async (req, res) => {
    try {
      const { movementId, newStageId, userId } = req.body;
      
      const currentMovement = await prisma.pipelineMovement.findUnique({ where: { id: movementId } });
      if (!currentMovement) return res.status(404).json({ error: 'Movement not found' });

      // Close current movement
      await prisma.pipelineMovement.update({
        where: { id: movementId },
        data: { exitedAt: new Date() }
      });

      // Create new movement
      const newMovement = await prisma.pipelineMovement.create({
        data: {
          contactId: currentMovement.contactId,
          stageId: newStageId,
          userId: userId,
          value: currentMovement.value
        },
        include: { contact: true }
      });

      io.emit('pipeline_update', { type: 'move', movement: newMovement });
      res.json(newMovement);
    } catch (error) {
      res.status(500).json({ error: 'Failed to move contact' });
    }
  });

  // Conversations
  app.get('/api/conversations', async (req, res) => {
    try {
      const { companyId } = req.query;
      if (!companyId) return res.status(400).json({ error: 'companyId is required' });

      const conversations = await prisma.conversation.findMany({
        where: { companyId: String(companyId) },
        include: { contact: true, messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
        orderBy: { updatedAt: 'desc' }
      });
      res.json(conversations);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch conversations' });
    }
  });

  app.post('/api/conversations', async (req, res) => {
    try {
      const { companyId, contactId, userId } = req.body;
      let conv = await prisma.conversation.findFirst({
        where: { companyId, contactId, status: 'open' },
        include: { contact: true, messages: { orderBy: { createdAt: 'desc' }, take: 1 } }
      });

      if (!conv) {
        conv = await prisma.conversation.create({
          data: { companyId, contactId, userId },
          include: { contact: true, messages: true }
        });
      }
      res.json(conv);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create conversation' });
    }
  });

  app.get('/api/conversations/:id/messages', async (req, res) => {
    try {
      const messages = await prisma.message.findMany({
        where: { conversationId: req.params.id },
        orderBy: { createdAt: 'asc' }
      });
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  });

  app.post('/api/messages', async (req, res) => {
    try {
      const { conversationId, content, senderType, senderId } = req.body;
      const message = await prisma.message.create({
        data: { conversationId, content, senderType, senderId }
      });
      
      const conversation = await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
        include: { contact: true }
      });

      // Send via WhatsApp if connected
      if (whatsappClient && isWhatsAppConnected && senderType === 'agent') {
        const phone = conversation.contact.phone;
        const chatId = `${phone}@c.us`;
        try {
          await whatsappClient.sendMessage(chatId, content);
        } catch (err) {
          console.error('Failed to send WhatsApp message:', err);
        }
      }

      io.to(conversationId).emit('new_message', message);
      res.json(message);
    } catch (error) {
      res.status(500).json({ error: 'Failed to send message' });
    }
  });

  // Users
  app.get('/api/users', async (req, res) => {
    try {
      const { companyId } = req.query;
      const users = await prisma.user.findMany({ where: { companyId: String(companyId) } });
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  app.post('/api/users', async (req, res) => {
    try {
      const { companyId, name, email, role } = req.body;
      const user = await prisma.user.create({
        data: { companyId, name, email, role }
      });
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create user' });
    }
  });

  app.delete('/api/users/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await prisma.user.delete({ where: { id } });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete user' });
    }
  });

  // WebSocket
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    socket.on('join_conversation', (conversationId) => {
      socket.join(conversationId);
    });

    socket.on('leave_conversation', (conversationId) => {
      socket.leave(conversationId);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
