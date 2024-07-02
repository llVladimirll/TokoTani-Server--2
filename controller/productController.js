const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');


const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'uploads/products',
        format: 'jpg', 
    },
});

const upload = multer({ storage: storage });

const postProduct = async (req, res, pool) => {
    const { name, price, description, sellerID, categoryName } = req.body;

    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    const picturePath = req.file.path;
    const publicId = req.file.filename;

    try {
        
        const categoryResult = await pool.query(
            'SELECT id FROM categories WHERE name = $1',
            [categoryName]
        );

        if (categoryResult.rows.length === 0) {
            return res.status(404).json({ message: 'Category not found' });
        }

        const categoryId = categoryResult.rows[0].id;

        // Insert product with category_id
        await pool.query(
            'INSERT INTO products (name, price, description, created_at, picture_path, seller_id, category_id) VALUES ($1, $2, $3, NOW(), $4, $5, $6)',
            [name, price, description, picturePath, sellerID, categoryId]
        );

        res.status(201).json({ message: 'Product added successfully' });
    } catch (error) {
        console.error('Error inserting product:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const getAllProductData = async (req, res, pool) => {
  const { page = 1, limit = 9, category, search } = req.query;

  try {
    const offset = (page - 1) * limit;

    let productQuery = `
      SELECT p.id, p.name, p.price, p.description, p.picture_path 
      FROM products p
    `;


    const queryParams = [];
    
    if (category && search) {
      productQuery += `
        JOIN categories c ON p.category_id = c.id
        WHERE c.name = $1 AND p.name ILIKE $2
      `;
      queryParams.push(category, `%${search}%`);
    } else if (category) {
      productQuery += `
        JOIN categories c ON p.category_id = c.id
        WHERE c.name = $1
      `;
      queryParams.push(category);
    } else if (search) {
      productQuery += `
        WHERE p.name ILIKE $1
      `;
      queryParams.push(`%${search}%`);
    }

    // Add limit and offset to the query
    productQuery += `
      ORDER BY p.id
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `;
    queryParams.push(limit, offset);

    // Execute the query
    const productResult = await req.pool.query(productQuery, queryParams);
    const products = productResult.rows.map(product => ({
      id: product.id,
      name: product.name,
      price: product.price,
      description: product.description,
      image_url: cloudinary.url(product.picture_path), // Adjust based on your setup
    }));

    // Fetch total count for pagination
    let countQuery = `
      SELECT COUNT(*) AS total
      FROM products p
    `;

    // Add category and/or search filters to count query
    if (category && search) {
      countQuery += `
        JOIN categories c ON p.category_id = c.id
        WHERE c.name = $1 AND p.name ILIKE $2
      `;
    } else if (category) {
      countQuery += `
        JOIN categories c ON p.category_id = c.id
        WHERE c.name = $1
      `;
    } else if (search) {
      countQuery += `
        WHERE p.name ILIKE $1
      `;
    }

    // Execute count query
    const countParams = category ? (search ? [category, `%${search}%`] : [category]) : (search ? [`%${search}%`] : []);
    const countResult = await req.pool.query(countQuery, countParams);
    const totalItems = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalItems / limit);

    res.json({ products, totalPages });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
  
const getSingleProduct = async (req, res, pool) => {
  const productId = req.params.id;

  const productQuery = `
    SELECT p.id, p.name AS product_name, p.price, p.description, p.picture_path,
           c.name AS category_name,
           s.id AS seller_id,  -- Include seller_id
           s.name AS seller_name, s.location AS location, s.picture_path AS seller_picture,
           f.rating, f.comment, f.created_at,
           u.name AS user_name
    FROM products p
    JOIN categories c ON p.category_id = c.id
    JOIN seller s ON p.seller_id = s.id
    LEFT JOIN feedback f ON p.id = f.product_id
    LEFT JOIN users u ON f.user_id = u.id
    WHERE p.id = $1
`;


  try {
    const productResult = await pool.query(productQuery, [productId]);

    if (productResult.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const product = {
      id: productResult.rows[0].id,
      name: productResult.rows[0].product_name,
      price: productResult.rows[0].price,
      description: productResult.rows[0].description,
      image_url: productResult.rows[0].picture_path,
      seller_id: productResult.rows[0].seller_id,
      category: productResult.rows[0].category_name,
      seller: {
        name: productResult.rows[0].seller_name,
        location: productResult.rows[0].location,
        picture_url: productResult.rows[0].seller_picture,
      },
      feedback: [],
    };

    productResult.rows.forEach(row => {
      if (row.rating && row.comment) {
        const feedbackItem = {
          rating: row.rating,
          comment: row.comment,
          created_at: row.created_at,
          user: {
            id: row.user_id,
            name: row.user_name,
          },
        };
        product.feedback.push(feedbackItem);
      }
    });

    res.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};




const postFeedback = async (req, res, pool) => {
  const { product_id, user_id, rating, comment } = req.body;

  // Debug: log request body
  console.log('Request Body:', req.body);

  // Ensure all necessary fields are provided
  if (!product_id || !user_id || !rating || typeof comment === 'undefined') {
    console.log('Validation Failed:', {
      product_id,
      user_id,
      rating,
      comment,
      message: 'All fields are required'
    });
    return res.status(400).json({ message: 'All fields are required' });
  }

  // Convert rating to a number
  const numericRating = Number(rating);

  // Additional validation
  if (isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
    return res.status(400).json({ message: 'Rating must be a number between 1 and 5' });
  }

  // Example SQL query to insert feedback into the database
  const insertFeedbackQuery = `
      INSERT INTO feedback (product_id, user_id, rating, comment, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING id, product_id, user_id, rating, comment, created_at
  `;

  try {
      // Execute the query using pool or any ORM method
      const feedbackResult = await pool.query(insertFeedbackQuery, [product_id, user_id, numericRating, comment]);

      // Send response with the newly created feedback entry
      res.status(201).json(feedbackResult.rows[0]);
  } catch (error) {
      console.error('Error posting feedback:', error);
      res.status(500).json({ message: 'Internal server error' });
  }
};

const postCart = async (req, res, pool) => {
  const { user_id, product_id, quantity } = req.body;

    try {
        const existingItemQuery = 'SELECT * FROM cart_items WHERE user_id = $1 AND product_id = $2';
        const existingItem = await pool.query(existingItemQuery, [user_id, product_id]);

        if (existingItem.rows.length > 0) {
            // If the product is already in the cart, update the quantity
            const updateQuery = 'UPDATE cart_items SET quantity = quantity + $1 WHERE user_id = $2 AND product_id = $3';
            await pool.query(updateQuery, [quantity, user_id, product_id]);
            res.json({ message: 'Product quantity updated successfully!' });
        } else {
            // If the product is not in the cart, insert a new entry
            const insertQuery = 'INSERT INTO cart_items (user_id, product_id, quantity) VALUES ($1, $2, $3)';
            await pool.query(insertQuery, [user_id, product_id, quantity]);
            res.json({ message: 'Product added to cart successfully!' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error adding product to cart' });
    }
};

const getShoppingCart = async (req, res, pool) => {
  const user_id = req.params.id;

  // Debug: log user ID
  console.log('Fetching cart for user:', user_id);

  try {
      const cartQuery = `
          SELECT 
              ci.product_id, 
              ci.quantity, 
              p.name, 
              p.price, 
              p.description, 
              p.picture_path,
              a.city
          FROM cart_items ci
          JOIN products p ON ci.product_id = p.id
          JOIN addresses a ON a.user_id = ci.user_id
          WHERE ci.user_id = $1
      `;

      const cartResult = await pool.query(cartQuery, [user_id]);

      if (cartResult.rows.length === 0) {
          return res.status(404).json({ message: 'No items found in cart' });
      }

      const cartItems = cartResult.rows.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          name: item.name,
          price: item.price,
          description: item.description,
          picture_path: item.picture_path,
      }));

      // Assuming city is the same for all cart items, take it from the first item
      const city = cartResult.rows[0].city;

      res.status(200).json({ cartItems, city });
  } catch (error) {
      console.error('Error fetching cart:', error);
      res.status(500).json({ message: 'Internal server error' });
  }
};

const putCart = async (req, res, pool) => {
  const { userId, itemId } = req.params;
  const { quantity } = req.body;

  try {
    // Update the quantity of the item in the cart_items table
    const updateQuery = `
      UPDATE cart_items 
      SET quantity = $1
      WHERE user_id = $2 AND product_id = $3
      RETURNING *
    `;
    
    const updateResult = await pool.query(updateQuery, [quantity, userId, itemId]);

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: "Cart item not found" });
    }

    const updatedCartItem = updateResult.rows[0];

    res.json({ message: "Cart item quantity updated successfully", updatedCartItem });
  } catch (error) {
    console.error("Error updating cart item quantity:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

const postCheckout = async (req, res, pool) => {
  const { userId } = req.params;
  const { address_id } = req.body; // Retrieve address_id from the request body

  try {
    // Retrieve cart items for the user
    const cartQuery = 'SELECT * FROM cart_items WHERE user_id = $1';
    const cartItems = await pool.query(cartQuery, [userId]);

    if (cartItems.rows.length === 0) {
      return res.status(404).json({ message: 'No items found in cart' });
    }

    // Start a transaction to ensure atomicity
    await pool.query('BEGIN');

    // Insert order into orders table with address_id
    const insertOrderQuery = `
      INSERT INTO orders (user_id, status, created_at, address_id)
      VALUES ($1, 'payment_complete', NOW(), $2)
      RETURNING id
    `;
    const orderResult = await pool.query(insertOrderQuery, [userId, address_id]);
    const orderId = orderResult.rows[0].id;

    // Insert each cart item as order items
    for (const cartItem of cartItems.rows) {
      const { product_id, quantity } = cartItem;

      const insertOrderItemQuery = `
        INSERT INTO order_items (order_id, product_id, quantity)
        VALUES ($1, $2, $3)
      `;
      await pool.query(insertOrderItemQuery, [orderId, product_id, quantity]);
    }

    // Delete all cart items after moving to orders
    const deleteCartItemsQuery = `
      DELETE FROM cart_items
      WHERE user_id = $1
    `;
    await pool.query(deleteCartItemsQuery, [userId]);

    // Commit transaction
    await pool.query('COMMIT');

    res.status(200).json({ message: 'Checkout successful', orderId });
  } catch (error) {
    // Rollback transaction in case of error
    await pool.query('ROLLBACK');
    console.error('Error during checkout:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};


const deleteCartItem = async (req, res, pool) =>{
  const { userId, itemId } = req.params;

  try {
    // Query to delete the item from the cart_items table
    const deleteQuery = `
      DELETE FROM cart_items 
      WHERE user_id = $1 AND product_id = $2
      RETURNING *
    `;

    const deleteResult = await pool.query(deleteQuery, [userId, itemId]);

    if (deleteResult.rowCount === 0) {
      return res.status(404).json({ error: "Cart item not found" });
    }

    const deletedCartItem = deleteResult.rows[0];

    res.json({ message: "Cart item deleted successfully", deletedCartItem });
  } catch (error) {
    console.error("Error deleting cart item:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}



module.exports = {
    postProduct,
    getAllProductData,
    getSingleProduct,
    upload,
    postFeedback,
    postCart,
    getShoppingCart,
    putCart,
    postCheckout,
    deleteCartItem
};
