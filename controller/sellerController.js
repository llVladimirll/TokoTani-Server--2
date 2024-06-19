const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

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
        const { name, info, location } = req.body;
        const pictureUrl = req.file.path; // Cloudinary will provide the file URL after upload

        // Insert the seller details into your database
        const insertQuery = 'INSERT INTO seller (name, info, location, picture_path) VALUES ($1, $2, $3, $4) RETURNING *';
        const values = [name, info, location, pictureUrl];

        const result = await pool.query(insertQuery, values);

        res.status(200).json({
            message: 'Seller added successfully.',
            seller: result.rows[0]
        });
    } catch (error) {
        console.error('Error inserting seller:', error);
        res.status(500).json({ message: 'Failed to insert seller.' });
    }
};


module.exports = {
   upload,
   postSeller

}