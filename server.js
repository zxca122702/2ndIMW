const express = require('express');
const session = require('express-session');
const path = require('path');
const { initializeDatabase, authenticateUser, sql } = require('./database');
const {
  initializeInventoryTable,
  getAllInventoryItems,
  getInventoryItemById,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  deleteMultipleInventoryItems,
  getAllCategories,
  getAllWarehouses,
  getInventoryStats,
  updateItemQuantity
} = require('./inventory');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'fox-control-hub-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true if using HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  } else {
    return res.redirect('/login.html');
  }
};

// Routes

// Root route - redirect to login if not authenticated, otherwise to inventory
app.get('/', (req, res) => {
  if (req.session && req.session.user) {
    res.redirect('/inventory.html');
  } else {
    res.redirect('/login.html');
  }
});

// Login page
app.get('/login.html', (req, res) => {
  if (req.session && req.session.user) {
    res.redirect('/inventory.html');
  } else {
    res.sendFile(path.join(__dirname, 'login.html'));
  }
});

// Login POST route
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const user = await authenticateUser(username, password);
    
    if (user) {
      req.session.user = user;
      res.json({ success: true, message: 'Login successful' });
    } else {
      res.status(401).json({ success: false, message: 'Invalid username or password' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Logout route
app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Could not log out' });
    }
    res.json({ success: true, message: 'Logout successful' });
  });
});

// Protected routes - require authentication
app.get('/inventory.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'Inventory.html'));
});

app.get('/barcode.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'Barcode.html'));
});

app.get('/materialshipments.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'MaterialShipments.html'));
});

app.get('/ordershipments.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'OrderShipments.html'));
});

app.get('/reports.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'Reports.html'));
});

app.get('/stocktracking.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'StockTracking.html'));
});

app.get('/warehouselayandopti.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'WarehouseLayAndOpti.html'));
});

// API route to get current user info
app.get('/api/user', requireAuth, (req, res) => {
  res.json({
    username: req.session.user.username,
    role: req.session.user.role
  });
});

// Express route
app.get('/api/user', requireAuth, (req, res) => {
  // Only return admin user info
  if (req.user && req.user.role === 'admin') {
    res.json({ success: true, data: req.user });
  } else {
    res.status(403).json({ success: false, message: 'Forbidden' });
  }
});

// API route to check database connection status
app.get('/api/db-status', async (req, res) => {
  try {
    const result = await sql`SELECT current_database(), version()`;
    
    res.json({
      connected: true,
      database: result[0].current_database,
      host: 'Neon PostgreSQL Serverless',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database status check failed:', error);
    res.json({
      connected: false,
      error: 'Connection failed',
      timestamp: new Date().toISOString()
    });
  }
});

// API: Get all inventory items
app.get('/api/inventory', requireAuth, async (req, res) => {
  try {
    const items = await getAllInventoryItems();
    res.json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch inventory items' });
  }
});

app.get('/api/inventory/:id', requireAuth, async (req, res) => {
  try {
    const item = await getInventoryItemById(req.params.id);
    if (item) {
      res.json({ success: true, data: item });
    } else {
      res.status(404).json({ success: false, message: 'Item not found' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch item' });
  }
});

// API: Insert new inventory item
app.post('/api/inventory', requireAuth, async (req, res) => {
  try {
    const newItem = await createInventoryItem(req.body);
    res.json({ success: true, message: 'Item inserted successfully', data: newItem });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to insert item' });
  }
});

// API: Update existing inventory item
app.post('/api/inventory/delete-multiple', requireAuth, async (req, res) => {
  try {
    const { ids } = req.body;
    await deleteMultipleInventoryItems(ids);
    res.json({ success: true, message: 'Items deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete items' });
  }
});

// API: Delete inventory item
app.put('/api/inventory/:id', requireAuth, async (req, res) => {
  try {
    const updatedItem = await updateInventoryItem(req.params.id, req.body);
    res.json({ success: true, message: 'Item updated successfully', data: updatedItem });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update item' });
  }
});

// API: Get all categories
app.get('/api/categories', requireAuth, async (req, res) => {
  try {
    const categories = await getAllCategories();
    res.json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch categories' });
  }
});

// API: Get all warehouses
app.get('/api/warehouses', requireAuth, async (req, res) => {
  try {
    const warehouses = await getAllWarehouses();
    res.json({ success: true, data: warehouses });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch warehouses' });
  }
});

// Test route to get all inventory items without authentication
app.get('/api/test-inventory', async (req, res) => {
  try {
    const items = await getAllInventoryItems();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Initialize database and start server
const startServer = async () => {
  try {
    await initializeDatabase();
    
    app.listen(PORT, () => {
      console.log(`🚀 Fox Control Hub server running on http://localhost:${PORT}`);
      console.log(`📝 Default login credentials:`);
      console.log(`   Username: admin`);
      console.log(`   Password: admin`);
      console.log(`🗄️ Database: Connected to Neon PostgreSQL`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
