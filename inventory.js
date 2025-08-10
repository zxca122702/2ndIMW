const database = require('./database');

// Initialize inventory table
const initializeInventoryTable = async () => {
  try {
    const sql = await database.sql();
    await sql`
      CREATE TABLE IF NOT EXISTS inventory_items (
        id SERIAL PRIMARY KEY,
        item_code VARCHAR(50) UNIQUE NOT NULL,
        product_name VARCHAR(255) NOT NULL,
        unit_of_measure VARCHAR(10) NOT NULL,
        buy_price DECIMAL(10,2) NOT NULL,
        sell_price DECIMAL(10,2),
        location VARCHAR(255) NOT NULL,
        category_id VARCHAR(50),
        status VARCHAR(20) DEFAULT 'active',
        warehouse_id VARCHAR(50),
        total_quantity INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    console.log('✅ Inventory table created/verified');
    
    // Create categories table
    await sql`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        category_id VARCHAR(50) UNIQUE NOT NULL,
        category_name VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    console.log('✅ Categories table created/verified');
    
    // Create warehouses table
    await sql`
      CREATE TABLE IF NOT EXISTS warehouses (
        id SERIAL PRIMARY KEY,
        warehouse_id VARCHAR(50) UNIQUE NOT NULL,
        warehouse_name VARCHAR(255) NOT NULL,
        location VARCHAR(255),
        capacity INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    console.log('✅ Warehouses table created/verified');
    
    
  } catch (err) {
    console.error('❌ Error creating inventory tables:', err);
    throw err;
  }

  try {
    // Insert default Categories
    const sql = await database.sql();
    await sql`
      INSERT INTO categories (category_id, category_name) VALUES
        ('CAT001', 'Materials'),
        ('CAT002', 'Products')
      ON CONFLICT (category_id) DO NOTHING;
    `;
    console.log('✅ Categories inserted');

    // Insert default Warehouses
    await sql`
      INSERT INTO warehouses (warehouse_id, warehouse_name) VALUES
        ('WH001', 'Main Warehouse'),
        ('WH002', 'Secondary Warehouse')
      ON CONFLICT (warehouse_id) DO NOTHING;
    `;
    console.log('✅ Warehouse inserted');
  } catch (err) {
    console.error('❌ Error inserting default data:', err);
    throw err;
  }
};

// Initialize material shipments table
const initializeMaterialShipmentsTable = async () => {
  try {
    const sql = await database.sql();
    await sql`
      CREATE TABLE IF NOT EXISTS material_shipments (
        id SERIAL PRIMARY KEY,
        shipment_id VARCHAR(50) UNIQUE NOT NULL,
        material_id VARCHAR(50) NOT NULL,
        category_id VARCHAR(50) NOT NULL,
        material_name VARCHAR(255) NOT NULL,
        quantity INTEGER NOT NULL,
        unit VARCHAR(20) NOT NULL,
        shipment_type VARCHAR(20) NOT NULL,
        source VARCHAR(255) NOT NULL,
        destination VARCHAR(255) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        date_shipped DATE,
        estimated_delivery DATE,
        received_date DATE,
        handled_by VARCHAR(100),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;  
    console.log('✅ Material shipments table created/verified');
  } catch (err) {
    console.error('❌ Error creating material shipments table:', err);
    throw err;
  }
};

// Get all inventory items with optional filters
const getAllInventoryItems = async (filters = {}) => {
  try {
    const sql = await database.sql();
    let query = sql`
      SELECT 
        i.*,
        c.category_name,
        w.warehouse_name
      FROM inventory_items i
      LEFT JOIN categories c ON i.category_id = c.category_id
      LEFT JOIN warehouses w ON i.warehouse_id = w.warehouse_id
    `;
    
    let conditions = [];
    let params = [];
    
    if (filters.search) {
      conditions.push(`(i.product_name ILIKE $${params.length + 1} OR i.item_code ILIKE $${params.length + 1})`);
      params.push(`%${filters.search}%`);
    }
    
    if (filters.category) {
      conditions.push(`i.category_id = $${params.length + 1}`);
      params.push(filters.category);
    }
    
    if (filters.status) {
      conditions.push(`i.status = $${params.length + 1}`);
      params.push(filters.status);
    }
    
    if (filters.warehouse) {
      conditions.push(`i.warehouse_id = $${params.length + 1}`);
      params.push(filters.warehouse);
    }
    
    if (conditions.length > 0) {
      const whereClause = ` WHERE ${conditions.join(' AND ')}`;
      query = sql`
        SELECT 
          i.*,
          c.category_name,
          w.warehouse_name
        FROM inventory_items i
        LEFT JOIN categories c ON i.category_id = c.category_id
        LEFT JOIN warehouses w ON i.warehouse_id = w.warehouse_id
        ${sql.unsafe(whereClause)}
        ORDER BY i.updated_at DESC
      `;
    } else {
      query = sql`
        SELECT 
          i.*,
          c.category_name,
          w.warehouse_name
        FROM inventory_items i
        LEFT JOIN categories c ON i.category_id = c.category_id
        LEFT JOIN warehouses w ON i.warehouse_id = w.warehouse_id
        ORDER BY i.updated_at DESC
      `;
    }
    
    const result = await query;
    return result;
  } catch (err) {
    console.error('Error fetching inventory items:', err);
    throw err;
  }
};

// Get inventory item by ID
const getInventoryItemById = async (id) => {
  try {
    const sql = await database.sql();
    const result = await sql`
      SELECT 
        i.*,
        c.category_name,
        w.warehouse_name
      FROM inventory_items i
      LEFT JOIN categories c ON i.category_id = c.category_id
      LEFT JOIN warehouses w ON i.warehouse_id = w.warehouse_id
      WHERE i.id = ${id}
    `;
    
    return result[0] || null;
  } catch (err) {
    console.error('Error fetching inventory item:', err);
    throw err;
  }
};

// Create new inventory item
const createInventoryItem = async (itemData) => {
  try {
    const sql = await database.sql();
    const {
      item_code,
      product_name,
      unit_of_measure,
      buy_price,
      sell_price,
      location,
      category_id,
      status,
      warehouse_id,
      total_quantity
    } = itemData;
    
    const result = await sql`
      INSERT INTO inventory_items (
        item_code, product_name, unit_of_measure, buy_price, sell_price,
        location, category_id, status, warehouse_id, total_quantity, updated_at
      ) VALUES (
        ${item_code}, ${product_name}, ${unit_of_measure}, ${buy_price}, ${sell_price},
        ${location}, ${category_id}, ${status}, ${warehouse_id}, ${total_quantity}, CURRENT_TIMESTAMP
      )
      RETURNING *
    `;
    
    return result[0];
  } catch (err) {
    console.error('Error creating inventory item:', err);
    throw err;
  }
};

// Update inventory item
const updateInventoryItem = async (id, itemData) => {
  try {
    const sql = await database.sql();
    const {
      item_code,
      product_name,
      unit_of_measure,
      buy_price,
      sell_price,
      location,
      category_id,
      status,
      warehouse_id,
      total_quantity
    } = itemData;
    
    const result = await sql`
      UPDATE inventory_items SET
        item_code = ${item_code},
        product_name = ${product_name},
        unit_of_measure = ${unit_of_measure},
        buy_price = ${buy_price},
        sell_price = ${sell_price},
        location = ${location},
        category_id = ${category_id},
        status = ${status},
        warehouse_id = ${warehouse_id},
        total_quantity = ${total_quantity},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;
    
    return result[0];
  } catch (err) {
    console.error('Error updating inventory item:', err);
    throw err;
  }
};

// Delete inventory item
const deleteInventoryItem = async (id) => {
  try {
    const sql = await database.sql();
    const result = await sql`
      DELETE FROM inventory_items
      WHERE id = ${id}
      RETURNING *
    `;
    
    return result[0];
  } catch (err) {
    console.error('Error deleting inventory item:', err);
    throw err;
  }
};

// Delete multiple inventory items
const deleteMultipleInventoryItems = async (ids) => {
  try {
    const sql = await database.sql();
    const result = await sql`
      DELETE FROM inventory_items
      WHERE id = ANY(${ids})
      RETURNING *
    `;
    
    return result;
  } catch (err) {
    console.error('Error deleting multiple inventory items:', err);
    throw err;
  }
};

// Get all categories
const getAllCategories = async () => {
  try {
    const sql = await database.sql();
    const result = await sql`
      SELECT category_id, category_name 
      FROM categories 
      ORDER BY category_id
    `;
    return result;
  } catch (err) {
    console.error('Error fetching categories:', err);
    throw err;
  }
};

// Get all warehouses
const getAllWarehouses = async () => {
  try {
    const sql = await database.sql();
    const result = await sql`
      SELECT * FROM warehouses
      ORDER BY warehouse_name
    `;
    
    return result;
  } catch (err) {
    console.error('Error fetching warehouses:', err);
    throw err;
  }
};

// Get inventory statistics
const getInventoryStats = async () => {
  try {
    const sql = await database.sql();
    const totalItems = await sql`SELECT COUNT(*) as count FROM inventory_items`;
    const activeItems = await sql`SELECT COUNT(*) as count FROM inventory_items WHERE status = 'active'`;
    const lowStockItems = await sql`SELECT COUNT(*) as count FROM inventory_items WHERE total_quantity < 10`;
    const totalValue = await sql`SELECT COALESCE(SUM(buy_price * total_quantity), 0) as total FROM inventory_items`;
    
    return {
      totalItems: parseInt(totalItems[0].count),
      activeItems: parseInt(activeItems[0].count),
      lowStockItems: parseInt(lowStockItems[0].count),
      totalValue: parseFloat(totalValue[0].total)
    };
  } catch (err) {
    console.error('Error fetching inventory statistics:', err);
    throw err;
  }
};

// Update item quantity
const updateItemQuantity = async (id, newQuantity, operation = 'set') => {
  try {
    const sql = await database.sql();
    let query;
    
    if (operation === 'add') {
      query = sql`
        UPDATE inventory_items 
        SET total_quantity = total_quantity + ${newQuantity}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
        RETURNING *
      `;
    } else if (operation === 'subtract') {
      query = sql`
        UPDATE inventory_items 
        SET total_quantity = GREATEST(total_quantity - ${newQuantity}, 0), updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
        RETURNING *
      `;
    } else {
      query = sql`
        UPDATE inventory_items 
        SET total_quantity = ${newQuantity}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
        RETURNING *
      `;
    }
    
    const result = await query;
    return result[0];
  } catch (err) {
    console.error('Error updating item quantity:', err);
    throw err;
  }
};

// Get all material shipments with optional filters
const getAllMaterialShipments = async (filters = {}) => {
  try {
    const sql = await database.sql();
    let query = sql`
      SELECT * FROM material_shipments
    `;
    
    let conditions = [];
    let params = [];
    
    if (filters.search) {
      conditions.push(`(material_name ILIKE $${params.length + 1} OR shipment_id ILIKE $${params.length + 1} OR source ILIKE $${params.length + 1})`);
      params.push(`%${filters.search}%`);
    }
    
    if (filters.status) {
      conditions.push(`status = $${params.length + 1}`);
      params.push(filters.status);
    }
    
    if (filters.type) {
      conditions.push(`shipment_type = $${params.length + 1}`);
      params.push(filters.type);
    }
    
    if (filters.date) {
      conditions.push(`date_shipped = $${params.length + 1}`);
      params.push(filters.date);
    }
    
    if (conditions.length > 0) {
      const whereClause = ` WHERE ${conditions.join(' AND ')}`;
      query = sql`
        SELECT * FROM material_shipments
        ${sql.unsafe(whereClause)}
        ORDER BY created_at DESC
      `;
    } else {
      query = sql`
        SELECT * FROM material_shipments
        ORDER BY created_at DESC
      `;
    }
    
    const result = await query;
    return result;
  } catch (err) {
    console.error('Error fetching material shipments:', err);
    throw err;
  }
};

// Get material shipment by ID
const getMaterialShipmentById = async (id) => {
  try {
    const sql = await database.sql();
    const result = await sql`
      SELECT * FROM material_shipments
      WHERE id = ${id}
    `;
    
    return result[0] || null;
  } catch (err) {
    console.error('Error fetching material shipment:', err);
    throw err;
  }
};

// Create new material shipment
const createMaterialShipment = async (shipmentData) => {
  try {
    const sql = await database.sql();
    const {
      shipment_id,
      material_id,
      category_id,
      material_name,
      quantity,
      unit,
      shipment_type,
      source,
      destination,
      status,
      date_shipped,
      estimated_delivery,
      received_date,
      handled_by,
      notes
    } = shipmentData;
    
    const result = await sql`
      INSERT INTO material_shipments (
        shipment_id, material_id, category_id, material_name, quantity, unit, 
        shipment_type, source, destination, status, date_shipped, 
        estimated_delivery, received_date, handled_by, notes, updated_at
      ) VALUES (
        ${shipment_id}, ${material_id}, ${category_id}, ${material_name}, 
        ${quantity}, ${unit}, ${shipment_type}, ${source}, ${destination}, 
        ${status}, ${date_shipped}, ${estimated_delivery}, ${received_date}, 
        ${handled_by}, ${notes}, CURRENT_TIMESTAMP
      )
      RETURNING *
    `;
    
    return result[0];
  } catch (err) {
    console.error('Error creating material shipment:', err);
    throw err;
  }
};

// Update material shipment
const updateMaterialShipment = async (id, shipmentData) => {
  try {
    const sql = await database.sql();
    const {
      shipment_id,
      material_id,
      category_id,
      material_name,
      quantity,
      unit,
      shipment_type,
      source,
      destination,
      status,
      date_shipped,
      estimated_delivery,
      received_date,
      handled_by,
      notes
    } = shipmentData;
    
    const result = await sql`
      UPDATE material_shipments SET
        shipment_id = ${shipment_id},
        material_id = ${material_id},
        category_id = ${category_id},
        material_name = ${material_name},
        quantity = ${quantity},
        unit = ${unit},
        shipment_type = ${shipment_type},
        source = ${source},
        destination = ${destination},
        status = ${status},
        date_shipped = ${date_shipped},
        estimated_delivery = ${estimated_delivery},
        received_date = ${received_date},
        handled_by = ${handled_by},
        notes = ${notes},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;
    
    return result[0];
  } catch (err) {
    console.error('Error updating material shipment:', err);
    throw err;
  }
};

// Delete material shipment
const deleteMaterialShipment = async (id) => {
  try {
    const sql = await database.sql();
    const result = await sql`
      DELETE FROM material_shipments
      WHERE id = ${id}
      RETURNING *
    `;
    
    return result[0];
  } catch (err) {
    console.error('Error deleting material shipment:', err);
    throw err;
  }
};

// Get material shipment statistics
const getMaterialShipmentStats = async () => {
  try {
    const sql = await database.sql();
    const totalShipments = await sql`SELECT COUNT(*) as count FROM material_shipments`;
    const deliveredShipments = await sql`SELECT COUNT(*) as count FROM material_shipments WHERE status = 'delivered'`;
    const pendingShipments = await sql`SELECT COUNT(*) as count FROM material_shipments WHERE status = 'pending'`;
    const shippedShipments = await sql`SELECT COUNT(*) as count FROM material_shipments WHERE status = 'shipped'`;
    const inboundShipments = await sql`SELECT COUNT(*) as count FROM material_shipments WHERE shipment_type = 'inbound'`;
    const outboundShipments = await sql`SELECT COUNT(*) as count FROM material_shipments WHERE shipment_type = 'outbound'`;
    
    return {
      totalShipments: parseInt(totalShipments[0].count),
      deliveredShipments: parseInt(deliveredShipments[0].count),
      pendingShipments: parseInt(pendingShipments[0].count),
      shippedShipments: parseInt(shippedShipments[0].count),
      inboundShipments: parseInt(inboundShipments[0].count),
      outboundShipments: parseInt(outboundShipments[0].count)
    };
  } catch (err) {
    console.error('Error fetching material shipment statistics:', err);
    throw err;
  }
};

// Update shipment status
const updateShipmentStatus = async (id, status, receivedDate = null) => {
  try {
    const sql = await database.sql();
    let query;
    
    if (receivedDate) {
      query = sql`
        UPDATE material_shipments 
        SET status = ${status}, received_date = ${receivedDate}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
        RETURNING *
      `;
    } else {
      query = sql`
        UPDATE material_shipments 
        SET status = ${status}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
        RETURNING *
      `;
    }
    
    const result = await query;
    return result[0];
  } catch (err) {
    console.error('Error updating shipment status:', err);
    throw err;
  }
};

// Get shipments by inventory item
const getShipmentsByCategoryId = async (categoryId) => {
  try {
    const sql = await database.sql();
    const result = await sql`
      SELECT * FROM material_shipments
      WHERE category_id = ${categoryId}
      ORDER BY created_at DESC
    `;
    
    return result;
  } catch (err) {
    console.error('Error fetching shipments by category ID:', err);
    throw err;
  }
};


module.exports = {
  initializeInventoryTable,
  initializeMaterialShipmentsTable,
  getAllInventoryItems,
  getInventoryItemById,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  deleteMultipleInventoryItems,
  getAllCategories,
  getAllWarehouses,
  getInventoryStats,
  updateItemQuantity,
  getAllMaterialShipments,
  getMaterialShipmentById,
  createMaterialShipment,
  updateMaterialShipment,
  deleteMaterialShipment,
  getMaterialShipmentStats,
  updateShipmentStatus,
  getShipmentsByCategoryId
};
