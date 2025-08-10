const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

// Material Shipments Functions
async function getAllMaterialShipments(filters = {}) {
  const sql = await getSql();
  let query = 'SELECT * FROM material_shipments WHERE 1=1';
  const params = [];

  if (filters.search) {
    query += ' AND (material_name ILIKE $1 OR shipment_id ILIKE $1 OR source ILIKE $1)';
    params.push(`%${filters.search}%`);
  }
  if (filters.status) {
    query += ` AND status = $${params.length + 1}`;
    params.push(filters.status);
  }
  if (filters.type) {
    query += ` AND shipment_type = $${params.length + 1}`;
    params.push(filters.type);
  }
  if (filters.date) {
    query += ` AND date_shipped = $${params.length + 1}`;
    params.push(filters.date);
  }

  query += ' ORDER BY created_at DESC';
  return await sql.unsafe(query, params);
}

async function getMaterialShipmentById(id) {
  const sql = await getSql();
  const result = await sql`
    SELECT * FROM material_shipments WHERE id = ${id}
  `;
  return result[0];
}

async function createMaterialShipment(data) {
  const sql = await getSql();
  const result = await sql`
    INSERT INTO material_shipments (
      shipment_id, material_id, category_id, material_name,
      quantity, unit, shipment_type, source, destination,
      status, date_shipped, estimated_delivery, received_date,
      handled_by, notes
    ) VALUES (
      ${data.shipment_id}, ${data.material_id}, ${data.category_id}, ${data.material_name},
      ${data.quantity}, ${data.unit}, ${data.shipment_type}, ${data.source}, ${data.destination},
      ${data.status}, ${data.date_shipped}, ${data.estimated_delivery}, ${data.received_date},
      ${data.handled_by}, ${data.notes}
    )
    RETURNING *
  `;
  return result[0];
}

async function updateMaterialShipment(id, data) {
  const sql = await getSql();
  const result = await sql`
    UPDATE material_shipments SET
      shipment_id = ${data.shipment_id},
      material_id = ${data.material_id},
      category_id = ${data.category_id},
      material_name = ${data.material_name},
      quantity = ${data.quantity},
      unit = ${data.unit},
      shipment_type = ${data.shipment_type},
      source = ${data.source},
      destination = ${data.destination},
      status = ${data.status},
      date_shipped = ${data.date_shipped},
      estimated_delivery = ${data.estimated_delivery},
      received_date = ${data.received_date},
      handled_by = ${data.handled_by},
      notes = ${data.notes},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${id}
    RETURNING *
  `;
  return result[0];
}

async function deleteMaterialShipment(id) {
  const sql = await getSql();
  const result = await sql`
    DELETE FROM material_shipments WHERE id = ${id}
    RETURNING *
  `;
  return result[0];
}

async function getMaterialShipmentStats() {
  const sql = await getSql();
  const stats = await Promise.all([
    sql`SELECT COUNT(*) as total FROM material_shipments`,
    sql`SELECT COUNT(*) as delivered FROM material_shipments WHERE status = 'delivered'`,
    sql`SELECT COUNT(*) as pending FROM material_shipments WHERE status = 'pending'`,
    sql`SELECT COUNT(*) as shipped FROM material_shipments WHERE status = 'shipped'`,
    sql`SELECT COUNT(*) as inbound FROM material_shipments WHERE shipment_type = 'inbound'`,
    sql`SELECT COUNT(*) as outbound FROM material_shipments WHERE shipment_type = 'outbound'`
  ]);

  return {
    totalShipments: parseInt(stats[0][0].total),
    deliveredShipments: parseInt(stats[1][0].delivered),
    pendingShipments: parseInt(stats[2][0].pending),
    shippedShipments: parseInt(stats[3][0].shipped),
    inboundShipments: parseInt(stats[4][0].inbound),
    outboundShipments: parseInt(stats[5][0].outbound)
  };
}

let sql = null;
let connectionPromise = null;

