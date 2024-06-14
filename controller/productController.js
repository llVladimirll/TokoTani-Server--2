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

const getAllProductData = async (req, res) => {
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
  

module.exports = {
    postProduct,
    getAllProductData,
    upload
};
