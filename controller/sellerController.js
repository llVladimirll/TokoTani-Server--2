const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');
const jwt = require('jsonwebtoken');
const { Groq } = require('groq-sdk');

require('dotenv').config();

const groq = new Groq({ apiKey: process.env.API_KEY });




const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'uploads/sellers', // specify the folder in your Cloudinary account
        format: 'jpg', // supports promises as well
    },
});

const upload = multer({ storage: storage });


const postSeller = async (req, res, pool) => {
    try {
        const { name, info, location, phoneNumber } = req.body;
        const { userId } = req.params;
        const pictureUrl = req.file.path; // Assuming you're using multer or similar for file upload

        // Insert the seller details into your database
        const insertQuery = 'INSERT INTO seller (name, info, location, picture_path, phone_number, user_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *';
        const values = [name, info, location, pictureUrl, phoneNumber, userId];

        const result = await pool.query(insertQuery, values);

        // Update the user record to set isseller = true
        const updateUserQuery = 'UPDATE users SET isseller = true WHERE id = $1';
        await pool.query(updateUserQuery, [userId]);

        // Retrieve the updated user information
        const getUserQuery = 'SELECT * FROM users WHERE id = $1';
        const userResult = await pool.query(getUserQuery, [userId]);
        const user = userResult.rows[0];

        const sellerToken = jwt.sign({ SellerID: result.rows[0].id }, process.env.JWT_SECRET, { expiresIn: '24h' });
        const userToken = jwt.sign({ userID: user.id, isseller: user.isseller }, process.env.JWT_SECRET, { expiresIn: '12h' });

        res.status(200).json({
            message: 'Seller added successfully.',
            seller: result.rows[0],
            sellerToken: sellerToken,
            userToken: userToken // Return the updated userToken
        });
    } catch (error) {
        console.error('Error inserting seller:', error);
        res.status(500).json({ message: 'Failed to insert seller.' });
    }
};


const getOrder = async (req, res, pool) => {
  const { sellerId } = req.params; // Assuming sellerId is passed in req.params or req.query
  
  try {
    const client = await pool.connect();
    const result = await client.query(`
      SELECT 
        o.id as order_id, 
        o.status, 
        o.created_at, 
        o.user_id,
        u.name as user_name,    -- Join users table to get user_name
        a.address_line1,
        a.address_line2,        -- Address line from addresses table
        a.city,
        a.postal_code,
        a.province,
        a.country,
        json_agg(json_build_object(
          'product_id', oi.product_id,
          'quantity', oi.quantity,
          'product_name', p.name,
          'price', p.price,
          'picture_path', p.picture_path
        )) as order_items
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      JOIN users u ON o.user_id = u.id    -- Join with users table
      JOIN addresses a ON o.address_id = a.id  -- Join with addresses table using address_id from orders
      WHERE p.seller_id = $1
      GROUP BY o.id, o.status, o.created_at, o.user_id, u.name, a.address_line1, a.address_line2, a.city, a.province, a.postal_code, a.country
      ORDER BY o.created_at DESC
    `, [sellerId]);
      
    client.release();
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching orders', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};



const getEarnings = async (req, res, pool) => {
    const { sellerId } = req.params;
    const { period } = req.query; // 'monthly', 'yearly', or 'weekly'

    console.log(`Fetch URL received: ${req.originalUrl}`);
  
    let dateFormat;
    let groupBy;
  
    switch (period) {
      case 'yearly':
        dateFormat = 'YYYY';
        groupBy = `TO_CHAR(o.created_at, '${dateFormat}')`;
        break;
      case 'weekly':
        dateFormat = 'IYYY-IW'; // ISO year and week number
        groupBy = `TO_CHAR(o.created_at, '${dateFormat}')`;
        break;
      case 'monthly':
      default:
        dateFormat = 'YYYY-MM';
        groupBy = `TO_CHAR(o.created_at, '${dateFormat}')`;
        break;
    }
  
    try {
      const earningsData = await pool.query(
        `SELECT 
           TO_CHAR(o.created_at, '${dateFormat}') AS period,
           SUM(oi.quantity * p.price) AS total
         FROM orders o
         JOIN order_items oi ON o.id = oi.order_id
         JOIN products p ON oi.product_id = p.id
         WHERE p.seller_id = $1 
         GROUP BY ${groupBy}
         ORDER BY period DESC`,
        [sellerId]
      );
  
      console.log("SQL Query result:", earningsData.rows);
  
      res.json(earningsData.rows);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    }
  };

  const getRecomendations = async (req, res, pool) => {
    try {
      // Fetch all products for the seller
      const { rows } = await pool.query('SELECT name FROM products WHERE seller_id = $1', [req.params.sellerId]);
      
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Products not found for this seller' });
      }
      
      // Prepare messages for prediction API
      const messages = rows.map(product => ({
        role: 'user',
        content: `Predict the best price for the following product: ${product.name} price in rupiah and per kilogram. Please just send the price, no explanation needed and show the product name too.`,
      }));
  
      // Make prediction request for each product
      const responses = await Promise.all(messages.map(message => 
        groq.chat.completions.create({
          messages: [message],
          model: 'llama3-8b-8192',
        })
      ));
  
      // Extract predicted prices
      const predictedPrices = responses.map(response => response.choices[0]?.message?.content || '');
  
      res.json({ predictedPrices });
    } catch (error) {
      console.error('Error predicting product prices:', error);
      res.status(500).json({ error: 'Error predicting product prices' });
    }
  };
  
  

  const getTotalEarnings = async (req, res, pool) => {
    const { sellerId } = req.params;

    try {
        const result = await pool.query(`
            SELECT 
                SUM(oi.quantity * p.price) AS total_earnings
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            JOIN products p ON oi.product_id = p.id
            WHERE p.seller_id = $1
        `, [sellerId]);

        res.json({ totalEarnings: result.rows[0].total_earnings });
    } catch (err) {
        console.error('Error fetching total earnings', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};



module.exports = {
   upload,
   postSeller,
   getOrder,
   getEarnings,
   getRecomendations,
   getTotalEarnings

}