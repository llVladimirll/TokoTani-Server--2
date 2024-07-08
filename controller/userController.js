const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

const register = async (req, res, pool) => {
    const { name, email, password } = req.body;
    try{
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query(
          'INSERT INTO users (name, email, password, isseller, created_at) VALUES ($1, $2, $3, $4, NOW())', [name, email, hashedPassword, false]

        );
        res.status(201).json({message: 'User Registered Successfully'});
      }catch(err){
        console.log(err);
        res.status(500).json({ message: 'Error registering user' });
      }
}

const login = async (req, res, pool) => {
  const { email, password } = req.body;
  try {
    const userResult = await pool.query(
      'SELECT * FROM users WHERE email = $1', [email]
    );
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const user = userResult.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const userToken = jwt.sign({ userID: user.id, isSeller: user.isseller }, process.env.JWT_SECRET, { expiresIn: '12h' });

    if (user.isseller) { // Assuming 'isseller' is the correct field name
      const sellerResult = await pool.query('SELECT * FROM seller WHERE user_id = $1', [user.id]);
      if (sellerResult.rows.length === 0) {
        return res.status(401).json({ message: 'User is marked as seller but no corresponding seller found' });
      }
      const seller = sellerResult.rows[0];
      const sellerToken = jwt.sign({ SellerID: seller.id }, process.env.JWT_SECRET, { expiresIn: '12h' });

      return res.status(200).json({ userToken, sellerToken });
    } else {
      return res.status(200).json({ userToken });
    }

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error in logging user' });
  }
}


const getUser = async (req, res, pool) => {
  const userId = req.params.id;

  try {
    const result = await pool.query('SELECT name, email FROM users WHERE id = $1', [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = result.rows[0];
    res.status(200).json(user);
  } catch (error) {
    console.error('Error retrieving user:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const putUser = async (req, res, pool) => {
  const userId = req.params.id;
  const { name, email, password } = req.body;

  try {
    // Check if user exists
    const checkUserQuery = 'SELECT * FROM users WHERE id = $1';
    const checkUserResult = await pool.query(checkUserQuery, [userId]);

    if (checkUserResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update user details including password if provided
    let updateUserQuery;
    let queryParams;

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateUserQuery = 'UPDATE users SET name = $1, email = $2, password = $3 WHERE id = $4';
      queryParams = [name, email, hashedPassword, userId];
    } else {
      updateUserQuery = 'UPDATE users SET name = $1, email = $2 WHERE id = $3';
      queryParams = [name, email, userId];
    }

    await pool.query(updateUserQuery, queryParams);

    res.status(200).json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};


const postAddress = async (req, res, pool) => {
  const { address_line1, address_line2, city, province, postal_code, country } = req.body;
  const user_id = req.params.id;

  try {
      await pool.query(
          'INSERT INTO addresses (user_id, address_line1, address_line2, city, province, postal_code, country, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())',
          [user_id, address_line1, address_line2, city, province, postal_code, country]
      );
      res.status(201).json({ message: 'Address added successfully' });
  } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Error adding address' });
  }
};

const getAdresses = async (req, res, pool) => {
  const userId = req.params.userId;

  try {
    const result = await pool.query('SELECT * FROM addresses WHERE user_id = $1', [userId]);
    const addresses = result.rows;
    res.status(200).json(addresses);
  } catch (error) {
    console.error('Error retrieving addresses:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

const getCartItems = async (req, res, pool) => {
  const userId = req.params.userId;

  try {
    const result = await pool.query('SELECT COUNT(*) FROM cart_items WHERE user_id = $1', [userId]);
    const itemCount = result.rows[0].count; // This will return the count as a string
    res.status(200).json({ itemCount });
  } catch (error) {
    console.error('Error retrieving cart item count:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const getOrder = async (req, res, pool) => {
  const userId = req.params.id;
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
      WHERE o.user_id = $1    -- Filter orders by user_id
      GROUP BY o.id, o.status, o.created_at, o.user_id, u.name, a.address_line1, a.address_line2, a.city, a.province, a.postal_code, a.country
      ORDER BY o.created_at DESC
    `, [userId]);
      
    client.release();
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching orders', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const patchOrder = async (req, res, pool) => {
  const orderId = req.params.orderId

  try {
    // Update the order status to "product is shipping"
    const updateQuery = 'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *';
    const values = ['Order Complete', orderId];

    const result = await pool.query(updateQuery, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.status(200).json({
      message: 'Order Complete".',
      order: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ message: 'Failed to update order status.' });
  }

}




module.exports = {
  getOrder,
    getUser,
    register,
    putUser,
    login,
    postAddress,
    getAdresses,
    getCartItems,
    patchOrder
}