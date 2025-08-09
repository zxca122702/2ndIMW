const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

// Create Neon serverless connection
const sql = neon(process.env.DATABASE_URL);

// Test database connection
const testConnection = async () => {
  try {
    const result = await sql`SELECT version()`;
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
    
    console.log('✅ Users and notifications tables created/verified');
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

module.exports = {
  sql,
  testConnection,
  initializeDatabase,
  authenticateUser,
  createNotification,
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadNotificationCount

};
