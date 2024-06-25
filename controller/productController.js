const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'uploads/products', // specify the folder in your Cloudinary account
        format: 'jpg', // supports promises as well
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
        // Get category_id from the category name
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

    // Base product query
    let productQuery = `
      SELECT p.id, p.name, p.price, p.description, p.picture_path 
      FROM products p
    `;

    // Initialize query parameters array
    const queryParams = [];
    
    // Add category and/or search filters
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



module.exports = {
    postProduct,
    getAllProductData,
    getSingleProduct,
    upload,
    postFeedback,
    postCart
};