// Initialize database connection
async function initializeConnection() {
  if (!connectionPromise) {
    connectionPromise = (async () => {
      if (process.env.DATABASE_URL) {
        try {
          console.log('Attempting to connect to database...');
          const connection = neon(process.env.DATABASE_URL);
          // Test connection with more detailed error handling
          try {
            await connection`SELECT 1`;
            sql = connection;
            module.exports.sql = async () => connection;
            console.log('✅ Database connection initialized successfully');
            return connection;
          } catch (testError) {
            console.error('Connection test failed:', testError.message);
            throw testError;
          }
        } catch (error) {
          console.error('⚠️ Database connection failed:');
          console.error('Error type:', error.name);
          console.error('Error message:', error.message);
          if (error.code) console.error('Error code:', error.code);
          if (error.stack) console.error('Stack trace:', error.stack);
          sql = null;
        }
      } else {
        console.log('⚠️ No DATABASE_URL found, running in mock mode');
        sql = null;
      }
      return sql;
    })();
  }
  return connectionPromise;
}

// Get SQL connection
async function getSql() {
  if (!sql) {
    await initializeConnection();
  }
  return sql;
}

// Test database connection and create tables
const testConnection = async () => {
  const connection = await getSql();
  if (!connection) {
    console.log('⚠️ Database not available, skipping table creation');
    return;
  }
  
  try {
    const result = await connection`SELECT version()`;
    console.log('✅ Connected to Neon database successfully');
    console.log(`Database version: ${result[0].version}`);
    
    // Create users table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    // Create notifications table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        title VARCHAR(100) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(20) DEFAULT 'info',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_read BOOLEAN DEFAULT false
      )
    `;
    
    // Create scan history table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS scan_history (
        id SERIAL PRIMARY KEY,
        scanned_code VARCHAR(100) NOT NULL,
        scan_type VARCHAR(20) DEFAULT 'barcode',
        item_id INTEGER,
        product_name VARCHAR(255),
        quantity INTEGER DEFAULT 1,
        scan_status VARCHAR(20) DEFAULT 'found',
        scanned_by VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        notes TEXT
      )
    `;
    
    console.log('✅ Users, notifications, and scan history tables created/verified');
  } catch (err) {
    console.error('❌ Database connection error:', err);
  }
};

// Initialize database
const initializeDatabase = async () => {
  try {
    await testConnection();
    
    // Check if admin user exists, if not create it
    const adminCheck = await sql`SELECT * FROM users WHERE username = 'admin'`;
    
    if (adminCheck.length === 0) {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('admin', 10);
      
      await sql`
        INSERT INTO users (username, password, role) 
        VALUES ('admin', ${hashedPassword}, 'admin')
      `;
      
      console.log('✅ Default admin user created (username: admin, password: admin)');
    } else {
      console.log('✅ Admin user already exists');
    }
    
    // Initialize inventory tables
    const { initializeInventoryTable } = require('./inventory');
    await initializeInventoryTable();
    
  } catch (err) {
    console.error('❌ Database initialization error:', err);
  }
};

// User authentication functions
const authenticateUser = async (username, password) => {
  try {
    const result = await sql`SELECT * FROM users WHERE username = ${username}`;
    
    if (result.length === 0) {
      return null;
    }
    
    const user = result[0];
    const bcrypt = require('bcryptjs');
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (isValidPassword) {
      return {
        id: user.id,
        username: user.username,
        role: user.role
      };
    }
    
    return null;
  } catch (err) {
    console.error('Authentication error:', err);
    // Mock authentication for testing when database is not available
    if (username === 'admin' && password === 'admin') {
      return {
        id: 1,
        username: 'admin',
        role: 'admin'
      };
    }
    return null;
  }
};

// In-memory notifications storage for testing when database is not available
let inMemoryNotifications = [];
let nextNotificationId = 1;

// Notification functions
const createNotification = async (title, message, type = 'info') => {
  try {
    const result = await sql`
      INSERT INTO notifications (title, message, type, created_at, is_read) 
      VALUES (${title}, ${message}, ${type}, CURRENT_TIMESTAMP, false)
      RETURNING id, title, message, type, created_at, is_read
    `;
    return result[0];
  } catch (err) {
    console.error('Create notification error:', err);
    // Fallback to in-memory storage
    const notification = {
      id: nextNotificationId++,
      title,
      message,
      type,
      created_at: new Date().toISOString(),
      is_read: false
    };
    inMemoryNotifications.unshift(notification);
    // Keep only the latest 20 notifications
    if (inMemoryNotifications.length > 20) {
      inMemoryNotifications = inMemoryNotifications.slice(0, 20);
    }
    return notification;
  }
};

