const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const uploadDir = 'uploads/product/';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueName = uuidv4() + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

  const upload = multer({ storage: storage });

  const postProduct = async (req, res, pool) => {
    
    const { name, price, description, sellerID } = req.body;

    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }
    
    const picturePath = req.file.path;

    try {
        // Resize image
        await sharp(picturePath)
            .resize({ width: 500 }) // Adjust the width as needed
            .toFile(picturePath);

        await pool.query(
            'INSERT INTO products (name, price, description, created_at, picture_path, seller_id) VALUES ($1, $2, $3, NOW(), $4, $5)', [name, price, description, picturePath, sellerID]
        );
        res.status(201).json({ message: 'Product added successfully' });
    } catch (error) {
        console.error('Error inserting product:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};




const getAllProductData = async (req, res) => {
    try {
        const result = await req.pool.query('SELECT id, name, price, description, picture_path FROM products');
        const products = await Promise.all(result.rows.map(async (product) => {
            const imagePath = path.join(__dirname, '..', product.picture_path);
            const imageBuffer = await fs.promises.readFile(imagePath);
            const base64Image = imageBuffer.toString('base64');
            const imageUrl = `data:image/jpeg;base64,${base64Image}`;
            
            return {
                id: product.id,
                name: product.name,
                price: product.price,
                description: product.description,
                image_url: imageUrl
            };
        }));
        res.json(products);
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