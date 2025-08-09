const express = require('express');
const session = require('express-session');
const path = require('path');
const { 
  initializeDatabase, 
  authenticateUser, 
  sql,
  createNotification,
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadNotificationCount
} = require('./database');
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
    return res.redirect('/loginpage.html');
  }
};

// Routes

// Root route - redirect to login if not authenticated, otherwise to inventory
app.get('/', (req, res) => {
  if (req.session && req.session.user) {
    res.redirect('/inventory.html');
  } else {
    res.redirect('/loginpage.html');
  }
});

// Login page
app.get('/login.html', (req, res) => {
  if (req.session && req.session.user) {
    res.redirect('/inventory.html');
  } else {
    res.sendFile(path.join(__dirname, 'loginpage.html'));
  }
});

app.get('/loginpage.html', (req, res) => {
  if (req.session && req.session.user) {
    res.redirect('/inventory.html');
  } else {
    res.sendFile(path.join(__dirname, 'loginpage.html'));
  }
});

// Login POST route
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    let user;
    try {
      user = await authenticateUser(username, password);
    } catch (dbError) {
      // Mock authentication if database is not available
      if (username === 'admin' && password === 'admin') {
        user = { id: 1, username: 'admin', role: 'admin' };
      }
    }
    
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
    success: true,
    data: {
      username: req.session.user.username,
      role: req.session.user.role
    }
  });
});

// Notification API endpoints
app.get('/api/notifications', requireAuth, async (req, res) => {
  try {
    const notifications = await getNotifications(20);
    res.json({ success: true, data: notifications });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
});

app.get('/api/notifications/count', requireAuth, async (req, res) => {
  try {
    const count = await getUnreadNotificationCount();
    res.json({ success: true, count: count });
  } catch (error) {
    console.error('Get notification count error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch notification count' });
  }
});

app.post('/api/notifications/:id/read', requireAuth, async (req, res) => {
  try {
    const success = await markNotificationAsRead(req.params.id);
    if (success) {
      res.json({ success: true, message: 'Notification marked as read' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to mark notification as read' });
    }
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({ success: false, message: 'Failed to mark notification as read' });
  }
});

app.post('/api/notifications/read-all', requireAuth, async (req, res) => {
  try {
    const success = await markAllNotificationsAsRead();
    if (success) {
      res.json({ success: true, message: 'All notifications marked as read' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to mark all notifications as read' });
    }
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({ success: false, message: 'Failed to mark all notifications as read' });
  }
});

// Test route to create a notification
app.post('/api/test-notification', requireAuth, async (req, res) => {
  try {
    const notification = await createNotification(
      'Test Notification',
      'This is a test notification to verify the system is working',
      'info'
    );
    res.json({ success: true, message: 'Test notification created', data: notification });
  } catch (error) {
    console.error('Test notification error:', error);
    res.status(500).json({ success: false, message: 'Failed to create test notification' });
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
    
    // Create notification for successful item addition
    try {
      await createNotification(
        'Item Added Successfully',
        `${newItem.name} has been added to inventory with SKU: ${newItem.sku}`,
        'success'
      );
    } catch (notifError) {
      console.error('Failed to create notification:', notifError);
    }
    
    res.json({ success: true, message: 'Item inserted successfully', data: newItem });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to insert item' });
  }
});

// API: Delete multiple inventory items
app.post('/api/inventory/delete-multiple', requireAuth, async (req, res) => {
  try {
    const { ids } = req.body;
    await deleteMultipleInventoryItems(ids);
    
    // Create notification for successful item deletion
    try {
      await createNotification(
        'Items Deleted Successfully',
        `${ids.length} item(s) have been deleted from inventory`,
        'warning'
      );
    } catch (notifError) {
      console.error('Failed to create notification:', notifError);
    }
    
    res.json({ success: true, message: 'Items deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete items' });
  }
});

// API: Update inventory item
app.put('/api/inventory/:id', requireAuth, async (req, res) => {
  try {
    const updatedItem = await updateInventoryItem(req.params.id, req.body);
    
    // Create notification for successful item update
    try {
      await createNotification(
        'Item Updated Successfully',
        `${updatedItem.name} (SKU: ${updatedItem.sku}) has been updated in inventory`,
        'info'
      );
    } catch (notifError) {
      console.error('Failed to create notification:', notifError);
    }
    
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
    // Try to initialize database, but don't fail if it doesn't work
    try {
      await initializeDatabase();
      console.log(`🗄️ Database: Connected to Neon PostgreSQL`);
    } catch (dbError) {
      console.log(`⚠️ Database connection failed, running in mock mode`);
    }
    
    app.listen(PORT, () => {
      console.log(`🚀 Fox Control Hub server running on http://localhost:${PORT}`);
      console.log(`📝 Default login credentials:`);
      console.log(`   Username: admin`);
      console.log(`   Password: admin`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