const getNotifications = async (limit = 10) => {
  try {
    const result = await sql`
      SELECT id, title, message, type, created_at, is_read 
      FROM notifications 
      ORDER BY created_at DESC 
      LIMIT ${limit}
    `;
    return result;
  } catch (err) {
    console.error('Get notifications error:', err);
    // Fallback to in-memory storage
    return inMemoryNotifications.slice(0, limit);
  }
};

const markNotificationAsRead = async (id) => {
  try {
    await sql`UPDATE notifications SET is_read = true WHERE id = ${id}`;
    return true;
  } catch (err) {
    console.error('Mark notification as read error:', err);
    // Fallback to in-memory storage
    const notification = inMemoryNotifications.find(n => n.id == id);
    if (notification) {
      notification.is_read = true;
      return true;
    }
    return false;
  }
};

const markAllNotificationsAsRead = async () => {
  try {
    await sql`UPDATE notifications SET is_read = true WHERE is_read = false`;
    return true;
  } catch (err) {
    console.error('Mark all notifications as read error:', err);
    // Fallback to in-memory storage
    inMemoryNotifications.forEach(notification => {
      notification.is_read = true;
    });
    return true;
  }
};

const getUnreadNotificationCount = async () => {
  try {
    const result = await sql`SELECT COUNT(*) as count FROM notifications WHERE is_read = false`;
    return result[0].count;
  } catch (err) {
    console.error('Get unread notification count error:', err);
    // Fallback to in-memory storage
    return inMemoryNotifications.filter(n => !n.is_read).length;
  }
};

// Scan history functions
const saveScanHistory = async (scanData) => {
  const connection = await getSql();
  if (!connection) {
    console.log('⚠️ Database not available, scan history saved locally only');
    return { id: Date.now(), created_at: new Date() };
  }
  
  try {
    // Validate required fields
    if (!scanData.code) {
      throw new Error('Scan code is required');
    }

    const result = await connection`
      INSERT INTO scan_history (
        scanned_code, scan_type, item_id, product_name, 
        quantity, scan_status, scanned_by, notes
      ) VALUES (
        ${scanData.code}, 
        ${scanData.type || 'barcode'}, 
        ${scanData.itemId || null}, 
        ${scanData.productName || null}, 
        ${scanData.quantity || 1}, 
        ${scanData.status || 'scanned'}, 
        ${scanData.scannedBy || 'unknown'}, 
        ${scanData.notes || null}
      ) RETURNING id, created_at, scanned_code, scan_type, product_name, quantity, scan_status
    `;
    
    console.log('Scan saved successfully:', result[0]);
    return result[0];
  } catch (err) {
    console.error('Save scan history error:', err);
    throw new Error(`Failed to save scan: ${err.message}`);
  }
};

const getScanHistory = async (limit = 100) => {
  if (!sql) {
    console.log('⚠️ Database not available, returning empty scan history');
    return [];
  }
  
  try {
    const result = await sql`
      SELECT * FROM scan_history 
      ORDER BY created_at DESC 
      LIMIT ${limit}
    `;
    return result;
  } catch (err) {
    console.error('Get scan history error:', err);
    return [];
  }
};

const clearScanHistory = async () => {
  if (!sql) {
    console.log('⚠️ Database not available, scan history cleared locally only');
    return true;
  }
  
  try {
    await sql`DELETE FROM scan_history`;
    return true;
  } catch (err) {
    console.error('Clear scan history error:', err);
    return false;
  }
};

const deleteScanHistory = async (scanId) => {
  if (!sql) {
    console.log('⚠️ Database not available, scan history deleted locally only');
    return true;
  }

  try {
    await sql`DELETE FROM scan_history WHERE id = ${scanId}`;
    // PostgreSQL DELETE doesn't return affected rows by default
    const check = await sql`SELECT EXISTS(SELECT 1 FROM scan_history WHERE id = ${scanId})`;
    return !check[0].exists; // Returns true if the row no longer exists
  } catch (err) {
    console.error('Delete scan history error:', err);
    throw err; // Propagate error to handle it in the API
  }
};


module.exports = {
  sql: async () => {
    if (!sql) {
      await initializeConnection();
    }
    return sql;
  },
  testConnection,
  initializeDatabase,
  authenticateUser,
  createNotification,
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadNotificationCount,
  saveScanHistory,
  getScanHistory,
  clearScanHistory,
  deleteScanHistory
};
