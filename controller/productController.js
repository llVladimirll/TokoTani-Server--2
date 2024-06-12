const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');
const sharp = require('sharp');


const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'uploads/products', // specify the folder in your Cloudinary account
        format: 'jpg', // supports promises as well
    },
});

  const upload = multer({ storage: storage });

  const postProduct = async (req, res, pool) => {
    const { name, price, description, sellerID } = req.body;

    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    const picturePath = req.file.path;
    const publicId = req.file.filename;

    try {
        await pool.query(
            'INSERT INTO products (name, price, description, created_at, picture_path, seller_id) VALUES ($1, $2, $3, NOW(), $4, $5)',
            [name, price, description, picturePath, sellerID]
        );
        res.status(201).json({ message: 'Product added successfully' });
    } catch (error) {
        console.error('Error inserting product:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};




const getAllProductData = async (req, res, pool) => {
    const { page = 1, limit = 4 } = req.query;
    try {
        const offset = (page - 1) * limit;
        const result = await req.pool.query('SELECT COUNT(*) AS total FROM products'); // Query to get total count
        const totalItems = parseInt(result.rows[0].total); // Extract total count from the result
        const totalPages = Math.ceil(totalItems / limit); // Calculate total pages
        const productResult = await req.pool.query('SELECT id, name, price, description, picture_path FROM products ORDER BY id LIMIT $1 OFFSET $2', [limit, offset]);
        const products = productResult.rows.map(product => ({
            id: product.id,
            name: product.name,
            price: product.price,
            description: product.description,
            image_url: cloudinary.url(product.picture_path) // Get the URL from Cloudinary
        }));
        res.json({ products, totalPages }); // Send both products and totalPages in the response
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};






module.exports = {
    postProduct,
    getAllProductData,
    upload
}